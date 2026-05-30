import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Save, X, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { useOrgAdmins } from '@/hooks/useOrgAdmins';
import {
  useProgramCostSettings,
  useUpsertProgramCostSetting,
  useDeleteProgramCostSetting,
  type ProgramCostSetting,
} from '@/hooks/useProgramCostSettings';

interface FormState {
  id?: string;
  organization_id: string | null;
  period_start: string;
  period_end: string;
  annual_program_cost: string;
  cost_per_participant_override: string;
  avg_public_benefit_offset: string;
  currency: string;
  notes: string;
}

const empty = (orgId: string | null): FormState => ({
  organization_id: orgId,
  period_start: `${new Date().getFullYear()}-01-01`,
  period_end: `${new Date().getFullYear()}-12-31`,
  annual_program_cost: '',
  cost_per_participant_override: '',
  avg_public_benefit_offset: '',
  currency: 'USD',
  notes: '',
});

export function ProgramCostSettingsCard() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const isOrgAdmin = role === 'org_admin';

  // Determine which orgs the current user can manage
  const { data: orgs } = useActiveOrganizations();
  const { data: orgAdminRows } = useOrgAdmins(user?.id);
  const orgAdminOrgIds = (orgAdminRows || []).map((r: any) => r.organization_id);
  const manageableOrgs = isAdmin
    ? (orgs || [])
    : (orgs || []).filter((o) => orgAdminOrgIds.includes(o.id));

  // Org Admin: scope query to their orgs; Admin: see all rows.
  const { data: rows = [], isLoading } = useProgramCostSettings(
    isAdmin ? undefined : (manageableOrgs[0]?.id ?? null),
  );
  const visibleRows = isAdmin
    ? rows
    : rows.filter((r) => r.organization_id && orgAdminOrgIds.includes(r.organization_id));

  const upsert = useUpsertProgramCostSetting();
  const del = useDeleteProgramCostSetting();

  const [editing, setEditing] = useState<FormState | null>(null);

  const startNew = () =>
    setEditing(empty(isAdmin ? null : (manageableOrgs[0]?.id ?? null)));

  const startEdit = (row: ProgramCostSetting) =>
    setEditing({
      id: row.id,
      organization_id: row.organization_id,
      period_start: row.period_start,
      period_end: row.period_end,
      annual_program_cost: String(row.annual_program_cost ?? ''),
      cost_per_participant_override: row.cost_per_participant_override == null ? '' : String(row.cost_per_participant_override),
      avg_public_benefit_offset: row.avg_public_benefit_offset == null ? '' : String(row.avg_public_benefit_offset),
      currency: row.currency || 'USD',
      notes: row.notes || '',
    });

  const save = async () => {
    if (!editing) return;
    await upsert.mutateAsync({
      id: editing.id,
      organization_id: editing.organization_id,
      period_start: editing.period_start,
      period_end: editing.period_end,
      annual_program_cost: Number(editing.annual_program_cost),
      cost_per_participant_override: editing.cost_per_participant_override === '' ? null : Number(editing.cost_per_participant_override),
      avg_public_benefit_offset: editing.avg_public_benefit_offset === '' ? null : Number(editing.avg_public_benefit_offset),
      currency: editing.currency || 'USD',
      notes: editing.notes || null,
    });
    setEditing(null);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <Card className="border border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Program Costs
            </CardTitle>
            <CardDescription>
              Used to compute cost-per-participant and Social Return on Investment.
              {isAdmin ? ' Leave organization blank for a platform-wide default.' : ' Scoped to your organization.'}
            </CardDescription>
          </div>
          <Button onClick={startNew} size="sm" className="rounded-full">
            <Plus className="mr-1 h-4 w-4" /> Add period
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing && (
          <div className="rounded-lg border border-primary/40 bg-muted/30 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {isAdmin && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Organization (blank = platform default)</Label>
                  <Select
                    value={editing.organization_id || '__none__'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, organization_id: v === '__none__' ? null : v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Platform-wide default</SelectItem>
                      {(orgs || []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isOrgAdmin && manageableOrgs.length > 1 && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Organization</Label>
                  <Select
                    value={editing.organization_id || ''}
                    onValueChange={(v) => setEditing({ ...editing, organization_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {manageableOrgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Period start</Label>
                <Input
                  type="date"
                  value={editing.period_start}
                  onChange={(e) => setEditing({ ...editing, period_start: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Period end</Label>
                <Input
                  type="date"
                  value={editing.period_end}
                  onChange={(e) => setEditing({ ...editing, period_end: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annual program cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.annual_program_cost}
                  onChange={(e) => setEditing({ ...editing, annual_program_cost: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Input
                  value={editing.currency}
                  onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  maxLength={6}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cost-per-participant override (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.cost_per_participant_override}
                  onChange={(e) =>
                    setEditing({ ...editing, cost_per_participant_override: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avg public-benefit offset / outcome (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.avg_public_benefit_offset}
                  onChange={(e) =>
                    setEditing({ ...editing, avg_public_benefit_offset: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} className="rounded-full">
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={save}
                disabled={
                  upsert.isPending ||
                  !editing.annual_program_cost ||
                  !editing.period_start ||
                  !editing.period_end ||
                  (isOrgAdmin && !editing.organization_id)
                }
                className="rounded-full"
              >
                <Save className="mr-1 h-4 w-4" />
                {upsert.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {visibleRows.length === 0 && !editing ? (
          <EmptyState
            icon={DollarSign}
            title="No cost periods configured"
            description="Add at least one period so SROI calculations can be derived."
          />
        ) : (
          <div className="space-y-2">
            {visibleRows.map((row) => {
              const orgName = (orgs || []).find((o) => o.id === row.organization_id)?.name;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium">
                        {format(new Date(row.period_start), 'MMM d, yyyy')} – {format(new Date(row.period_end), 'MMM d, yyyy')}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span>
                        {row.currency} {Number(row.annual_program_cost).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{orgName || 'Platform-wide default'}</span>
                    </div>
                    {row.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{row.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(row)} className="rounded-full">
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive rounded-full">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this cost period?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(row.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
