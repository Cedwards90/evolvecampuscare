import { useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Archive, Database, Download, FileSpreadsheet, Loader2, ShieldAlert } from 'lucide-react';
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
import { useExportManifest, useRunExport, type ExportFilters } from '@/hooks/useDataExport';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { useAllCohorts } from '@/hooks/useCohorts';

export default function DataExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allTime, setAllTime] = useState(true);
  const [orgId, setOrgId] = useState('all');
  const [cohortId, setCohortId] = useState('all');
  const [includeSensitive, setIncludeSensitive] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmAllTime, setConfirmAllTime] = useState(false);

  const filters: ExportFilters = useMemo(
    () => ({
      from: !allTime && from ? new Date(from).toISOString() : null,
      to: !allTime && to ? new Date(`${to}T23:59:59`).toISOString() : null,
      orgIds: orgId !== 'all' ? [orgId] : [],
      cohortIds: cohortId !== 'all' ? [cohortId] : [],
      includeSensitive,
    }),
    [allTime, from, to, orgId, cohortId, includeSensitive],
  );

  const { data: manifest, isLoading, error } = useExportManifest(filters);
  const { data: orgs } = useActiveOrganizations();
  const { data: cohorts } = useAllCohorts();
  const runExport = useRunExport();

  const cohortOptions = useMemo(
    () => (cohorts ?? []).filter((c) => orgId === 'all' || c.organization_id === orgId),
    [cohorts, orgId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof manifest extends undefined ? never : NonNullable<typeof manifest>['tables']>();
    (manifest?.tables ?? []).forEach((t) => {
      map.set(t.group, [...(map.get(t.group) ?? []), t]);
    });
    return [...map.entries()];
  }, [manifest]);

  const allTables = (manifest?.tables ?? []).map((t) => t.table);
  const withData = (manifest?.tables ?? []).filter((t) => (t.rows ?? 0) > 0).map((t) => t.table);
  const totalRows = (manifest?.tables ?? [])
    .filter((t) => selected.includes(t.table))
    .reduce((sum, t) => sum + (t.rows ?? 0), 0);

  const toggle = (table: string) =>
    setSelected((prev) => (prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]));

  const run = (action: 'export' | 'flat' | 'all-time', bundle: 'zip' | 'files', tables?: string[]) => {
    runExport.mutate(
      { action, tables, filters, bundle },
      {
        onSuccess: (res) => {
          if (!res.downloaded) {
            toast.info('No rows matched the selected filters.');
            return;
          }
          toast.success(`Exported ${res.totalRows.toLocaleString()} rows across ${res.downloaded} file(s).`, {
            description: res.failed?.length
              ? `Partial export. Failed: ${res.failed.map((item) => item.table).join(', ')}. See manifest.csv for details.`
              : res.truncated?.length
                ? `Skipped: ${res.truncated.join(', ')}.`
                : undefined,
          });
        },
        onError: (e: unknown) =>
          toast.error('Export failed', { description: e instanceof Error ? e.message : 'Please try again.' }),
      },
    );
  };

  const busy = runExport.isPending;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Historical data export"
          description="Download platform records as CSV. Every export is logged with the selected filters."
        />

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Handle exports carefully</AlertTitle>
          <AlertDescription>
            Exports can include personal details such as dates of birth, addresses, phone numbers and case-note
            content. Store downloads securely and share only with authorised staff.
          </AlertDescription>
        </Alert>

        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Everything, all time</CardTitle>
                <CardDescription>
                  One ZIP with every table that has data, plus the ready-made request and student reports. Ignores the
                  date range, organization and cohort filters below.
                </CardDescription>
              </div>
              <Button
                onClick={() => setConfirmAllTime(true)}
                disabled={busy}
                className="rounded-full"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                Export all time
              </Button>
            </div>
          </CardHeader>
        </Card>

        {busy && runExport.progress && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Preparing export</AlertTitle>
            <AlertDescription>
              {runExport.progress.table} · {Math.min(runExport.progress.current + 1, runExport.progress.total)} of{' '}
              {runExport.progress.total}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              Applied to every table that has a matching date or scope column. Leave dates empty (or keep “All time”
              on) for the full history.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
              <Switch id="all-time" checked={allTime} onCheckedChange={setAllTime} />
              <Label htmlFor="all-time" className="cursor-pointer">
                {allTime ? 'All time (no date limit)' : 'Use a date range'}
              </Label>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="export-from">From</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                disabled={allTime}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="export-to">To</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                disabled={allTime}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Organization</Label>
              <Select
                value={orgId}
                onValueChange={(v) => {
                  setOrgId(v);
                  setCohortId('all');
                }}
              >
                <SelectTrigger><SelectValue placeholder="All organizations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organizations</SelectItem>
                  {(orgs ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="All cohorts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohortOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Switch id="sensitive" checked={includeSensitive} onCheckedChange={setIncludeSensitive} />
              <Label htmlFor="sensitive" className="cursor-pointer">
                Include sensitive fields (contact details, dates of birth, note bodies)
              </Label>
              {!includeSensitive && <Badge variant="secondary">Redacted export</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Ready-made reports</CardTitle>
                <CardDescription>Flattened, human-readable files that join related records together.</CardDescription>
              </div>
              <Button onClick={() => run('flat', 'zip')} disabled={busy} className="rounded-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Download requests + students
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">requests_full.csv</span> — every request with student,
              organization, cohort, case manager, amounts and resolution time.
            </p>
            <p>
              <span className="font-medium text-foreground">students_full.csv</span> — every student with profile,
              cohort, case managers and activity counts.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Raw tables</CardTitle>
                <CardDescription>
                  {manifest?.scoped
                    ? 'Scoped to the organizations you administer.'
                    : 'Full platform history, one CSV per table.'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSelected(withData)}>
                  Select tables with data
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSelected(allTables)}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting rows…
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive">
                Could not load the table list. {error instanceof Error ? error.message : ''}
              </p>
            )}
            {groups.map(([group, tables]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-sm font-semibold">{group}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tables.map((t) => (
                    <label
                      key={t.table}
                      className="flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selected.includes(t.table)}
                        onCheckedChange={() => toggle(t.table)}
                        aria-label={`Export ${t.label}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.table} · {t.rows === null ? 'unavailable' : `${t.rows.toLocaleString()} rows`}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <Separator />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4 shrink-0" />
            {selected.length} table(s) selected · {totalRows.toLocaleString()} rows
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={busy || !selected.length}
              onClick={() => run('export', 'files', selected)}
            >
              <Download className="mr-2 h-4 w-4" /> Separate CSVs
            </Button>
            <Button
              className="rounded-full"
              disabled={busy || !selected.length}
              onClick={() => run('export', 'zip', selected)}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download ZIP
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmAllTime} onOpenChange={setConfirmAllTime}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Export the entire platform history?</AlertDialogTitle>
              <AlertDialogDescription>
                This downloads every table that has data, for all time, including sensitive fields such as dates of
                birth, contact details and case-note content. The export is logged. Store the file securely.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction className="rounded-full" onClick={() => run('all-time', 'zip')}>
                Export all time
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarLayout>
  );
}
