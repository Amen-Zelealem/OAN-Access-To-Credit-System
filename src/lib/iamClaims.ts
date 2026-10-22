// Reads the expiry of an access token issued through an OpenG2P IAM service.
// A plain base64url decode, NOT a signature check: it only decides when to
// refresh. oan_auth_service verifies every API call.
//
// Nothing else is read from the token. Roles come from `/v1/auth/me`: identity
// providers without roles (eSignet) put none in the token, and the backend adds
// default roles the token never shows.

// `atob`/`TextDecoder`, not `Buffer`: this also runs in the Edge runtime (the
// routing middleware), where `Buffer` does not exist.
function base64UrlDecode(segment: string): string {
  const padded = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(segment.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** The token's `exp` in epoch seconds, or null if the token is malformed. */
export function decodeTokenExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as Record<string, unknown>;
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}
