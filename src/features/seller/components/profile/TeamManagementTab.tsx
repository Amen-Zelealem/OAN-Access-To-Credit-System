'use client';
import { teamService } from '@/features/seller/api/team.service';
import type { TeamUser } from '@/lib/api/api.schemas';
import type { InviteTeamMemberPayload } from '@/features/seller/types/team.types';
import { toast } from '@/lib/toast';
import { ResetMemberPasswordModal } from '@/features/seller/components/profile/ResetMemberPasswordModal';
import { generateTemporaryPassword } from '@/features/seller/utils/team.utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { CheckCircle2, KeyRound, RefreshCw, Search, Trash2, UserPlus, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// fetchApi unwraps one layer of the raw response (see fetchApi.ts), so depending
// on how a given endpoint's payload is shaped, the resolved value can land as
// either a plain string or an { message } / { data: { message } } object.
// Check all three rather than assuming one, so a real backend message never
// silently loses to the hardcoded fallback.
function extractMessage(res: unknown): string | undefined {
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    const obj = res as { message?: unknown; data?: { message?: unknown } };
    if (typeof obj.data?.message === 'string') return obj.data.message;
    if (typeof obj.message === 'string') return obj.message;
  }
  return undefined;
}

// Backend returns a space-separated timestamp (e.g. "2026-07-31 16:07:09.337795").
// Normalise to ISO so Date parses it reliably across browsers, then show a
// compact local date/time. Falls back to "Never" when absent/unparseable.
function formatLastActive(value?: string | null): string {
  if (!value) return 'Never';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TeamManagementTab() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteTeamMemberPayload>({ email: '', full_name: '', role: 'A2C Bank Agent', password: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);
  const [resetTarget, setResetTarget] = useState<TeamUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await teamService.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteErrors({});
    try {
      const res = await teamService.inviteTeamMember(inviteForm);
      toast.success(extractMessage(res) || 'Team member invited successfully');
      setIsInviteModalOpen(false);
      setInviteForm({ email: '', full_name: '', role: 'A2C Bank Agent', password: '' });
      fetchUsers();
    } catch (err) {
      const details = (err as { responseData?: { message?: { details?: Record<string, string> } } }).responseData?.message?.details;
      if (details) {
        setInviteErrors(details);
      }
      toast.error((err instanceof Error && err.message) || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  };

  const toggleUserStatus = async (email: string, currentEnabled: boolean) => {
    try {
      await teamService.updateUser({ email, enabled: !currentEnabled });
      toast.success(`Team member ${!currentEnabled ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || 'Failed to update team member status');
    }
  };

  const closeInviteModal = useCallback(() => {
    setIsInviteModalOpen(false);
    setInviteErrors({});
  }, []);

  // Focus trap, Escape-to-close and scroll lock for the invite dialog. Declared
  // at component level (not inside the conditional render) because it's a hook —
  // `isInviteModalOpen` is what turns the behavior on.
  const inviteModalRef = useModalA11y<HTMLDivElement>(isInviteModalOpen, closeInviteModal);

  const openInviteModal = () => {
    setInviteForm({ email: '', full_name: '', role: 'A2C Bank Agent', password: '' });
    setInviteErrors({});
    setIsInviteModalOpen(true);
  };

  if (loading) return <div className="py-12 text-center text-gray-500 font-medium">Loading team members...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Team Members</h3>
          <p className="text-sm text-gray-500">Manage your team&apos;s access and roles within the platform.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search members..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
            />
          </div>
          <button 
            onClick={openInviteModal}
            className="bg-[#16A34A] hover:bg-[#15803d] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.email} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0">
                        {user.first_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{user.first_name || user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                      {user.role || 'Agent'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {user.enabled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-green-700 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500 font-medium">Inactive</span>
                        </>
                      )}
                    </div>
                    {/* Still on the temporary password the admin issued — i.e. a
                        credential someone other than the member knows. */}
                    {user.must_change_password && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                        <KeyRound className="w-3 h-3" aria-hidden="true" />
                        Pending password setup
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatLastActive(user.last_active)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setResetTarget(user)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Issue a new temporary password"
                      >
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        <span className="sr-only">Reset password for {user.first_name || user.email}</span>
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user.email, !!user.enabled)}
                        className={`p-1.5 rounded-lg transition-colors ${user.enabled ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={user.enabled ? 'Deactivate team member' : 'Activate team member'}
                      >
                        {user.enabled ? <Trash2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span className="sr-only">
                          {user.enabled ? 'Deactivate' : 'Activate'} {user.first_name || user.email}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No team members found. Invite someone to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            ref={inviteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-member-title"
            tabIndex={-1}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 id="invite-member-title" className="font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={closeInviteModal} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={inviteForm.full_name}
                  onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                  className={`w-full px-3 py-2 bg-white border ${inviteErrors.full_name ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500`}
                />
                {inviteErrors.full_name && <p className="mt-1 text-xs text-red-500">{inviteErrors.full_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input 
                  type="email" 
                  required
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className={`w-full px-3 py-2 bg-white border ${inviteErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500`}
                />
                {inviteErrors.email && <p className="mt-1 text-xs text-red-500">{inviteErrors.email}</p>}
              </div>
              {/* Not a choice: a Bank Admin can only add Bank Agents. Offering a
                  "Bank Admin" option would just collect a 400 from the backend. */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Role</label>
                <p className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  Bank Agent (Read/Write)
                </p>
                {inviteErrors.role && <p className="mt-1 text-xs text-red-500">{inviteErrors.role}</p>}
              </div>
              <div>
                <label htmlFor="invite-temp-password" className="block text-sm font-medium text-gray-900 mb-1.5">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="invite-temp-password"
                    type="text"
                    required
                    minLength={8}
                    value={inviteForm.password}
                    onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))}
                    className={`flex-1 px-3 py-2 bg-white border ${inviteErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green`}
                  />
                  <button
                    type="button"
                    onClick={() => setInviteForm(f => ({ ...f, password: generateTemporaryPassword() }))}
                    title="Generate a new password"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Generate a new password</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Share this with the agent. They must set their own password the first time they sign in.
                </p>
                {inviteErrors.password && <p className="mt-1 text-xs text-red-500">{inviteErrors.password}</p>}
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeInviteModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={inviting}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-lg hover:bg-[#15803d] disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <ResetMemberPasswordModal
          member={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={fetchUsers}
        />
      )}
    </div>
  );
}
