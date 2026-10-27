'use client';

import { RoleTabs } from '@/app/(portal-account)/login/components/RoleTabs';
import { PORTALS, type PortalId } from '@/app/(portal-account)/login/portals';
import { PortalLoginForm } from '@/features/auth/components/PortalLoginForm';
import { SsoSignIn } from '@/features/auth/components/SsoSignIn';
import { LOCAL_LOGIN_KEY, type LoginProvider } from '@/lib/loginOptions';
import { useSearchParams } from 'next/navigation';

const LOCAL_PROVIDER: LoginProvider = { key: LOCAL_LOGIN_KEY, label: 'Password', iconUrl: '' };
/** IAM failures after which the IAM button is hidden and the password form is shown. */
const SSO_FALLBACK_REASONS = ['sso_down', 'sso_failed', 'sso_unavailable'];

/**
 * Renders one portal's sign-in pane from its entry in `PORTALS`.
 *
 * This is the whole of what the four per-role wrapper components used to do.
 */
export function PortalSignIn({ portal, providers = null }: { portal: PortalId; providers?: LoginProvider[] | null }) {
  const { roleTabs, iamLogin, iamKeys, form } = PORTALS[portal];

  const reason = useSearchParams().get('reason');

  if (iamLogin) {
    // This portal's own IAM option when oan_auth_service offers it, and then no
    // password form. The password form alone is the way in when the option is not
    // offered, the list could not be loaded, or the IAM sign-in just failed (the
    // IAM button is hidden then; the error still shows above the form).
    const local = providers?.find((p) => p.key === LOCAL_LOGIN_KEY) ?? LOCAL_PROVIDER;
    const own = providers?.find((p) => iamKeys?.includes(p.key));
    const ssoFailed = !!reason && SSO_FALLBACK_REASONS.includes(reason);
    const offered = own && !ssoFailed ? [own] : [local];
    return <SsoSignIn loginPath={`/login/${portal}`} providers={offered} form={form} />;
  }

  if (!roleTabs) return <PortalLoginForm {...form} />;

  return (
    <div className="w-full flex flex-col">
      <RoleTabs />
      <PortalLoginForm {...form} />
    </div>
  );
}
