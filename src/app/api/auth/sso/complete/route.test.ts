import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const TOKEN = 'header.payload.sig';
const AGENT = encodeURIComponent(JSON.stringify({ key: 'agent', cookie_prefix: 'agent-' }));

function complete(cookies: Record<string, string>, from = '/login/development-agent') {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return GET(
    new NextRequest(`http://localhost:3000/api/auth/sso/complete?from=${from}`, { headers: { cookie } })
  );
}

const me = (status: number, roles: string[] = []) =>
  new Response(JSON.stringify({ data: { user: 'u1', roles } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fetchMock = vi.fn();

describe('/api/auth/sso/complete', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://api.internal';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('decides access with /me, drops any local session, and answers a meta refresh', async () => {
    fetchMock.mockResolvedValue(me(200, ['A2C Development Agent']));

    const res = await complete({ login_option: AGENT, 'agent-X-Access-Token': TOKEN, auth_token: 'old' });

    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.internal/v1/auth/me');
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('url=/leads');
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/auth_token=;.*Max-Age=0/);
    expect(decodeURIComponent(cookies)).toContain('"kind":"dev_agent"');
  });

  it('sends a farmer to the farmer dashboard', async () => {
    fetchMock.mockResolvedValue(me(200, ['A2C Farmer']));

    const res = await complete({ login_option: AGENT, 'agent-X-Access-Token': TOKEN }, '/login/farmer');

    expect(await res.text()).toContain('url=/farmer-dashboard');
  });

  it('refuses a user with no role served through IAM, without logging them out of IAM', async () => {
    fetchMock.mockResolvedValue(me(200, ['A2C Bank Admin']));

    const res = await complete({ login_option: AGENT, 'agent-X-Access-Token': TOKEN }, '/login/farmer');

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/login/farmer?reason=sso_no_access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses when /me answers 401', async () => {
    fetchMock.mockResolvedValue(me(401));

    const res = await complete({ login_option: AGENT, 'agent-X-Access-Token': TOKEN });

    expect(res.headers.get('location')).toBe('/login/development-agent?reason=sso_no_access');
  });

  it('reports a failed sign-in without login_option or token', async () => {
    expect((await complete({ 'agent-X-Access-Token': TOKEN })).headers.get('location')).toContain('reason=sso_failed');
    expect((await complete({ login_option: AGENT })).headers.get('location')).toContain('reason=sso_failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a dropped access token cookie as too large', async () => {
    const res = await complete({ login_option: AGENT, 'agent-X-ID-Token': 'id.token.sig' });

    expect(res.headers.get('location')).toContain('reason=sso_token_too_large');
  });

  it('never goes back to a login page outside the SSO portals', async () => {
    const res = await complete({}, 'https://evil.example');

    expect(res.headers.get('location')).toBe('/login/development-agent?reason=sso_failed');
  });
});
