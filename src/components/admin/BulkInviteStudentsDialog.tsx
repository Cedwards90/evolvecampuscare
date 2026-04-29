import { useState, useMemo, useRef } from 'react';
import {
  Upload, Users, Loader2, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, Download,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { useBulkInvite, useBulkInviteJob } from '@/hooks/useBulkInvite';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 100;

type IssueCode =
  | 'valid'
  | 'empty_row'
  | 'missing_email'
  | 'invalid_format'
  | 'duplicate_in_batch'
  | 'over_limit';

interface RawRow {
  line: number; // 1-indexed source line number
  email: string;
  fullName?: string;
  empty?: boolean;
  missingEmail?: boolean;
}

interface ParsedEntry {
  line: number;
  email: string;
  fullName?: string;
  status: IssueCode;
  reason?: string;
  firstSeenLine?: number;
}

interface ParseResult {
  rows: RawRow[];
  fileError?: string;
}

const REASON_LABEL: Record<IssueCode, string> = {
  valid: 'Valid',
  empty_row: 'Empty line',
  missing_email: 'Missing email cell',
  invalid_format: 'Invalid email format',
  duplicate_in_batch: 'Duplicate in this batch',
  over_limit: `Beyond ${MAX}-email limit`,
};

const HARD_ERRORS: IssueCode[] = ['invalid_format', 'missing_email'];

// --- CSV parser (RFC-4180-ish: quoted fields, "" escapes, embedded newlines) ---
function tokenizeCsv(text: string): string[][] {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }

    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') {
      row.push(cell); rows.push(row);
      row = []; cell = ''; i++; continue;
    }
    cell += ch; i++;
  }
  // flush
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseCsv(text: string): ParseResult {
  const tokens = tokenizeCsv(text);
  if (tokens.length === 0) return { rows: [] };

  // Determine header
  const firstNonEmptyIdx = tokens.findIndex(r => r.some(c => c.trim() !== ''));
  if (firstNonEmptyIdx < 0) return { rows: [] };

  const firstRow = tokens[firstNonEmptyIdx].map(c => c.trim().toLowerCase());
  const headerHasEmail = firstRow.includes('email');
  const firstCellLooksLikeEmail = EMAIL_RE.test(firstRow[0] ?? '');

  if (!headerHasEmail && !firstCellLooksLikeEmail) {
    return {
      rows: [],
      fileError: 'CSV must include an `email` column header, or one email per row in the first column.',
    };
  }

  const emailIdx = headerHasEmail ? firstRow.indexOf('email') : 0;
  const nameIdx = headerHasEmail
    ? firstRow.findIndex(c => c === 'full_name' || c === 'fullname' || c === 'name')
    : -1;
  const dataStart = headerHasEmail ? firstNonEmptyIdx + 1 : 0;

  const rows: RawRow[] = [];
  for (let i = dataStart; i < tokens.length; i++) {
    const cells = tokens[i].map(c => c.trim().replace(/^"|"$/g, ''));
    const line = i + 1;
    const isEmpty = cells.every(c => c === '');
    if (isEmpty) {
      rows.push({ line, email: '', empty: true });
      continue;
    }
    const email = cells[emailIdx] ?? '';
    if (!email) {
      rows.push({ line, email: '', missingEmail: true });
      continue;
    }
    const fullName = nameIdx >= 0 ? cells[nameIdx] : undefined;
    rows.push({ line, email, fullName });
  }

  // Trim trailing empty row produced by final newline
  while (rows.length && rows[rows.length - 1].empty) rows.pop();

  return { rows };
}

function parsePasted(text: string): RawRow[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  const rows: RawRow[] = [];
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed) {
      rows.push({ line, email: '', empty: true });
      return;
    }
    // allow comma/semicolon/space separation on a single line
    const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
    tokens.forEach(t => rows.push({ line, email: t }));
  });
  // Trim trailing empties
  while (rows.length && rows[rows.length - 1].empty) rows.pop();
  return rows;
}

function isValidEmailStrict(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  if (email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const local = email.split('@')[0];
  if (local.length > 64) return false;
  return true;
}

function validate(raw: RawRow[]): ParsedEntry[] {
  const seen = new Map<string, number>(); // email -> first line
  let validCount = 0;
  return raw.map(r => {
    if (r.empty) {
      return { line: r.line, email: '', status: 'empty_row', reason: REASON_LABEL.empty_row };
    }
    if (r.missingEmail) {
      return { line: r.line, email: '', status: 'missing_email', reason: REASON_LABEL.missing_email };
    }
    const normalized = r.email.trim().toLowerCase().replace(/^"|"$/g, '');
    if (!isValidEmailStrict(normalized)) {
      return { line: r.line, email: r.email, status: 'invalid_format', reason: REASON_LABEL.invalid_format };
    }
    if (seen.has(normalized)) {
      return {
        line: r.line,
        email: normalized,
        status: 'duplicate_in_batch',
        reason: REASON_LABEL.duplicate_in_batch,
        firstSeenLine: seen.get(normalized),
      };
    }
    seen.set(normalized, r.line);
    validCount++;
    if (validCount > MAX) {
      return { line: r.line, email: normalized, status: 'over_limit', reason: REASON_LABEL.over_limit };
    }
    return {
      line: r.line,
      email: normalized,
      fullName: r.fullName?.trim().slice(0, 100) || undefined,
      status: 'valid',
    };
  });
}

function escapeCsvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadErrorReport(entries: ParsedEntry[]) {
  const issues = entries.filter(e => e.status !== 'valid');
  const header = 'line,email,issue,detail';
  const body = issues.map(e => {
    const detail = e.firstSeenLine ? `first seen on line ${e.firstSeenLine}` : '';
    return [e.line, escapeCsvCell(e.email || ''), e.status, escapeCsvCell(detail)].join(',');
  });
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bulk-invite-errors-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BulkInviteStudentsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('csv');
  const [csvFileName, setCsvFileName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>('none');
  const [notes, setNotes] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: organizations } = useActiveOrganizations();
  const bulkInvite = useBulkInvite();
  const { data: jobData } = useBulkInviteJob(activeJobId);

  const grouped = useMemo(() => {
    const g: Record<IssueCode, ParsedEntry[]> = {
      valid: [], empty_row: [], missing_email: [], invalid_format: [],
      duplicate_in_batch: [], over_limit: [],
    };
    parsed.forEach(p => g[p.status].push(p));
    return g;
  }, [parsed]);

  const valid = grouped.valid;
  const hardErrorCount = grouped.invalid_format.length + grouped.missing_email.length;
  const issueCount = parsed.length - valid.length;

  const handleFile = async (file: File) => {
    setCsvFileName(file.name);
    setFileError(null);
    const text = await file.text();
    const result = parseCsv(text);
    if (result.fileError) {
      setFileError(result.fileError);
      setParsed([]);
      return;
    }
    setParsed(validate(result.rows));
  };

  const handlePasteChange = (text: string) => {
    setPastedText(text);
    setFileError(null);
    setParsed(validate(parsePasted(text)));
  };

  const handleSubmit = async () => {
    if (valid.length === 0) {
      toast.error('Add at least one valid email.');
      return;
    }
    if (hardErrorCount > 0) {
      toast.error('Fix invalid or missing emails before sending.');
      return;
    }
    try {
      const res = await bulkInvite.mutateAsync({
        emails: valid.map(v => ({ email: v.email, fullName: v.fullName })),
        notes: notes.trim() || undefined,
        organizationId: orgId !== 'none' ? orgId : undefined,
      });
      setActiveJobId(res.jobId);
      toast.success(
        res.async
          ? `Processing ${res.total} invitations in the background…`
          : `Sent ${res.succeeded ?? 0}, failed ${res.failed ?? 0}, skipped ${res.skipped ?? 0}.`,
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start bulk invite.');
    }
  };

  const reset = () => {
    setActiveJobId(null);
    setParsed([]);
    setPastedText('');
    setCsvFileName('');
    setFileError(null);
    setNotes('');
    setOrgId('none');
    if (fileRef.current) fileRef.current.value = '';
  };

  const closeAll = () => {
    setOpen(false);
    reset();
  };

  const job = jobData?.job;
  const items = jobData?.items ?? [];
  const showProgress = !!activeJobId;
  const progressPct = job ? Math.round((job.processed / Math.max(job.total, 1)) * 100) : 0;

  const issueGroups: { code: IssueCode; tone: 'destructive' | 'warning' | 'muted' }[] = [
    { code: 'invalid_format', tone: 'destructive' },
    { code: 'missing_email', tone: 'destructive' },
    { code: 'duplicate_in_batch', tone: 'warning' },
    { code: 'over_limit', tone: 'warning' },
    { code: 'empty_row', tone: 'muted' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Bulk Invite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {!showProgress ? (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Invite Students</DialogTitle>
              <DialogDescription>
                Invite up to {MAX} students at once via CSV upload or pasted email list.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                <TabsTrigger value="paste">Paste Emails</TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="space-y-3 pt-3">
                <div
                  className="rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors p-6 text-center cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                >
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {csvFileName || 'Click or drop a CSV file here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: one email per row. Optional <code>email,full_name</code> headers. Quoted fields supported.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-3 pt-3">
                <Label>Paste emails (one per line, or comma/space separated)</Label>
                <Textarea
                  rows={6}
                  value={pastedText}
                  onChange={e => handlePasteChange(e.target.value)}
                  placeholder="alice@example.com&#10;bob@example.com&#10;charlie@example.com"
                />
              </TabsContent>
            </Tabs>

            {fileError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}

            {parsed.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    {valid.length} valid
                  </Badge>
                  {grouped.invalid_format.length > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      {grouped.invalid_format.length} invalid
                    </Badge>
                  )}
                  {grouped.missing_email.length > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      {grouped.missing_email.length} missing email
                    </Badge>
                  )}
                  {grouped.duplicate_in_batch.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      {grouped.duplicate_in_batch.length} duplicate
                    </Badge>
                  )}
                  {grouped.over_limit.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      {grouped.over_limit.length} over limit
                    </Badge>
                  )}
                  {grouped.empty_row.length > 0 && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      {grouped.empty_row.length} empty
                    </Badge>
                  )}
                </div>

                {hardErrorCount > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Fix the {hardErrorCount} invalid {hardErrorCount === 1 ? 'row' : 'rows'} below, then re-upload. Sending is disabled until they're resolved.
                    </AlertDescription>
                  </Alert>
                )}

                {grouped.over_limit.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Only the first {MAX} valid emails will be sent. Rows beyond the limit are skipped.
                    </AlertDescription>
                  </Alert>
                )}

                {issueCount > 0 && (
                  <div className="rounded-md border">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                      <span className="text-sm font-medium">
                        Error report ({issueCount} {issueCount === 1 ? 'issue' : 'issues'})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadErrorReport(parsed)}
                        className="h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download .csv
                      </Button>
                    </div>
                    <ScrollArea className="h-60">
                      <div className="p-3 space-y-3 text-xs">
                        {issueGroups.map(({ code, tone }) => {
                          const list = grouped[code];
                          if (list.length === 0) return null;
                          const toneCls =
                            tone === 'destructive' ? 'text-destructive' :
                            tone === 'warning' ? 'text-amber-700 dark:text-amber-400' :
                            'text-muted-foreground';
                          return (
                            <div key={code}>
                              <div className={`font-medium mb-1 ${toneCls}`}>
                                {REASON_LABEL[code]} ({list.length})
                              </div>
                              <div className="space-y-0.5 pl-2">
                                {list.slice(0, 100).map((p, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2 text-muted-foreground">
                                    <span className="font-mono truncate">
                                      Line {p.line} — {p.email || <em>(empty)</em>}
                                    </span>
                                    {p.firstSeenLine && (
                                      <span className="shrink-0 text-[10px]">first seen line {p.firstSeenLine}</span>
                                    )}
                                  </div>
                                ))}
                                {list.length > 100 && (
                                  <div className="text-[10px] italic">…and {list.length - 100} more (download full report)</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {organizations && organizations.length > 0 && (
              <div className="space-y-2">
                <Label>Organization (optional)</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No organization</SelectItem>
                    {organizations.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Personal note (optional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note included in the invitation email…"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeAll} disabled={bulkInvite.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={bulkInvite.isPending || valid.length === 0 || hardErrorCount > 0}
              >
                {bulkInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send {valid.length || ''} Invitation{valid.length === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {job?.status === 'complete' ? 'Bulk invite complete' :
                 job?.status === 'failed' ? 'Bulk invite failed' :
                 'Sending invitations…'}
              </DialogTitle>
              <DialogDescription>
                {job ? `${job.processed} of ${job.total} processed` : 'Initializing…'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Progress value={progressPct} />

              {job && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {job.succeeded} sent
                  </Badge>
                  {job.failed > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      <XCircle className="h-3 w-3 mr-1" /> {job.failed} failed
                    </Badge>
                  )}
                  {job.skipped > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      <AlertCircle className="h-3 w-3 mr-1" /> {job.skipped} skipped
                    </Badge>
                  )}
                </div>
              )}

              {items.length > 0 && (
                <ScrollArea className="h-64 rounded-md border">
                  <div className="divide-y text-sm">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2">
                        <span className="font-mono text-xs truncate flex-1">{item.email}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'sent' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {item.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                          {item.status === 'skipped' && <AlertCircle className="h-4 w-4 text-amber-600" />}
                          {item.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <DialogFooter>
              {job?.status === 'processing' ? (
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Run in background
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={reset}>Send Another Batch</Button>
                  <Button onClick={closeAll}>Done</Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
