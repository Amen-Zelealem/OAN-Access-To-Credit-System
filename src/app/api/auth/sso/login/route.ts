import { getClientIp } from '@/lib/clientIp';
import { setLoginOptionCookie, startIamLogin, type IamLoginError } from '@/lib/iamSession';
import { LOCAL_LOGIN_KEY } from '@/lib/loginOptions';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rateLimit';
import { RATE_LIMITS } from '@/lib/securityConfig';
import { backToSsoLogin, ssoLoginPath, type SsoFailureReason } from '@/lib/ssoRedirect';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const FAILURE_REASONS: Record<IamLoginError, SsoFailureReason> = {
  unavailable: 'sso_unavailable',
  failed: 'sso_failed',
  down: 'sso_down',
};

/** The origin the browser sent (`window.location.origin`), or null; `request.url` carries the server's bind address. */
function browserOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Starts IAM login option `key`: a login page button navigates here (a page
 * load, not a fetch — the browser has to follow the identity provider's
 * redirects). `from` is the portal the button is on, where failures go back to.
 *
 * oan_auth_service starts the login at the option's IAM and returns the
 * identity provider URL. The browser goes there, then IAM sends it to
 * `/api/auth/sso/complete`, which checks the session belongs to this app.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  const from = ssoLoginPath(request.nextUrl.searchParams.get('from'));

  const clientIp = getClientIp(request);
  const limit = checkRateLimit(`sso-login:${clientIp}`, RATE_LIMITS.ssoLogin.limit, RATE_LIMITS.ssoLogin.windowMs);
  if (!limit.allowed) {
    logger.security(`SSO login rate limit exceeded for ${clientIp}`);
    return backToSsoLogin('sso_down', from);
  }

  if (!/^[a-z0-9-]+$/.test(key) || key === LOCAL_LOGIN_KEY) return backToSsoLogin('sso_unavailable', from);

  // IAM redirects the browser to this URL as given, so it must be absolute and
  // on this app's own origin. That origin is the one the browser used, not
  // `request.url`'s (`0.0.0.0:3000` behind `next start -H 0.0.0.0`).
  // oan_auth_service accepts it only if the origin is in the option's
  // `return_origins`, so a forged one fails there.
  const landing = new URL('/api/auth/sso/complete', browserOrigin(request.nextUrl.searchParams.get('origin')) ?? request.nextUrl.origin);
  landing.searchParams.set('from', from);

  const result = await startIamLogin(key, landing.toString(), clientIp);
  if ('error' in result) return backToSsoLogin(FAILURE_REASONS[result.error], from);

  // Recorded before the browser leaves, so the landing route knows which IAM's
  // cookies to read. `kind` is added there, from `/me`.
  const response = NextResponse.redirect(result.redirectUrl, 303);
  setLoginOptionCookie(response, { key, cookiePrefix: result.cookiePrefix });
  return response;
}
