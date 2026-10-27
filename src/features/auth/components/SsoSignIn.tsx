'use client';

import { SessionEndedNotice } from '@/components/SessionEndedNotice';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { endServerSession } from '@/features/auth/api/authApi';
import { PortalLoginForm, type PortalLoginFormProps } from '@/features/auth/components/PortalLoginForm';
import { HIDDEN_LOGIN_KEYS, LOCAL_LOGIN_KEY, type LoginProvider } from '@/lib/loginOptions';
import { ArrowRight, LogOut } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

// Why `/api/auth/sso/*` sent the person back here (see lib/ssoRedirect.ts).
// None of them echo server error text.
const SSO_ERRORS: Record<string, string> = {
  sso_unavailable: 'This sign-in method is not available.',
  sso_failed: 'Sign-in failed. Please try again.',
  sso_down: 'Sign-in is temporarily unavailable. Please try again shortly.',
  sso_no_access: 'Your account does not have access to this portal. Ask your administrator for access.',
  sso_token_too_large: 'Your account has too many roles to sign in here. Contact an administrator.',
};

const PROVIDERS_FAILED = 'Sign-in options could not be loaded. Please try again shortly.';
const NONE_CONFIGURED = 'No sign-in method is configured.';
const SWITCH_FAILED =
  'Could not sign you out of the SSO account. Sign out from the other OpenG2P app, then try again.';

export interface SsoSignInProps {
  /** This portal's login page: where IAM failures come back to. */
  loginPath: string;
  /** `GET /v1/auth/iam/providers`, in display order; null when it could not be loaded. */
  providers: LoginProvider[] | null;
  /** The portal's username and password form, shown when the list has a `local` entry. */
  form: PortalLoginFormProps;
}

/**
 * Sign-in for portals whose users can authenticate through the IAM login
 * options oan_auth_service lists: one button per option, in the order listed,
 * and the portal's password form when the list includes `local`. Options in
 * `HIDDEN_LOGIN_KEYS` are not offered.
 *
 * Each button is a page navigation to `/api/auth/sso/login`, not a fetch: the
 * browser has to follow the identity provider's redirects.
 */
export function SsoSignIn({ loginPath, providers, form }: SsoSignInProps) {
  const options = providers?.filter((p) => !HIDDEN_LOGIN_KEYS.includes(p.key)) ?? null;
  const hasLocal = !!options?.some((p) => p.key === LOCAL_LOGIN_KEY);
  const buttons = options?.filter((p) => p.key !== LOCAL_LOGIN_KEY) ?? [];

  const optionsProps: IamOptionsProps = {
    loginPath,
    buttons,
    notice: options === null ? PROVIDERS_FAILED : options.length === 0 ? NONE_CONFIGURED : undefined,
    withDivider: hasLocal && buttons.length > 0,
  };

  if (hasLocal) return <PortalLoginForm {...form} beforeForm={<IamOptions {...optionsProps} />} />;

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-0 sm:px-0 max-w-lg mx-auto w-full">
      <div className="w-full flex flex-col items-center text-center mb-8">
        <h2 className="text-[28px] sm:text-[32px] font-bold text-[#1F2937] mb-2 tracking-tight">
          {form.heading ?? 'Welcome Back'}
        </h2>
        <p className="text-[#6B7280] text-[14px] sm:text-[15px] font-medium px-2 sm:px-0 w-full sm:w-auto md:max-w-[280px] mx-auto">
          {form.subtitle}
        </p>
      </div>
      <IamOptions {...optionsProps} standalone />
    </div>
  );
}

interface IamOptionsProps {
  loginPath: string;
  buttons: LoginProvider[];
  /** Shown instead of an SSO failure when there is nothing to sign in with. */
  notice?: string | undefined;
  /** An "or" between these buttons and the password form below them. */
  withDivider: boolean;
  /** Not inside the password form, which shows its own session notice. */
  standalone?: boolean;
}

function IamOptions({ loginPath, buttons, notice, withDivider, standalone = false }: IamOptionsProps) {
  const reason = useSearchParams().get('reason');
  const [switchFailed, setSwitchFailed] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const errorMessage = switchFailed ? SWITCH_FAILED : (reason && SSO_ERRORS[reason]) || notice;
  // Signed in at IAM with an account that has no role here: SSO would sign the
  // same account straight back in, so the way out has to end that session first.
  const showSwitch = reason === 'sso_no_access' && !switchFailed;

  // Ends the SSO session at IAM and the identity provider. The backend ends
  // the provider session itself when it can; otherwise it returns the
  // provider's logout URL to visit. If IAM could not be reached the provider
  // session lives on, so say so instead of pretending it worked.
  const switchAccount = async () => {
    setIsSwitching(true);
    const { cleared, redirectTo, iamSessionEnded } = await endServerSession();
    if (redirectTo) {
      window.location.assign(redirectTo);
      return;
    }
    if (cleared && iamSessionEnded) {
      window.location.assign(loginPath);
      return;
    }
    setIsSwitching(false);
    setSwitchFailed(true);
  };

  return (
    <div className="w-full flex flex-col">
      {standalone && <SessionEndedNotice suppressed={!!errorMessage} />}

      {errorMessage && <ErrorAlert className="mb-6 w-full">{errorMessage}</ErrorAlert>}

      {showSwitch && (
        <div className="w-full mb-6 flex flex-col gap-3">
          <p className="text-[13px] text-[#6B7280]">
            You are signed in with an SSO account that has no access here. Signing out also signs you out of the
            registry and other OpenG2P apps.
          </p>
          <Button
            type="button"
            variant="outline"
            size="none"
            isLoading={isSwitching}
            onClick={() => void switchAccount()}
            className="w-full py-3 text-[14px] space-x-2"
          >
            {!isSwitching && <LogOut size={18} strokeWidth={2.25} aria-hidden="true" />}
            <span className="font-semibold">{isSwitching ? 'Signing out…' : 'Sign out and use a different account'}</span>
          </Button>
        </div>
      )}

      <div className="w-full flex flex-col gap-3">
        {buttons.map((option) => {
          const isNavigating = navigatingTo === option.key;
          const query = (origin?: string) => new URLSearchParams({ key: option.key, from: loginPath, ...(origin ? { origin } : {}) });
          const href = `/api/auth/sso/login?${query()}`;
          return (
            <Button
              key={option.key}
              as="a"
              href={href}
              size="none"
              isLoading={isNavigating}
              onClick={(event) => {
                event.preventDefault();
                setNavigatingTo(option.key);
                // Carry the origin the browser is on: the server only sees its bind address.
                // A route handler that redirects to the identity provider, not a page.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign(`/api/auth/sso/login?${query(window.location.origin)}`);
              }}
              className="w-full py-4 text-[14px] space-x-2 active:scale-[0.98]"
            >
              {option.iconUrl && !isNavigating && (
                // A tiny same-origin icon; next/image would add nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.iconUrl} alt="" className="h-5 w-5 object-contain" />
              )}
              <span className="font-semibold">{isNavigating ? 'Redirecting…' : option.label}</span>
              {!isNavigating && <ArrowRight size={18} strokeWidth={2.5} />}
            </Button>
          );
        })}
      </div>

      {withDivider && (
        <div className="w-full flex items-center gap-3 my-6 text-[13px] font-medium text-[#9CA3AF]">
          <span className="h-px flex-1 bg-[#E5E7EB]" />
          or
          <span className="h-px flex-1 bg-[#E5E7EB]" />
        </div>
      )}
    </div>
  );
}
