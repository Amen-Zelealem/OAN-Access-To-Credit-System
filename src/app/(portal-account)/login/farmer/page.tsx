import { PortalShell } from '@/app/(portal-account)/components/PortalShell';
import { PortalSignIn } from '@/app/(portal-account)/login/components/PortalSignIn';
import { PORTALS } from '@/app/(portal-account)/login/portals';
import { listLoginProviders } from '@/lib/iamSession';

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Farmer Login | Ethiopia OpenAgriNet Access to Credit',
  description: 'Sign in to the Farmer Portal to browse loan offers and apply for credit.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function FarmerLoginPage() {
  // Loaded on the server: the browser never calls oan_auth_service directly.
  const providers = await listLoginProviders();

  return (
    <PortalShell badge={PORTALS['farmer'].badge} backHref="/login">
      <PortalSignIn portal="farmer" providers={providers} />
    </PortalShell>
  );
}
