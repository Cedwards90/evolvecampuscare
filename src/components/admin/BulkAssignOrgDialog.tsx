import { useState, useMemo } from 'react';
import { Search, Loader2, Users, GraduationCap, UserCheck, Shield } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useUsers } from '@/hooks/useUsers';
import { useBulkAssignOrganization, type TrainingOrganization } from '@/hooks/useTrainingOrganizations';

interface BulkAssignOrgDialogProps {
  org: TrainingOrganization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'student', label: 'Students', icon: GraduationCap },
  { value: 'case_manager', label: 'Case Managers', icon: UserCheck },
  { value: 'admin', label: 'Admins', icon: Shield },
] as const;

export function BulkAssignOrgDialog({ org, open, onOpenChange }: BulkAssignOrgDialogProps) {
  const { data: users } = useUsers();
  const bulkAssign = useBulkAssignOrganization();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const alreadyInOrg = useMemo(
    () => new Set((users || []).filter(u => u.organization_id === org.id).map(u => u.user_id)),
    [users, org.id]
  );

  const filtered = useMemo(() => {
    return (users || []).filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      const q = search.toLowerCase();
      if (q && !(u.full_name || '').toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, roleFilter]);

  const toggle = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const newSelections = [...selectedIds].filter(id => !alreadyInOrg.has(id));

  const handleAssign = async () => {
    if (newSelections.length === 0) return;
    try {
      await bulkAssign.mutateAsync({ organizationId: org.id, userIds: newSelections });
      toast({ title: 'Assigned', description: `${newSelections.length} user(s) assigned to ${org.name}.` });
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const roleIcon = (role: string) => {
    if (role === 'student') return <GraduationCap className="h-3 w-3" />;
    if (role === 'case_manager') return <UserCheck className="h-3 w-3" />;
    return <Shield className="h-3 w-3" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Assign Users to {org.name}
          </DialogTitle>
          <DialogDescription>Select users to assign to this organization.</DialogDescription>
        </DialogHeader>

        {/* Search + Role Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {ROLE_FILTER_OPTIONS.map(opt => (
              <Badge
                key={opt.value}
                variant={roleFilter === opt.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setRoleFilter(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* User List */}
        <ScrollArea className="h-[300px] border rounded-md">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <div className="divide-y">
              {filtered.map(user => {
                const isAlready = alreadyInOrg.has(user.user_id);
                const isChecked = isAlready || selectedIds.has(user.user_id);
                return (
                  <label
                    key={user.user_id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={isAlready}
                      onCheckedChange={() => toggle(user.user_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                      {roleIcon(user.role)} {user.role.replace('_', ' ')}
                    </Badge>
                    {isAlready && <span className="text-xs text-muted-foreground">Already assigned</span>}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {newSelections.length} new user(s) selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={newSelections.length === 0 || bulkAssign.isPending}>
              {bulkAssign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign {newSelections.length > 0 ? `(${newSelections.length})` : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
