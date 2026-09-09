import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Plus,
  Loader2,
  Download,
  FileWarning,
  Users,
  Landmark,
  Trash2,
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useControlsSettings,
  useUpdateControlsSettings,
  useFundingSources,
  useSaveFundingSource,
  useBudgetLines,
  useSaveBudgetLine,
  useDeleteBudgetLine,
  useCategoryBudgetMap,
  useSaveCategoryMapping,
  useRequestDeleteLog,
  useAccessReview,
  useMissingReceipts,
  useRetentionExportLog,
  useLogRetentionExport,
} from '@/hooks/useInternalControls';
import { useUsers } from '@/hooks/useUsers';

const CATEGORIES = ['academic', 'financial', 'mental_health', 'housing', 'other'];
const money = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function InternalControls() {
  const { toast } = useToast();

  return (
    <SidebarLayout>
      <PageHeader
        title="Internal controls"
        description="Approvals, payment records, funding codes, account review and retention — the evidence an auditor asks for."
      />
      <Tabs defaultValue="settings" className="mt-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="settings">Controls</TabsTrigger>
          <TabsTrigger value="funding">Funding sources</TabsTrigger>
          <TabsTrigger value="budget">Grant budget lines</TabsTrigger>
          <TabsTrigger value="access">Access review</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="retention">Retention & exports</TabsTrigger>
          <TabsTrigger value="deletions">Deletion log</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <ControlsSettingsTab />
        </TabsContent>
        <TabsContent value="funding" className="mt-4">
          <FundingSourcesTab />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <BudgetLinesTab />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AccessReviewTab />
        </TabsContent>
        <TabsContent value="receipts" className="mt-4">
          <ReceiptsTab />
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <RetentionTab />
        </TabsContent>
        <TabsContent value="deletions" className="mt-4">
          <DeletionLogTab />
        </TabsContent>
      </Tabs>
    </SidebarLayout>
  );
}

function ControlsSettingsTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useControlsSettings();
  const save = useUpdateControlsSettings();
  const { data: users } = useUsers();
  const admins = (users || []).filter((u) => u.role === 'admin');

  const [threshold, setThreshold] = useState<string>('');
  const [retention, setRetention] = useState<string>('');

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;

  const currentThreshold = threshold || String(settings?.second_approval_threshold ?? 500);
  const currentRetention = retention || String(settings?.retention_months ?? 84);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Second approval</CardTitle>
          <CardDescription>
            Payments above this amount need a second administrator's approval, and whoever records the payment cannot be
            an approver. This is enforced when saving, not just on screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-1">
            <Label htmlFor="threshold">Threshold</Label>
            <Input id="threshold" type="number" step="50" value={currentThreshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={async () => {
              await save.mutateAsync({ second_approval_threshold: Number(currentThreshold) });
              toast({ title: 'Threshold saved' });
            }}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who may delete a record</CardTitle>
          <CardDescription>
            Everyone else can only archive. The chosen administrator must type a reason, and every deletion is logged
            permanently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-sm space-y-1">
            <Label>Designated administrator</Label>
            <Select
              value={settings?.designated_delete_admin_id ?? 'none'}
              onValueChange={async (v) => {
                await save.mutateAsync({ designated_delete_admin_id: v === 'none' ? null : v });
                toast({ title: 'Saved' });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Nobody" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nobody — archive only</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending figures</CardTitle>
          <CardDescription>
            Dashboard spending totals are marked "not reconciled" until an administrator checks them against the bank
            and accounting records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Last reconciled:{' '}
            {settings?.spending_last_reconciled_at
              ? format(new Date(settings.spending_last_reconciled_at), 'PPp')
              : 'never'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await save.mutateAsync({ spending_last_reconciled_at: new Date().toISOString() });
              toast({ title: 'Marked as reconciled' });
            }}
          >
            Mark spending as reconciled today
          </Button>
          <div className="max-w-xs space-y-1 pt-4">
            <Label htmlFor="retention">Retention window (months)</Label>
            <Input id="retention" type="number" value={currentRetention} onChange={(e) => setRetention(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={async () => {
              await save.mutateAsync({ retention_months: Number(currentRetention) });
              toast({ title: 'Retention window saved' });
            }}
          >
            Save retention window
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FundingSourcesTab() {
  const { toast } = useToast();
  const { data: sources, isLoading } = useFundingSources();
  const save = useSaveFundingSource();
  const [name, setName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Funding sources</CardTitle>
        <CardDescription>
          Staff pick one of these on each request so spending can be tied to the grant or fund that paid for it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label htmlFor="fs-name">Add a funding source</Label>
            <Input id="fs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barrier Fund" />
          </div>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={async () => {
              await save.mutateAsync({ name: name.trim() });
              setName('');
              toast({ title: 'Funding source added' });
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (sources || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — add the funds you report on.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sources || []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="break-words">{s.name}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={async (checked) => {
                        await save.mutateAsync({ id: s.id, name: s.name, description: s.description, is_active: checked });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetLinesTab() {
  const { toast } = useToast();
  const { data: lines, isLoading } = useBudgetLines();
  const { data: sources } = useFundingSources(true);
  const { data: mapping } = useCategoryBudgetMap();
  const saveLine = useSaveBudgetLine();
  const removeLine = useDeleteBudgetLine();
  const saveMapping = useSaveCategoryMapping();

  const [form, setForm] = useState({ code: '', name: '', grant_name: '' });

  const mapFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of mapping || []) {
      m.set(`${row.category}|${row.funding_source_id ?? 'any'}`, row.budget_line_id);
    }
    return m;
  }, [mapping]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Grant budget lines</CardTitle>
          <CardDescription>
            Add your grant budget lines here, exactly as they appear in the grant agreement. They start empty on
            purpose — nothing is guessed for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="bl-code">Code (optional)</Label>
              <Input id="bl-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl-name">Budget line name</Label>
              <Input id="bl-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl-grant">Grant (optional)</Label>
              <Input id="bl-grant" value={form.grant_name} onChange={(e) => setForm((f) => ({ ...f, grant_name: e.target.value }))} />
            </div>
          </div>
          <Button
            disabled={!form.name.trim() || saveLine.isPending}
            onClick={async () => {
              await saveLine.mutateAsync({ code: form.code || null, name: form.name.trim(), grant_name: form.grant_name || null });
              setForm({ code: '', name: '', grant_name: '' });
              toast({ title: 'Budget line added' });
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Add budget line
          </Button>

          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (lines || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No budget lines yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Grant</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lines || []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.code || '—'}</TableCell>
                    <TableCell className="break-words">{l.name}</TableCell>
                    <TableCell>{l.grant_name || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine.mutate(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category mapping</CardTitle>
          <CardDescription>
            Point each request category at a budget line, so a report by grant line comes straight from the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(lines || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a budget line first.</p>
          ) : (
            CATEGORIES.map((cat) => (
              <div key={cat} className="flex flex-wrap items-center gap-3">
                <span className="capitalize w-40">{cat.replace('_', ' ')}</span>
                <Select
                  value={mapFor.get(`${cat}|any`) ?? 'none'}
                  onValueChange={async (v) => {
                    await saveMapping.mutateAsync({
                      category: cat,
                      fundingSourceId: null,
                      budgetLineId: v === 'none' ? null : v,
                    });
                    toast({ title: 'Mapping saved' });
                  }}
                >
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Not mapped" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not mapped</SelectItem>
                    {(lines || []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.code ? `${l.code} · ` : ''}{l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessReviewTab() {
  const { data: rows, isLoading } = useAccessReview();

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Role', 'Status', 'Two-factor', 'Last sign-in'];
    const lines = [
      header.join(','),
      ...(rows || []).map((r) =>
        [
          r.full_name || '',
          r.email,
          r.role,
          r.is_active ? 'Active' : 'Inactive',
          r.mfa_exempt ? 'Exempt' : 'Required',
          r.last_sign_in_at || '',
        ]
          .map((v) => `"${String(v).split('"').join('""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Named account review</CardTitle>
            <CardDescription>
              Every account is individual. Review roles, status and last sign-in, then export the list for your file.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Two-factor</TableHead>
                  <TableHead>Last sign-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows || []).map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="break-words">{r.full_name || '—'}</TableCell>
                    <TableCell className="break-all text-sm">{r.email}</TableCell>
                    <TableCell className="capitalize">{r.role.replace('_', ' ')}</TableCell>
                    <TableCell>
                      {r.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      {r.role === 'student' ? '—' : r.mfa_exempt ? <Badge variant="destructive">Exempt</Badge> : 'Required'}
                    </TableCell>
                    <TableCell>{r.last_sign_in_at ? format(new Date(r.last_sign_in_at), 'PP') : 'Never recorded'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReceiptsTab() {
  const { data: rows, isLoading } = useMissingReceipts();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5" /> Missing receipts</CardTitle>
        <CardDescription>Payments recorded with no document attached to the request.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (rows || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Every recorded payment has a document attached.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/requests/${r.id}`} className="hover:underline break-words">{r.title}</Link>
                  </TableCell>
                  <TableCell>{money(r.amount_paid)}</TableCell>
                  <TableCell>{r.paid_at ? format(new Date(r.paid_at), 'PP') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RetentionTab() {
  const { toast } = useToast();
  const { data: log, isLoading } = useRetentionExportLog();
  const logExport = useLogRetentionExport();
  const { data: settings } = useControlsSettings();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Monthly record package</CardTitle>
          <CardDescription>
            Records are kept for {settings?.retention_months ?? 84} months and cannot be removed inside that window.
            Download the full package from Data export, then record it here so the monthly routine is evidenced.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/data-export">
              <Download className="h-4 w-4 mr-2" /> Open Data export
            </Link>
          </Button>
          <Button
            disabled={logExport.isPending}
            onClick={async () => {
              await logExport.mutateAsync({ periodStart, periodEnd });
              toast({ title: 'Recorded', description: `Package logged for ${periodStart} to ${periodEnd}.` });
            }}
          >
            {logExport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record last month's package as saved
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (log || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No monthly packages recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(log || []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {format(new Date(e.period_start), 'PP')} – {format(new Date(e.period_end), 'PP')}
                    </TableCell>
                    <TableCell>{format(new Date(e.created_at), 'PPp')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DeletionLogTab() {
  const { data: rows, isLoading } = useRequestDeleteLog();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deletion log</CardTitle>
        <CardDescription>Every permanent deletion, who did it, when, and why. This log cannot be edited.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (rows || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been deleted.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows || []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.created_at), 'PPp')}</TableCell>
                  <TableCell>{r.actor_name || '—'}</TableCell>
                  <TableCell className="break-words">{r.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
