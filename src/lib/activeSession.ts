import { readIamSession, type IamSession } from '@/lib/iamSession';

// An SSO (IAM) session as this app sees it. Local sessions keep their own
// cookies and code paths (lib/session.ts); this only answers "does the request
// carry an IAM session that belongs to this app?".
//
// A single sign-on session reaches every app on the shared parent domain,
// including users provisioned only for another one. Only a user the landing
// route found holding a role of this app (`login_option.kind`, from `/me`)
// counts as signed in here; anyone else is a guest, and their session is left
// alone for the apps it is for.
//
// An IAM session is not idle-managed here: its idle and maximum lifetime are
// the identity provider's, and ending it would sign the person out of every
// OpenG2P app.

interface CookieReader {
  cookies: { get(name: string): { value: string } | undefined };
}

/** The request's IAM session when it belongs to this app, else null. */
export function readAppIamSession(request: CookieReader): IamSession | null {
  const iam = readIamSession(request);
  return iam?.option.kind ? iam : null;
}
