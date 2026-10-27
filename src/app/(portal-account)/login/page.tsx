import { PortalShell } from '@/app/(portal-account)/components/PortalShell';
import { LoginForm } from '@/app/(portal-account)/login/components/LoginForm';
import { listLoginProviders } from '@/lib/iamSession';

export default async function LoginPage() {
  // Loaded on the server: the browser never calls oan_auth_service directly.
  const providers = await listLoginProviders();

  return (
    <PortalShell>
      <LoginForm providers={providers} />
    </PortalShell>
  );
}
