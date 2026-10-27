import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginProvider } from '@/lib/loginOptions';

import { SsoSignIn } from './SsoSignIn';

const assign = vi.fn();

// Outside Next there is no router context: the query each test wants is set here.
let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

// The password form needs the Redux store and router; what matters here is
// whether it is rendered and what it carries above it.
vi.mock('@/features/auth/components/PortalLoginForm', () => ({
  PortalLoginForm: ({ beforeForm }: { beforeForm?: React.ReactNode }) => (
    <div>
      {beforeForm}
      <form aria-label="password form" />
    </div>
  ),
}));

const FORM = { subtitle: 'x', allowedKinds: [], redirectTo: () => '/' };

const provider = (key: string, label: string, iconUrl = ''): LoginProvider => ({ key, label, iconUrl });

function renderSignIn(providers: LoginProvider[] | null) {
  return render(<SsoSignIn loginPath="/login/farmer" providers={providers} form={FORM} />);
}

afterEach(() => {
  cleanup();
  search = '';
});

describe('SsoSignIn login options', () => {
  it('renders one link per option in order, without staff', () => {
    renderSignIn([provider('beneficiary', 'Sign in with Fayda'), provider('staff', 'Staff'), provider('agent', 'Agent')]);

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Sign in with Fayda', 'Agent']);
    expect(links[0]).toHaveAttribute('href', '/api/auth/sso/login?key=beneficiary&from=%2Flogin%2Ffarmer');
    expect(screen.queryByRole('form', { name: 'password form' })).not.toBeInTheDocument();
  });

  it('renders the password form for local', () => {
    renderSignIn([provider('beneficiary', 'Fayda'), provider('local', 'Password')]);

    expect(screen.getByRole('form', { name: 'password form' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('says so when no option is configured', () => {
    renderSignIn([provider('staff', 'Staff')]);

    expect(screen.getByText('No sign-in method is configured.')).toBeInTheDocument();
  });

  it('renders an error, not a crash, when the options could not be loaded', () => {
    renderSignIn(null);

    expect(screen.getByText(/Sign-in options could not be loaded/)).toBeInTheDocument();
  });

  it('shows the icon when there is one', () => {
    const { container } = renderSignIn([provider('agent', 'Agent', '/api/files/agent.png')]);

    expect(container.querySelector('img')).toHaveAttribute('src', '/api/files/agent.png');
  });
});

describe('SsoSignIn after an SSO sign-in with no access here', () => {
  beforeEach(() => {
    search = '?reason=sso_no_access';
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, assign },
    });
    assign.mockReset();
  });

  const switchButton = () => screen.findByRole('button', { name: 'Sign out and use a different account' });

  it("ends the SSO session and follows the identity provider's logout URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, iamSessionEnded: true, redirectTo: 'https://idp.example.org/logout' }))
    );
    global.fetch = fetchMock;
    renderSignIn([provider('agent', 'Agent')]);

    fireEvent.click(await switchButton());

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://idp.example.org/logout'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('reloads the login page when the backend ended the provider session itself', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true, iamSessionEnded: true, redirectTo: null })));
    renderSignIn([provider('agent', 'Agent')]);

    fireEvent.click(await switchButton());

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/login/farmer'));
  });

  it('says so when the SSO session could not be ended', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true, iamSessionEnded: false, redirectTo: null })));
    renderSignIn([provider('agent', 'Agent')]);

    fireEvent.click(await switchButton());

    expect(await screen.findByText(/Could not sign you out of the SSO account/)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Sign out and use a different account' })).not.toBeInTheDocument();
  });

  it('shows no message and does not offer it for other SSO failures', () => {
    search = '?reason=sso_failed';
    renderSignIn([provider('agent', 'Agent')]);

    expect(screen.queryByText('Sign-in failed. Please try again.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out and use a different account' })).not.toBeInTheDocument();
  });
});
