import { PortalShell } from '@/app/(portal-account)/components/PortalShell';
import { PortalSignIn } from '@/app/(portal-account)/login/components/PortalSignIn';
import { PORTALS } from '@/app/(portal-account)/login/portals';
import { listLoginProviders } from '@/lib/iamSession';

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Field Agent Login | Ethiopia OpenAgriNet Access to Credit',
  description: 'Log in to the Field Agent Portal to manage your agricultural lead pipeline and process credit applications.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DevelopmentAgentLoginPage() {
  // Loaded on the server: the browser never calls oan_auth_service directly.
  const providers = await listLoginProviders();

  return (
    <PortalShell badge={PORTALS['development-agent'].badge} backHref="/login">
      <PortalSignIn portal="development-agent" providers={providers} />
    </PortalShell>
  );
}
