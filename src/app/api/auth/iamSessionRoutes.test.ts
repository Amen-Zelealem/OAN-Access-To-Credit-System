import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as logout } from './logout/route';
import { POST as refresh } from './refresh/route';

// The refresh and logout routes for an SSO (IAM) session: both go through
// oan_auth_service with the access token and only the option's IAM cookies.

const AGENT = encodeURIComponent(JSON.stringify({ key: 'agent', cookie_prefix: 'agent-', kind: 'dev_agent' }));
const SESSION = {
  login_option: AGENT,
  'agent-X-Access-Token': 'access.token.sig',
  'agent-X-Session-Id': 'sid',
  'agent-X-ID-Token': 'id.token.sig',
  // Another option's cookies and an unrelated one: never forwarded.
  'X-Access-Token': 'staff.token.sig',
  other: 'x',
};

let ip = 0;
function post(route: (request: NextRequest) => Promise<Response>, path: string, cookies: Record<string, string>) {
  ip += 1;
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return route(
    new NextRequest(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: { cookie, 'x-forwarded-for': `10.1.0.${ip}` },
    })
  );
}

const json = (status: number, body: object = {}, setCookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(setCookie ? { 'set-cookie': setCookie } : {}) },
  });

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.API_BASE_URL = 'http://api.internal';
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete process.env.API_BASE_URL;
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function expectOnlyOptionCookies() {
  const [, init] = fetchMock.mock.calls[0]!;
  expect(JSON.parse(init.body)).toEqual({ access_token: 'access.token.sig' });
  expect(new Headers(init.headers).get('cookie')).toBe(
    'agent-X-Access-Token=access.token.sig; agent-X-Session-Id=sid; agent-X-ID-Token=id.token.sig'
  );
}

describe('/api/auth/refresh with an SSO session', () => {
  it("forwards only the option's cookies and relays Set-Cookie", async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: { refreshed: true } }, 'agent-X-Access-Token=new.token.sig; Domain=.example.org; Path=/')
    );

    const res = await post(refresh, '/api/auth/refresh', SESSION);

    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.internal/v1/auth/refresh');
    expectOnlyOptionCookies();
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().join('\n')).toContain('agent-X-Access-Token=new.token.sig; Path=/; Domain=.example.org');
  });

  it('ends the session on a 401', async () => {
    fetchMock.mockResolvedValue(json(401));

    const res = await post(refresh, '/api/auth/refresh', SESSION);

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().join('\n')).toMatch(/login_option=;.*Max-Age=0/);
  });

  it('keeps the session on a 503', async () => {
    fetchMock.mockResolvedValue(json(503));

    const res = await post(refresh, '/api/auth/refresh', SESSION);

    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe('/api/auth/logout with an SSO session', () => {
  it("clears this app's cookies first, then applies IAM's, and returns the provider logout URL", async () => {
    fetchMock.mockResolvedValue(
      json(
        200,
        { data: { logged_out: true, provider_logout: false, logout_url: 'https://idp.example.org/logout' } },
        'agent-X-Access-Token=; Domain=.example.org; Path=/; Max-Age=0'
      )
    );

    const res = await post(logout, '/api/auth/logout', SESSION);

    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.internal/v1/auth/logout');
    expectOnlyOptionCookies();
    expect(await res.json()).toMatchObject({ iamSessionEnded: true, redirectTo: 'https://idp.example.org/logout' });
    const cookies = res.headers.getSetCookie();
    const index = (name: string) => cookies.findIndex((c) => c.startsWith(`${name}=`));
    expect(index('login_option')).toBeGreaterThanOrEqual(0);
    expect(index('agent-X-Access-Token')).toBeGreaterThan(index('login_option'));
    expect(cookies[index('agent-X-Access-Token')]).toContain('Domain=.example.org');
  });

  it('needs no navigation when the backend ended the provider session', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { logged_out: true, provider_logout: true } }));

    const res = await post(logout, '/api/auth/logout', SESSION);

    expect(await res.json()).toMatchObject({ iamSessionEnded: true, redirectTo: null });
  });

  it('still clears local cookies when oan_auth_service is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await post(logout, '/api/auth/logout', SESSION);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ iamSessionEnded: false, redirectTo: null });
    expect(res.headers.getSetCookie().join('\n')).toMatch(/login_option=;.*Max-Age=0/);
  });
});
