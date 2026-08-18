'use client';

import { selectAuthStatus } from '@/features/auth/store/authSlice';
import { useAppSelector } from '@/store/hooks';

export default function BankAgentLayout({ children }: { children: React.ReactNode }) {
  const authStatus = useAppSelector(selectAuthStatus);
  // getMeThunk (dispatched on app mount) hasn't resolved yet — mounting the
  // dashboard chrome (which reads officerName off this same session) before
  // then risks it hydrating after the session resolves client-side but before
  // the server-rendered (unresolved) HTML is compared, which mismatches and
  // forces a client rebuild that flashes the generic role name. Matches the
  // same gate BankAdminLayout and DevAgentLayout use for the same reason.
  const authResolved = authStatus === 'succeeded' || authStatus === 'failed';

  if (!authResolved) {
    return null;
  }

  return <>{children}</>;
}
