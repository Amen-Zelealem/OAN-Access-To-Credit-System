import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

let ip = 0;
function start(query: string) {
  // A fresh client per request, so the rate limiter never interferes.
  ip += 1;
  return GET(
    new NextRequest(`http://localhost:3000/api/auth/sso/login?${query}`, {
      headers: { 'x-forwarded-for': `10.0.0.${ip}` },
    })
  );
}

const json = (status: number, body: object = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = vi.fn();

describe('/api/auth/sso/login', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://api.internal';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('takes the landing origin from the browser, not the server bind address', async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: { redirect_url: 'https://idp.example.org/auth', iam: 'agent', cookie_prefix: 'agent-' } })
    );

    await start(`key=agent&from=/login/farmer&origin=${encodeURIComponent('https://a2c.example.org')}`);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body).return_url).toBe('https://a2c.example.org/api/auth/sso/complete?from=%2Flogin%2Ffarmer');
  });

  it('starts the option with an absolute landing URL and records login_option', async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: { redirect_url: 'https://idp.example.org/auth?x=1', iam: 'agent', cookie_prefix: 'agent-' } })
    );

    const res = await start('key=agent&from=/login/farmer');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.internal/v1/auth/iam/login');
    expect(JSON.parse(init.body)).toEqual({
      key: 'agent',
      return_url: 'http://localhost:3000/api/auth/sso/complete?from=%2Flogin%2Ffarmer',
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://idp.example.org/auth?x=1');
    const cookie = decodeURIComponent(res.headers.getSetCookie().join('\n'));
    expect(cookie).toContain('login_option={"key":"agent","cookie_prefix":"agent-"}');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it.each([
    [400, 'sso_unavailable'],
    [502, 'sso_failed'],
    [503, 'sso_down'],
  ])('maps a %i from oan_auth_service to %s', async (status, reason) => {
    fetchMock.mockResolvedValue(json(status));

    const res = await start('key=agent&from=/login/farmer');

    expect(res.headers.get('location')).toBe(`/login/farmer?reason=${reason}`);
    expect(res.headers.getSetCookie().join('\n')).not.toContain('login_option=');
  });

  it('refuses a redirect_url that is not https', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { redirect_url: 'javascript:alert(1)', cookie_prefix: '' } }));

    const res = await start('key=agent');

    expect(res.headers.get('location')).toBe('/login/development-agent?reason=sso_failed');
  });

  it('never starts the local option or a malformed key', async () => {
    expect((await start('key=local')).headers.get('location')).toContain('reason=sso_unavailable');
    expect((await start('key=../x')).headers.get('location')).toContain('reason=sso_unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
