import { homeRouteFor, IAM_LOGIN_KINDS, kindFromRoles } from '@/features/auth/rbac';
import { getClientIp } from '@/lib/clientIp';
import { fetchIamUser, isAccessTokenDropped, readIamSession, setLoginOptionCookie } from '@/lib/iamSession';
import { logger } from '@/lib/logger';
import { clearSessionCookies } from '@/lib/session';
import { backToSsoLogin, ssoLoginPath } from '@/lib/ssoRedirect';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Where IAM sends the browser once it has opened the session: the URL
 * `/api/auth/sso/login` gave as `return_url`. IAM's cookies (shared parent
 * domain) arrive with this request; `login_option` says whose to read.
 *
 * Access is decided by `/v1/auth/me`, never by roles decoded from the token:
 * it runs the backend's full token check, creates the user on a first login,
 * and returns the user's roles in this app, including default roles the token
 * never shows. The kind it maps to is stored in `login_option` for routing.
 *
 * A user with no role here is sent back, but not logged out of IAM: their IAM
 * session is valid for other apps.
 *
 * Drops any local session the browser still held, so the two session kinds
 * never mix.
 *
 * Answers with a tiny page that navigates on, not a 30x: the redirect chain
 * that got here started at the identity provider, and a browser withholds
 * `SameSite=Strict` cookies on every hop of a chain that started cross-site.
 * A navigation this page starts itself is same-site.
 */
export async function GET(request: NextRequest) {
  const from = ssoLoginPath(request.nextUrl.searchParams.get('from'));

  const session = readIamSession(request);
  if (!session) return backToSsoLogin(request, 'sso_failed', from);
  if (isAccessTokenDropped(session)) return backToSsoLogin(request, 'sso_token_too_large', from);
  if (!session.accessToken) return backToSsoLogin(request, 'sso_failed', from);

  let user: { roles: string[] } | null;
  try {
    user = await fetchIamUser(session.accessToken, getClientIp(request));
  } catch (error) {
    logger.error('SSO landing could not load the user:', error);
    return backToSsoLogin(request, 'sso_down', from);
  }

  const kind = user ? kindFromRoles(user.roles) : null;
  if (!kind || !IAM_LOGIN_KINDS.includes(kind)) return backToSsoLogin(request, 'sso_no_access', from);

  const href = homeRouteFor(kind);

  const response = new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${href}"><title>Signing in</title></head><body><a href="${href}">Continue</a></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      },
    }
  );
  clearSessionCookies(response);
  setLoginOptionCookie(response, { ...session.option, kind });
  return response;
}
