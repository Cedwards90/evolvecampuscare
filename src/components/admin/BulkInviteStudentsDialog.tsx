import { useState, useMemo, useRef } from 'react';
import { Upload, Users, Loader2, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

interface ParsedEntry {
  email: string;
  fullName?: string;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
}

function parseCsv(text: string): { email: string; fullName?: string }[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header
  const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
  const hasHeader = firstCols.includes('email');
  const startIdx = hasHeader ? 1 : 0;
  const emailIdx = hasHeader ? firstCols.indexOf('email') : 0;
  const nameIdx = hasHeader
    ? firstCols.findIndex(c => c === 'full_name' || c === 'name' || c === 'fullname')
    : -1;

  const out: { email: string; fullName?: string }[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx];
    if (!email) continue;
    const fullName = nameIdx >= 0 ? cols[nameIdx] : undefined;
    out.push({ email, fullName });
  }
  return out;
}

function parsePasted(text: string): { email: string }[] {
  return text
    .split(/[\s,;]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(email => ({ email }));
}

function validate(raw: { email: string; fullName?: string }[]): ParsedEntry[] {
  const seen = new Set<string>();
  return raw.map(r => {
    const email = r.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { email: r.email, status: 'invalid', reason: 'Invalid format' };
    if (seen.has(email)) return { email, status: 'duplicate', reason: 'Duplicate in batch' };
    seen.add(email);
    return { email, fullName: r.fullName?.trim() || undefined, status: 'valid' };
  });
}

export function BulkInviteStudentsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('csv');
  const [csvFileName, setCsvFileName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [orgId, setOrgId] = useState<string>('none');
  const [notes, setNotes] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: organizations } = useActiveOrganizations();
  const bulkInvite = useBulkInvite();
  const { data: jobData } = useBulkInviteJob(activeJobId);

  const valid = useMemo(() => parsed.filter(p => p.status === 'valid'), [parsed]);
  const invalid = useMemo(() => parsed.filter(p => p.status === 'invalid'), [parsed]);
  const dupes = useMemo(() => parsed.filter(p => p.status === 'duplicate'), [parsed]);
  const overLimit = valid.length > MAX;

  const handleFile = async (file: File) => {
    setCsvFileName(file.name);
    const text = await file.text();
    setParsed(validate(parseCsv(text)));
  };

  const handlePasteChange = (text: string) => {
    setPastedText(text);
    setParsed(validate(parsePasted(text)));
  };

  const handleSubmit = async () => {
    if (valid.length === 0) {
      toast.error('Add at least one valid email.');
      return;
    }
    if (overLimit) {
      toast.error(`Max ${MAX} emails per batch.`);
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
                    Format: one email per row. Optional <code>email,full_name</code> headers.
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
                <Label>Paste emails (comma, space, or newline separated)</Label>
                <Textarea
                  rows={6}
                  value={pastedText}
                  onChange={e => handlePasteChange(e.target.value)}
                  placeholder="alice@example.com, bob@example.com&#10;charlie@example.com"
                />
              </TabsContent>
            </Tabs>

            {parsed.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    {valid.length} valid
                  </Badge>
                  {dupes.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                      {dupes.length} duplicate
                    </Badge>
                  )}
                  {invalid.length > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      {invalid.length} invalid
                    </Badge>
                  )}
                </div>

                {overLimit && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Maximum {MAX} emails per batch. You have {valid.length} valid emails.
                    </AlertDescription>
                  </Alert>
                )}

                {(invalid.length > 0 || dupes.length > 0) && (
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <div className="space-y-1 text-xs">
                      {[...invalid, ...dupes].slice(0, 50).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono truncate">{p.email}</span>
                          <span className="ml-2 shrink-0">{p.reason}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
                disabled={bulkInvite.isPending || valid.length === 0 || overLimit}
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
