import { AlertTriangle } from 'lucide-react';
import { useMyOrgSuspension } from '@/hooks/useMyOrgSuspension';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

/**
 * Persistent banner shown when the current user belongs to a suspended organization.
 * Platform admins are exempt (they need to manage the suspension).
 */
export function OrgSuspendedBanner() {
  const { role } = useAuth();
  const { data } = useMyOrgSuspension();

  if (role === 'admin') return null;
  if (!data?.suspended) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">
          {data.orgName ? `${data.orgName}'s` : "Your organization's"} access is currently suspended.
        </p>
        <p className="text-destructive/90 mt-0.5">
          You can view existing data, but cannot submit new requests, messages, or updates
          until access is reinstated.
          {data.suspendedAt && (
            <span className="opacity-80"> Suspended on {format(new Date(data.suspendedAt), 'MMM d, yyyy')}.</span>
          )}
        </p>
        {data.reason && (
          <p className="mt-1 text-destructive/80">
            <span className="font-medium">Reason:</span> {data.reason}
          </p>
        )}
      </div>
    </div>
  );
}

/** Small hook to disable write actions for suspended members. */
export function useWriteGuard() {
  const { role } = useAuth();
  const { data } = useMyOrgSuspension();
  const blocked = role !== 'admin' && !!data?.suspended;
  return {
    blocked,
    tooltip: blocked ? "Your organization's access is suspended" : undefined,
  };
}
