import { useState } from 'react';
import { 
  Copy, 
  Clock, 
  Trash2, 
  AlertTriangle, 
  Send,
  Mail,
  Loader2,
  GraduationCap,
  UserCheck,
  Shield,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { usePendingInvitations, useRevokeInvitation, useInvitationsRealtime, type Invitation } from '@/hooks/useInvitations';
import type { AppRole } from '@/types/database';
import { cn } from '@/lib/utils';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';

const roleIcons: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  case_manager: UserCheck,
  admin: Shield,
};

const roleColors: Record<AppRole, string> = {
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  case_manager: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export function PendingInvitationsSection() {
  const { toast } = useToast();
  const { data: rawPendingInvitations, isLoading } = usePendingInvitations();
  const revokeInvitation = useRevokeInvitation();
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null);
  const { filters: globalFilters } = useGlobalFilters();
  const pendingInvitations = (rawPendingInvitations || []).filter((inv) => {
    if (globalFilters.role.length && !globalFilters.role.includes(inv.invited_role)) return false;
    if (globalFilters.organizationId.length) {
      if (!inv.organization_id || !globalFilters.organizationId.includes(inv.organization_id)) return false;
    }
    return true;
  });

  // Live-refresh the pending list when the signup trigger flips accepted_at,
  // or when another admin revokes/sends an invite.
  useInvitationsRealtime();

  const copyInvitationLink = (token: string) => {
    const url = `${window.location.origin}/auth?tab=signup&invite=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied to clipboard' });
  };

  const handleRevoke = async () => {
    if (!invitationToRevoke) return;
    await revokeInvitation.mutateAsync(invitationToRevoke.id);
    setInvitationToRevoke(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations awaiting acceptance
            </CardDescription>
          </div>
          <Badge variant="outline">
            {pendingInvitations?.length || 0} pending
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !pendingInvitations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending invitations
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => {
                    const expiresAt = new Date(invitation.expires_at);
                    const isExpiringSoon = expiresAt < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
                    const isExpired = expiresAt < new Date();
                    const RoleIcon = roleIcons[invitation.invited_role];

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{invitation.email}</span>
                          </div>
                          {invitation.notes && (
                            <p className="text-xs text-muted-foreground mt-1 ml-6 truncate max-w-[200px]">
                              {invitation.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('gap-1', roleColors[invitation.invited_role])}>
                            <RoleIcon className="h-3 w-3" />
                            <span className="capitalize">{invitation.invited_role.replace('_', ' ')}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "flex items-center gap-1 text-sm",
                            isExpired && "text-destructive",
                            isExpiringSoon && !isExpired && "text-amber-600"
                          )}>
                            {(isExpiringSoon || isExpired) && <AlertTriangle className="h-3 w-3" />}
                            <Clock className="h-3 w-3" />
                            {isExpired ? (
                              <span>Expired</span>
                            ) : (
                              <span>{formatDistanceToNow(expiresAt, { addSuffix: true })}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(invitation.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation.token)}
                              disabled={isExpired}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setInvitationToRevoke(invitation)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog 
        open={!!invitationToRevoke} 
        onOpenChange={(open) => !open && setInvitationToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for <strong>{invitationToRevoke?.email}</strong>? 
              They will no longer be able to use their invitation link to sign up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeInvitation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeInvitation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeInvitation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
