// Shared by the server (lib/iamSession.ts) and the login pages in the browser,
// so it must stay free of browser-only and server-only imports.

/** oan_auth_service's own username and password login, which is not an IAM. */
export const LOCAL_LOGIN_KEY = 'local';

/**
 * Login options never offered on this app's login pages. `staff` is the
 * OpenG2P staff IAM: bank admins and bank agents sign in locally, and only
 * Development Agents and farmers sign in through IAM.
 */
export const HIDDEN_LOGIN_KEYS: ReadonlyArray<string> = ['staff'];

/** One entry of `GET /v1/auth/iam/providers`: one button on the login page. */
export interface LoginProvider {
  key: string;
  label: string;
  /** A same-origin path (`/api/files/...`), or empty: the page's CSP allows no other image origin. */
  iconUrl: string;
}
