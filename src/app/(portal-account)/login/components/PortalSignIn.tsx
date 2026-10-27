'use client';

import { RoleTabs } from '@/app/(portal-account)/login/components/RoleTabs';
import { PORTALS, type PortalId } from '@/app/(portal-account)/login/portals';
import { PortalLoginForm } from '@/features/auth/components/PortalLoginForm';
import { SsoSignIn } from '@/features/auth/components/SsoSignIn';
import { LOCAL_LOGIN_KEY, type LoginProvider } from '@/lib/loginOptions';

/**
 * Renders one portal's sign-in pane from its entry in `PORTALS`.
 *
 * This is the whole of what the four per-role wrapper components used to do.
 */
export function PortalSignIn({ portal, providers = null }: { portal: PortalId; providers?: LoginProvider[] | null }) {
  const { roleTabs, iamLogin, iamKeys, form } = PORTALS[portal];

  if (iamLogin) {
    // This portal's own IAM option when oan_auth_service offers one (and then no
    // password form); otherwise the password form alone.
    const own = providers?.find((p) => iamKeys?.includes(p.key));
    const offered = providers && (own ? [own] : providers.filter((p) => p.key === LOCAL_LOGIN_KEY));
    return <SsoSignIn loginPath={`/login/${portal}`} providers={offered ?? null} form={form} />;
  }

  if (!roleTabs) return <PortalLoginForm {...form} />;

  return (
    <div className="w-full flex flex-col">
      <RoleTabs />
      <PortalLoginForm {...form} />
    </div>
  );
}
