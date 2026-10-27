import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Why `/api/auth/sso/*` sent the browser back to a login page.
 *
 *  - `sso_unavailable`     the option is unknown, disabled, or does not allow this app's origin
 *  - `sso_failed`          IAM refused, or the browser came back without a session
 *  - `sso_down`            IAM unreachable
 *  - `sso_no_access`       signed in at IAM, but holds no role this app serves
 *  - `sso_token_too_large` the browser dropped the access token cookie for its size
 */
export type SsoFailureReason =
  | 'sso_unavailable'
  | 'sso_failed'
  | 'sso_down'
  | 'sso_no_access'
  | 'sso_token_too_large';

/** The portals that offer IAM login options; failures go back to the one the person started from. */
const SSO_LOGIN_PATHS = ['/login/farmer', '/login/development-agent'] as const;
const DEFAULT_SSO_LOGIN_PATH = '/login/development-agent';

/** The SSO portal named by `value`, or the default one. The value comes from the query string. */
export function ssoLoginPath(value: unknown): string {
  return SSO_LOGIN_PATHS.find((path) => path === value) ?? DEFAULT_SSO_LOGIN_PATH;
}

export function backToSsoLogin(request: NextRequest, reason: SsoFailureReason, from?: string): NextResponse {
  return NextResponse.redirect(new URL(`${ssoLoginPath(from)}?reason=${reason}`, request.url), 303);
}
