import { useState } from 'react';
import { Search, UserCog, Shield, GraduationCap, Briefcase, Loader2, History, Power } from 'lucide-react';
import { useUsers, useUpdateUserRole, useSetUserActive, useUserStatusHistory, type UserWithRole } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from '@/types/database';
import { format } from 'date-fns';

const roleConfig: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  org_admin: { label: 'Org Admin', icon: Shield, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  case_manager: { label: 'Case Manager', icon: Briefcase, color: 'bg-primary/10 text-primary border-primary/20' },
  student: { label: 'Student', icon: GraduationCap, color: 'bg-muted text-muted-foreground border-border' },
};

type StatusFilter = 'all' | 'active' | 'inactive';

export function UserManagement() {
  const { user } = useAuth();
  const { data: users, isLoading, error } = useUsers();
  const updateRole = useUpdateUserRole();
  const setActive = useSetUserActive();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
    newRole: AppRole | null;
  }>({ open: false, user: null, newRole: null });

  const [statusDialog, setStatusDialog] = useState<{ open: boolean; user: UserWithRole | null; nextActive: boolean }>({
    open: false, user: null, nextActive: true,
  });
  const [reason, setReason] = useState('');

  const [historyUserId, setHistoryUserId] = useState<string | null>(null);

  const filteredUsers = users?.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'inactive' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  const handleRoleChange = (userToUpdate: UserWithRole, newRole: AppRole) => {
    if (userToUpdate.role === newRole) return;
    setConfirmDialog({ open: true, user: userToUpdate, newRole });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog.user || !confirmDialog.newRole) return;
    try {
      await updateRole.mutateAsync({
        userId: confirmDialog.user.user_id,
        newRole: confirmDialog.newRole,
      });
      toast({
        title: 'Role updated',
        description: `${confirmDialog.user.full_name || confirmDialog.user.email} is now a ${roleConfig[confirmDialog.newRole]?.label ?? confirmDialog.newRole}.`,
      });
    } catch {
      toast({ title: 'Failed to update role', description: 'Please try again or check your permissions.', variant: 'destructive' });
    } finally {
      setConfirmDialog({ open: false, user: null, newRole: null });
    }
  };

  const openStatusDialog = (u: UserWithRole) => {
    setReason('');
    setStatusDialog({ open: true, user: u, nextActive: !u.is_active });
  };

  const confirmStatusChange = async () => {
    if (!statusDialog.user) return;
    try {
      await setActive.mutateAsync({
        userId: statusDialog.user.user_id,
        active: statusDialog.nextActive,
        reason: reason.trim() || undefined,
      });
      toast({
        title: statusDialog.nextActive ? 'Account activated' : 'Account deactivated',
        description: `${statusDialog.user.full_name || statusDialog.user.email} ${statusDialog.nextActive ? 'can now sign in.' : 'has been signed out and cannot sign in.'}`,
      });
    } catch (err: any) {
      toast({ title: 'Failed to update status', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setStatusDialog({ open: false, user: null, nextActive: true });
      setReason('');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  if (error) {
    return (
      <Card className="border border-destructive/50">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Failed to load users. You may not have permission to view this data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h3">User Management</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{users?.length || 0} total</Badge>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
            {users?.filter(u => u.is_active).length || 0} active
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {users?.filter(u => !u.is_active).length || 0} inactive
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | 'all')}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="case_manager">Case Managers</SelectItem>
            <SelectItem value="org_admin">Org Admins</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-32" /></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found matching your criteria.</TableCell></TableRow>
            ) : (
              filteredUsers.map((u) => {
                const role = roleConfig[u.role] ?? { label: u.role || 'No role', icon: Shield, color: 'bg-muted text-muted-foreground border-border' };
                const RoleIcon = role.icon;
                const isCurrentUser = u.user_id === user?.id;
                return (
                  <TableRow key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">{getInitials(u.full_name, u.email)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {u.full_name || 'No name'}
                            {isCurrentUser && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={role.color}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {role.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">Active</Badge>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border cursor-help">Inactive</Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <p>Deactivated {u.deactivated_at ? format(new Date(u.deactivated_at), 'PPp') : ''}</p>
                              {u.deactivation_reason && <p className="max-w-[240px]">Reason: {u.deactivation_reason}</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={u.role}
                          onValueChange={(newRole) => handleRoleChange(u, newRole as AppRole)}
                          disabled={isCurrentUser || updateRole.isPending || !u.is_active}
                        >
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="case_manager">Case Manager</SelectItem>
                            <SelectItem value="org_admin">Org Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch
                                checked={u.is_active}
                                onCheckedChange={() => openStatusDialog(u)}
                                disabled={isCurrentUser || setActive.isPending}
                                aria-label={u.is_active ? 'Deactivate account' : 'Activate account'}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{isCurrentUser ? 'You cannot change your own status' : (u.is_active ? 'Deactivate account' : 'Activate account')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setHistoryUserId(u.user_id)} aria-label="View status history">
                              <History className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Status history</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Role confirm */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, user: null, newRole: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{confirmDialog.user?.full_name || confirmDialog.user?.email}</strong>'s role from{' '}
              <strong>{confirmDialog.user ? roleConfig[confirmDialog.user.role]?.label ?? confirmDialog.user.role : ''}</strong> to{' '}
              <strong>{confirmDialog.newRole ? roleConfig[confirmDialog.newRole]?.label ?? confirmDialog.newRole : ''}</strong>?
              {confirmDialog.newRole === 'admin' && (
                <span className="block mt-2 text-destructive">⚠️ Admins have full access to manage all users and requests.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateRole.isPending}>
              {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status confirm */}
      <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog({ open: false, user: null, nextActive: true })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Power className="h-4 w-4" />
              {statusDialog.nextActive ? 'Activate account' : 'Deactivate account'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog.nextActive ? (
                <>Restore platform access for <strong>{statusDialog.user?.full_name || statusDialog.user?.email}</strong>. Their role, assignments, notes, and history are preserved.</>
              ) : (
                <>Immediately block platform access for <strong>{statusDialog.user?.full_name || statusDialog.user?.email}</strong>. All data is preserved and any active sessions will be revoked.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason {statusDialog.nextActive ? '(optional)' : '(recommended)'}</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder={statusDialog.nextActive ? 'Why is this account being reactivated?' : 'Why is this account being deactivated?'}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={setActive.isPending} className={statusDialog.nextActive ? '' : 'bg-destructive hover:bg-destructive/90'}>
              {setActive.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusDialog.nextActive ? 'Activate' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status history dialog */}
      <StatusHistoryDialog userId={historyUserId} onClose={() => setHistoryUserId(null)} />
    </section>
    </TooltipProvider>
  );
}

function StatusHistoryDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, isLoading } = useUserStatusHistory(userId);
  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Account status history</DialogTitle>
          <DialogDescription>All activation and deactivation events for this account.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No status changes recorded.</p>
          ) : (
            data.map(entry => (
              <div key={entry.id} className="rounded-lg border border-border/50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={entry.action === 'deactivated' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'}>
                    {entry.action === 'deactivated' ? 'Deactivated' : 'Reactivated'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(entry.created_at), 'PPp')}</span>
                </div>
                <p className="text-sm">By <strong>{entry.actor_name || entry.actor_email || 'Unknown admin'}</strong></p>
                {entry.reason && <p className="text-sm text-muted-foreground">"{entry.reason}"</p>}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
