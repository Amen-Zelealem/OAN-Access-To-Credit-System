import { readAppIamSession } from '@/lib/activeSession';
import { getClientIp } from '@/lib/clientIp';
import { checkCsrf } from '@/lib/csrf';
import {
    applyIamCookies,
    clearLoginOptionCookie,
    isIamTokenExpired,
    refreshIamSession,
    type IamRefreshResult,
} from '@/lib/iamSession';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { buildClientResponse, buildUpstreamHeaders } from '@/lib/proxyHeaders';
import { AUTH_TOKEN_COOKIE, idleSessionResponse, isIdleExpired, REFRESH_TOKEN_COOKIE } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ path: string[] }> };

// One shared handler exported per HTTP verb so method semantics are explicit
// at the routing layer (and mutating verbs go through the CSRF guard below).
async function handler(request: NextRequest, { params }: RouteContext) {
  const { path } = await params;
  return handleProxy(request, path);
}

export {
    handler as GET,
    handler as POST,
    handler as PUT,
    handler as PATCH,
    handler as DELETE,
};

async function handleProxy(request: NextRequest, pathArray: string[]) {
  const isMutating = !['GET', 'HEAD'].includes(request.method);

  // CSRF: reject cross-origin state-changing requests.
  if (isMutating) {
    const csrfError = checkCsrf(request);
    if (csrfError) return csrfError;
  }

  // Idle timeout. The middleware's matcher excludes /api, so without this an
  // idle tab sitting on an already-rendered page kept reaching the backend until
  // its next navigation — up to a full timeout window past the cut-off.
  if (isIdleExpired(request)) {
    logger.security('Rejected a proxied request from an idle session');
    return idleSessionResponse();
  }

  // Construct the target URL
  const targetPath = pathArray.join('/');
  const search = request.nextUrl.search;
  const targetUrl = `${env.API_BASE_URL}/${targetPath}${search}`;

  let authToken = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

  // An SSO (IAM) session: its access token is forwarded as the Bearer token, the
  // same as ours, and oan_auth_service validates it with IAM. Browser cookies are
  // never forwarded. The backend caches its verdict until `exp`, so an expired
  // token is renewed here before the request goes out, and IAM's new cookies ride
  // back on this response.
  const iam = !authToken && !request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ? readAppIamSession(request) : null;
  let iamSetCookies: string[] = [];
  let refreshed = false;

  const renewIam = async (): Promise<IamRefreshResult> => {
    refreshed = true;
    const renewed = await refreshIamSession(iam!, getClientIp(request));
    if (renewed.status !== 'down') iamSetCookies = renewed.setCookies;
    return renewed;
  };

  if (iam) {
    authToken = iam.accessToken;
    if (!authToken) return iamSessionEnded(iamSetCookies);
    if (isIamTokenExpired(iam)) {
      const renewed = await renewIam();
      // IAM down is not the end of the session: answer 503 and keep it.
      if (renewed.status === 'down') return iamUnavailable();
      if (renewed.status === 'ended') return iamSessionEnded(iamSetCookies);
      authToken = renewed.accessToken;
    }
  }

  try {
    // Read once: a retry after a refresh sends the same body again.
    const body = isMutating ? await request.blob() : undefined;
    const send = (token: string | undefined) =>
      fetch(targetUrl, {
        method: request.method,
        // Allowlisted client headers plus a trustworthy X-Forwarded-For and the
        // JWT injected from the httpOnly cookie. See lib/proxyHeaders.ts for why
        // both directions are filtered rather than blocklisted.
        headers: buildUpstreamHeaders(request, token),
        redirect: 'manual',
        ...(body ? { body } : {}),
      });

    // Forward the request to the external backend
    let response = await send(authToken);

    // A 401 on an IAM token: refresh once and retry. A refresh that hands back
    // the same token means the 401 was a real answer, not a stale token.
    if (iam && response.status === 401 && !refreshed) {
      const renewed = await renewIam();
      if (renewed.status === 'ok' && renewed.accessToken !== authToken) {
        authToken = renewed.accessToken;
        response = await send(authToken);
      }
    }

    // Relay it back with response headers allowlisted (no Set-Cookie, no stack
    // disclosure) and Frappe's debug fields stripped from JSON bodies.
    //
    // `redirect: 'manual'` above means a 3xx arrives here intact, so the relay
    // needs the prefix to rewrite Location onto — otherwise the browser gets a
    // redirect with no destination. (/api/files follows redirects upstream and
    // so passes no prefix.)
    const { body: clientBody, init } = await buildClientResponse(response, targetUrl, {
      proxyPrefix: '/api/proxy',
    });
    const clientResponse = new NextResponse(clientBody, init);
    applyIamCookies(clientResponse, iamSetCookies);
    return clientResponse;
  } catch (error) {
    const safeTargetUrl = `${env.API_BASE_URL}/${targetPath}`;
    logger.error(`Proxy error for ${safeTargetUrl}:`, error);
    return NextResponse.json({ message: 'Proxy request failed' }, { status: 502 });
  }
}

function iamUnavailable(): NextResponse {
  return NextResponse.json({ message: 'Sign-in is temporarily unavailable' }, { status: 503 });
}

/** The IAM session is over: drop `login_option` and relay IAM's own clearing headers. */
function iamSessionEnded(setCookies: string[]): NextResponse {
  const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
  clearLoginOptionCookie(response);
  applyIamCookies(response, setCookies);
  return response;
}
