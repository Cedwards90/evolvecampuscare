import { useEffect, useMemo, useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import {
  useOrgAdminAssignments,
  useSetOrgAdminAssignments,
} from '@/hooks/useOrgAdmins';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
}

export function OrgAdminAssignmentDialog({ open, onOpenChange, userId, userName }: Props) {
  const { toast } = useToast();
  const { data: orgs, isLoading: orgsLoading } = useActiveOrganizations();
  const { data: existing, isLoading: existingLoading } = useOrgAdminAssignments(open ? userId : null);
  const save = useSetOrgAdminAssignments();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (existing) {
      setSelected(new Set(existing.map((r) => r.organization_id as string)));
    }
  }, [existing, open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortedOrgs = useMemo(
    () => (orgs ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [orgs]
  );

  const handleSave = async () => {
    if (!userId) return;
    try {
      await save.mutateAsync({ userId, organizationIds: Array.from(selected) });
      toast({
        title: 'Organizations updated',
        description: `${userName} now administers ${selected.size} organization${selected.size === 1 ? '' : 's'}.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not save',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const loading = orgsLoading || existingLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Manage organizations
          </DialogTitle>
          <DialogDescription>
            Choose which organizations <strong>{userName}</strong> can administer. They will only see students,
            requests, and analytics for the selected organizations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sortedOrgs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No active organizations available.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2 py-2">
            {sortedOrgs.map((org) => (
              <label
                key={org.id}
                className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(org.id)}
                  onCheckedChange={() => toggle(org.id)}
                />
                <div className="flex-1 min-w-0">
                  <Label className="cursor-pointer font-medium">{org.name}</Label>
                  {org.description && (
                    <p className="text-xs text-muted-foreground truncate">{org.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
