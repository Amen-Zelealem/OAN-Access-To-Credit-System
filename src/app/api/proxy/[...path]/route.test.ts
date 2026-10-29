import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from './route';

function iamToken(expOffsetSeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode({
    sub: 'kc-user-1',
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
  })}.sig`;
}

function loginOption(value: object): string {
  return encodeURIComponent(JSON.stringify(value));
}

const AGENT = loginOption({ key: 'agent', cookie_prefix: 'agent-', kind: 'dev_agent' });

function cookieHeader(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function get(cookies: Record<string, string>) {
  return GET(new NextRequest('http://localhost:3000/api/proxy/v1/leads', { headers: { cookie: cookieHeader(cookies) } }), {
    params: Promise.resolve({ path: ['v1', 'leads'] }),
  });
}

const json = (status: number, body: object = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const fetchMock = vi.fn();
const bearer = (call: number) => new Headers(fetchMock.mock.calls[call]![1].headers).get('authorization');

describe('/api/proxy with an SSO (IAM) session', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://api.internal';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.API_BASE_URL;
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the login option's access token as a Bearer token, and no browser cookies", async () => {
    const token = iamToken(300);
    fetchMock.mockResolvedValue(json(200));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': token, 'agent-X-Session-Id': 'sid' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.internal/v1/leads');
    expect(bearer(0)).toBe(`Bearer ${token}`);
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get('cookie')).toBeNull();
  });

  it('reads only the token named by login_option when two options are signed in', async () => {
    const agentToken = iamToken(300);
    fetchMock.mockResolvedValue(json(200));

    await get({
      login_option: AGENT,
      'X-Access-Token': iamToken(300),
      'X-Session-Id': 'staff-sid',
      'agent-X-Access-Token': agentToken,
      'agent-X-Session-Id': 'sid',
    });

    expect(bearer(0)).toBe(`Bearer ${agentToken}`);
  });

  it('refreshes an expired token through oan_auth_service first, and relays the new cookie', async () => {
    const expired = iamToken(-60);
    const fresh = iamToken(300);
    fetchMock
      .mockResolvedValueOnce(
        json(200, { data: { refreshed: true } }, { 'set-cookie': `agent-X-Access-Token=${fresh}; Path=/; Max-Age=2100` })
      )
      .mockResolvedValueOnce(json(200));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': expired, 'agent-X-Session-Id': 'sid' });

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[0]!;
    expect(refreshUrl).toBe('http://api.internal/v1/auth/refresh');
    expect(JSON.parse(refreshInit.body)).toEqual({ access_token: expired });
    expect(new Headers(refreshInit.headers).get('cookie')).toBe(
      `agent-X-Access-Token=${expired}; agent-X-Session-Id=sid`
    );
    expect(bearer(1)).toBe(`Bearer ${fresh}`);
    expect(res.headers.getSetCookie().join('\n')).toContain(`agent-X-Access-Token=${fresh}`);
  });

  it('answers 503 and keeps the session when IAM is down', async () => {
    fetchMock.mockResolvedValueOnce(json(503));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': iamToken(-60), 'agent-X-Session-Id': 'sid' });

    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.headers.getSetCookie().join('\n')).not.toContain('login_option=');
  });

  it('ends the session when the refresh is refused', async () => {
    fetchMock.mockResolvedValueOnce(json(401));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': iamToken(-60), 'agent-X-Session-Id': 'sid' });

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().join('\n')).toMatch(/login_option=;.*Max-Age=0/);
  });

  it('refreshes once on a 401 and retries with the new token', async () => {
    const old = iamToken(300);
    const fresh = iamToken(600);
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(
        json(200, { data: { refreshed: true } }, { 'set-cookie': `agent-X-Access-Token=${fresh}; Path=/` })
      )
      .mockResolvedValueOnce(json(200));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': old, 'agent-X-Session-Id': 'sid' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bearer(2)).toBe(`Bearer ${fresh}`);
  });

  it('does not retry when the refresh hands back the same token', async () => {
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(200, { data: { refreshed: false } }));

    const res = await get({ login_option: AGENT, 'agent-X-Access-Token': iamToken(300), 'agent-X-Session-Id': 'sid' });

    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores an IAM session the landing route did not accept', async () => {
    fetchMock.mockResolvedValue(json(200));

    await get({
      login_option: loginOption({ key: 'agent', cookie_prefix: 'agent-' }),
      'agent-X-Access-Token': iamToken(300),
      'agent-X-Session-Id': 'sid',
    });

    expect(bearer(0)).toBeNull();
  });

  it('prefers a local session over an IAM session', async () => {
    fetchMock.mockResolvedValue(json(200));

    await get({
      auth_token: 'local.jwt.token',
      session_activity: '1',
      login_option: AGENT,
      'agent-X-Access-Token': iamToken(300),
      'agent-X-Session-Id': 'sid',
    });

    expect(bearer(0)).toBe('Bearer local.jwt.token');
  });

  it('refuses a state-changing request from another origin', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/proxy/v1/leads', {
        method: 'POST',
        headers: {
          cookie: cookieHeader({ login_option: AGENT, 'agent-X-Access-Token': iamToken(300) }),
          origin: 'https://evil.example',
          'sec-fetch-site': 'cross-site',
        },
        body: '{}',
      }),
      { params: Promise.resolve({ path: ['v1', 'leads'] }) }
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
