import { NextResponse } from 'next/server';

/**
 * A redirect to a path on this app, sent as a relative `Location` that the
 * browser resolves against the URL it actually used. A route handler's
 * `request.url` carries the server's bind address (`next start -H 0.0.0.0`
 * gives `0.0.0.0:3000`), not the public host, so an absolute redirect built
 * from it sends the browser nowhere. `proxy.ts` doesn't need this: Next
 * relativizes same-origin redirects from the proxy itself.
 */
export function relativeRedirect(path: string, status: 303 | 307 = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}
