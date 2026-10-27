import type { UserKind } from '@/features/auth/rbac';
import { env } from '@/lib/env';
import { decodeTokenExp } from '@/lib/iamClaims';
import { logger } from '@/lib/logger';
import type { LoginProvider } from '@/lib/loginOptions';
import { REMEMBERED_SESSION_MAX_AGE } from '@/lib/session';
import type { NextResponse } from 'next/server';

// IAM login options (single sign-on through the OpenG2P IAM services), as
// discovered from oan_auth_service. See oan_auth_service
// docs/IAM_LOGIN_UI_INTEGRATION_PLAN.md.
//
// This app never talks to an IAM. oan_auth_service lists the login options
// (`/v1/auth/iam/providers`), starts a login (`/v1/auth/iam/login`), and
// refreshes and ends IAM sessions (`/v1/auth/refresh`, `/v1/auth/logout` with
// `access_token`). The only configuration is `API_BASE_URL`.
//
// IAM keeps the session in its own cookies on the shared parent domain:
// `<prefix>X-Access-Token`, `<prefix>X-ID-Token` and `<prefix>X-Session-Id`.
// Each IAM has its own prefix, so a browser signed in to two options holds two
// sets. The `login_option` cookie records which option this app's session came
// through, and so which set to read. This app never copies IAM's tokens into
// its own `auth_token`/`refresh_token`: refreshing has to hand IAM its
// session-id cookie anyway, so a copy could only drift.
//
// This is the only file that knows those cookie names. Backend error bodies are
// logged here, never returned.

/** Base names; each IAM prefixes them with its `cookie_prefix`. */
export const IAM_COOKIES = {
  accessToken: 'X-Access-Token',
  idToken: 'X-ID-Token',
  sessionId: 'X-Session-Id',
} as const;

export const LOGIN_OPTION_COOKIE = 'login_option';

const HTTP_TIMEOUT_MS = 10_000;

interface CookieReader {
  cookies: { get(name: string): { value: string } | undefined };
}

// --- The login_option cookie ------------------------------------------------

export interface LoginOption {
  /** The `OAN IAM Service` row the session came through. */
  key: string;
  cookiePrefix: string;
  /**
   * This app's role for the user, from `/me` at the landing route. Absent until
   * then, and for a user with no role here. Routing only: the backend
   * authorizes every API call.
   */
  kind?: UserKind;
}

const KINDS: ReadonlyArray<UserKind> = ['bank_admin', 'bank_agent', 'dev_agent', 'marketplace', 'farmer'];

// `HttpOnly`, so only this server reads it. `Lax`, not `Strict`: the landing
// route is reached at the end of a redirect chain that started at the identity
// provider, and a browser withholds `Strict` cookies on every hop of it.
const loginOptionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function readLoginOption(request: CookieReader): LoginOption | null {
  const raw = request.cookies.get(LOGIN_OPTION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { key?: unknown; cookie_prefix?: unknown; kind?: unknown };
    // The prefix becomes part of a cookie name, so only cookie-name characters.
    if (typeof value.key !== 'string' || !/^[a-z0-9-]+$/.test(value.key)) return null;
    if (typeof value.cookie_prefix !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value.cookie_prefix)) return null;
    const kind = KINDS.find((k) => k === value.kind);
    return { key: value.key, cookiePrefix: value.cookie_prefix, ...(kind ? { kind } : {}) };
  } catch {
    return null;
  }
}

export function setLoginOptionCookie(response: NextResponse, option: LoginOption): void {
  const value = JSON.stringify({ key: option.key, cookie_prefix: option.cookiePrefix, kind: option.kind });
  response.cookies.set(LOGIN_OPTION_COOKIE, value, {
    ...loginOptionCookieOptions,
    // Outlives any IAM session it can point at; the IAM cookies decide whether
    // there is a session at all.
    maxAge: REMEMBERED_SESSION_MAX_AGE,
  });
}

export function clearLoginOptionCookie(response: NextResponse): void {
  response.cookies.set(LOGIN_OPTION_COOKIE, '', { ...loginOptionCookieOptions, maxAge: 0 });
}

// --- The IAM session a request carries -------------------------------------

export function iamCookieName(base: string, cookiePrefix: string): string {
  return `${cookiePrefix}${base}`;
}

export interface IamSession {
  option: LoginOption;
  accessToken: string | undefined;
  sessionId: string | undefined;
  idToken: string | undefined;
  /** The access token's `exp` (epoch seconds), decoded, not verified. Null if it does not decode. */
  exp: number | null;
}

/**
 * The IAM session of the request's login option, or null when the request has
 * no `login_option` or none of that option's cookies.
 */
export function readIamSession(request: CookieReader): IamSession | null {
  const option = readLoginOption(request);
  if (!option) return null;

  const read = (base: string) => request.cookies.get(iamCookieName(base, option.cookiePrefix))?.value || undefined;
  const accessToken = read(IAM_COOKIES.accessToken);
  const sessionId = read(IAM_COOKIES.sessionId);
  const idToken = read(IAM_COOKIES.idToken);
  if (!accessToken && !sessionId && !idToken) return null;

  return { option, accessToken, sessionId, idToken, exp: accessToken ? decodeTokenExp(accessToken) : null };
}

/**
 * The browser dropped the access token cookie for being too large (over about
 * 4 KB, from many roles or large custom claims) while keeping the smaller ID
 * token. Not a plain sign-in failure: signing in again cannot fix it.
 */
export function isAccessTokenDropped(session: IamSession): boolean {
  return !session.accessToken && !!session.idToken;
}

/** oan_auth_service refreshes from the access token (expired is fine) and IAM's session cookie. */
export function canRefreshIamSession(session: IamSession): boolean {
  return !!session.accessToken && !!session.sessionId;
}

export function isIamTokenExpired(session: IamSession, skewSeconds = 5): boolean {
  return session.exp === null || session.exp <= Date.now() / 1000 + skewSeconds;
}

// --- Relaying IAM's Set-Cookie headers -------------------------------------

type CookieOptions = NonNullable<Parameters<NextResponse['cookies']['set']>[2]>;

interface ParsedCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Parses one `Set-Cookie` header so it can go through `response.cookies.set`.
 * Appending the raw header would be simpler, but `NextResponse.cookies`
 * rewrites every `set-cookie` header from its own map on each later `.set()`,
 * silently dropping anything appended behind its back.
 */
function parseSetCookie(header: string): ParsedCookie | null {
  const [pair, ...attributes] = header.split(';');
  const eq = pair?.indexOf('=') ?? -1;
  if (!pair || eq <= 0) return null;

  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
  const options: CookieOptions = {};

  for (const attribute of attributes) {
    const [rawKey, ...rest] = attribute.split('=');
    const key = rawKey?.trim().toLowerCase();
    const attrValue = rest.join('=').trim();
    if (key === 'max-age') options.maxAge = Number(attrValue);
    else if (key === 'expires') options.expires = new Date(attrValue);
    else if (key === 'domain') options.domain = attrValue;
    else if (key === 'path') options.path = attrValue;
    else if (key === 'secure') options.secure = true;
    else if (key === 'httponly') options.httpOnly = true;
    else if (key === 'samesite') {
      const sameSite = attrValue.toLowerCase();
      if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') options.sameSite = sameSite;
    }
  }

  return { name, value, options };
}

/**
 * Re-emits IAM's cookies on `response` exactly as IAM set them (same domain,
 * path and flags), so the browser stores the cookies IAM itself would have.
 * Call after any of this app's own cookie clearing on the same response:
 * cookies are keyed by name, so the later write wins.
 */
export function applyIamCookies(response: NextResponse, setCookies: string[]): void {
  for (const header of setCookies) {
    const parsed = parseSetCookie(header);
    if (parsed) response.cookies.set(parsed.name, parsed.value, parsed.options);
  }
}

/** The value a cookie is given in `setCookies`, ignoring clear-before-set (`Max-Age=0`) writes. */
function cookieValueFrom(setCookies: string[], name: string): string | undefined {
  let found: string | undefined;
  for (const header of setCookies) {
    const parsed = parseSetCookie(header);
    if (parsed?.name === name && parsed.value && parsed.options.maxAge !== 0) found = parsed.value;
  }
  return found;
}

// --- Calls to oan_auth_service ----------------------------------------------

async function callAuth(path: string, init: RequestInit, clientIp: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  if (init.body) headers.set('Content-Type', 'application/json');
  return fetch(`${env.API_BASE_URL}/v1/auth${path}`, {
    ...init,
    headers,
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
}

/**
 * Only the option's own IAM cookies, never the browser's whole jar: the
 * backend gets what it needs to find this option's session and nothing else.
 */
function iamCookieHeader(session: IamSession): string {
  const pairs: string[] = [];
  const add = (base: string, value: string | undefined) => {
    if (value) pairs.push(`${iamCookieName(base, session.option.cookiePrefix)}=${value}`);
  };
  add(IAM_COOKIES.accessToken, session.accessToken);
  add(IAM_COOKIES.sessionId, session.sessionId);
  add(IAM_COOKIES.idToken, session.idToken);
  return pairs.join('; ');
}

const PROVIDERS_CACHE_MS = 60_000;
let providersCache: { at: number; providers: LoginProvider[] } | null = null;

/** Backend icons are public Frappe files, served to the browser through `/api/files`. */
function iconPath(icon: unknown): string {
  return typeof icon === 'string' && /^\/files\/[^?#]+$/.test(icon) && !icon.includes('..')
    ? `/api${icon}`
    : '';
}

/**
 * The enabled login options in display order, or null when oan_auth_service
 * could not be reached. Cached for a minute: the list changes only when an
 * administrator edits an `OAN IAM Service` row.
 */
export async function listLoginProviders(): Promise<LoginProvider[] | null> {
  if (providersCache && Date.now() - providersCache.at < PROVIDERS_CACHE_MS) return providersCache.providers;

  try {
    const response = await callAuth('/iam/providers', { method: 'GET' }, '');
    const body = (await response.json().catch(() => null)) as { data?: { providers?: unknown } } | null;
    const raw = body?.data?.providers;
    if (!response.ok || !Array.isArray(raw)) {
      logger.error(`Listing login options failed (status ${response.status})`);
      return null;
    }
    const providers = raw.flatMap((entry: { key?: unknown; label?: unknown; icon_url?: unknown }) =>
      typeof entry?.key === 'string' && typeof entry.label === 'string'
        ? [{ key: entry.key, label: entry.label, iconUrl: iconPath(entry.icon_url) }]
        : []
    );
    providersCache = { at: Date.now(), providers };
    return providers;
  } catch (error) {
    logger.error('Listing login options failed:', error);
    return null;
  }
}

/**
 * Why a login could not start. `unavailable`: the option is unknown, disabled,
 * or does not allow this app's origin (a configuration error). `failed`: IAM
 * refused. `down`: IAM unreachable.
 */
export type IamLoginError = 'unavailable' | 'failed' | 'down';

/**
 * Starts login option `key` and returns the identity provider URL to send the
 * browser to, plus the option's cookie prefix.
 *
 * `returnUrl` is where IAM sends the browser after the login. It must be
 * absolute (IAM redirects to it as given) and on one of the option's
 * `return_origins`, which oan_auth_service checks.
 */
export async function startIamLogin(
  key: string,
  returnUrl: string,
  clientIp: string
): Promise<{ redirectUrl: string; cookiePrefix: string } | { error: IamLoginError }> {
  try {
    const response = await callAuth(
      '/iam/login',
      { method: 'POST', body: JSON.stringify({ key, return_url: returnUrl }) },
      clientIp
    );
    const body = (await response.json().catch(() => null)) as {
      data?: { redirect_url?: unknown; cookie_prefix?: unknown };
    } | null;

    if (!response.ok) {
      if (response.status === 400) {
        // A 400 is configuration: an unknown or disabled key, or this app's
        // origin missing from the row's return_origins.
        logger.error(`Login option "${key}" refused to start (400): check its OAN IAM Service row`);
        return { error: 'unavailable' };
      }
      logger.security(`Login option "${key}" failed to start (status ${response.status})`);
      return { error: response.status === 503 ? 'down' : 'failed' };
    }

    const redirectUrl = typeof body?.data?.redirect_url === 'string' ? body.data.redirect_url : '';
    const cookiePrefix = body?.data?.cookie_prefix ?? '';
    if (!isAllowedRedirect(redirectUrl) || typeof cookiePrefix !== 'string') {
      logger.security(`Login option "${key}" returned an unusable redirect`);
      return { error: 'failed' };
    }
    return { redirectUrl, cookiePrefix };
  } catch (error) {
    logger.error(`Login option "${key}" failed to start:`, error);
    return { error: 'down' };
  }
}

/** `https`, or `http` to localhost in development. */
function isAllowedRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return (
      url.protocol === 'http:' &&
      process.env.NODE_ENV !== 'production' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

/**
 * `GET /v1/auth/me` with the access token. Runs the backend's full token check,
 * creates the user on a first login, and returns their roles in this app.
 * Null on 401; throws when the backend could not answer.
 */
export async function fetchIamUser(accessToken: string, clientIp: string): Promise<{ roles: string[] } | null> {
  const response = await callAuth(
    '/me',
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    clientIp
  );
  if (response.status === 401 || response.status === 403) return null;
  const body = (await response.json().catch(() => null)) as { data?: { roles?: unknown } } | null;
  if (!response.ok) throw new Error(`/v1/auth/me answered ${response.status}`);
  const roles = body?.data?.roles;
  return { roles: Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [] };
}

export type IamRefreshResult =
  | { status: 'ok'; accessToken: string; setCookies: string[] }
  /** The session is over: sign the user out. IAM's cookie-clearing headers are in `setCookies`. */
  | { status: 'ended'; setCookies: string[] }
  /** IAM is unreachable: keep the session and try again later. */
  | { status: 'down' };

/**
 * Has the option's IAM refresh the session. A token that had not expired yet
 * comes back unchanged.
 */
export async function refreshIamSession(session: IamSession, clientIp: string): Promise<IamRefreshResult> {
  if (!canRefreshIamSession(session)) return { status: 'ended', setCookies: [] };

  try {
    const response = await callAuth(
      '/refresh',
      {
        method: 'POST',
        headers: { Cookie: iamCookieHeader(session) },
        body: JSON.stringify({ access_token: session.accessToken }),
      },
      clientIp
    );
    const setCookies = response.headers.getSetCookie();
    if (response.status === 503) return { status: 'down' };
    if (!response.ok) {
      logger.security(`IAM session refresh refused (status ${response.status})`);
      return { status: 'ended', setCookies };
    }
    const accessCookie = iamCookieName(IAM_COOKIES.accessToken, session.option.cookiePrefix);
    const accessToken = cookieValueFrom(setCookies, accessCookie) ?? session.accessToken!;
    return { status: 'ok', accessToken, setCookies };
  } catch (error) {
    logger.error('IAM session refresh failed:', error);
    return { status: 'down' };
  }
}

/**
 * Ends the session at IAM and, where the backend can, at the identity
 * provider. Returns IAM's cookie-clearing headers, and the provider logout URL
 * when the browser has to visit it to end the provider session itself.
 *
 * Best effort: on any failure the session is still ended in this app, just not
 * at IAM. `ended` says whether IAM confirmed.
 */
export async function revokeIamSession(
  session: IamSession,
  clientIp: string
): Promise<{ ended: boolean; setCookies: string[]; logoutUrl: string | null }> {
  if (!session.accessToken) return { ended: false, setCookies: [], logoutUrl: null };

  try {
    const response = await callAuth(
      '/logout',
      {
        method: 'POST',
        headers: { Cookie: iamCookieHeader(session) },
        body: JSON.stringify({ access_token: session.accessToken }),
      },
      clientIp
    );
    const setCookies = response.headers.getSetCookie();
    const body = (await response.json().catch(() => null)) as {
      data?: { provider_logout?: unknown; logout_url?: unknown };
    } | null;
    if (!response.ok) {
      logger.security(`IAM logout answered ${response.status}`);
      return { ended: false, setCookies, logoutUrl: null };
    }
    const logoutUrl =
      body?.data?.provider_logout !== true && typeof body?.data?.logout_url === 'string' && isAllowedRedirect(body.data.logout_url)
        ? body.data.logout_url
        : null;
    return { ended: true, setCookies, logoutUrl };
  } catch (error) {
    logger.error('IAM logout failed:', error);
    return { ended: false, setCookies: [], logoutUrl: null };
  }
}
