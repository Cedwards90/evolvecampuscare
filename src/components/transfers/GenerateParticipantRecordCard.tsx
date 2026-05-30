import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, FileText, Package } from 'lucide-react';
import { useGenerateParticipantRecord, useParticipantExports, useGetExportUrl } from '@/hooks/useParticipantTransfers';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const RECORD_TYPES = [
  { id: 'requests', label: 'Support requests & updates' },
  { id: 'case_notes', label: 'Case notes' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'intake', label: 'Intake responses' },
  { id: 'post_grad', label: 'Post-graduation plans' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'attachments', label: 'Uploaded documents (ZIP only)' },
  { id: 'messages', label: 'Communication history' },
];

const PURPOSES = [
  { value: 'handoff', label: 'Provider handoff' },
  { value: 'transition', label: 'Participant transition' },
  { value: 'audit', label: 'Compliance audit' },
  { value: 'grant', label: 'Grant reporting' },
  { value: 'other', label: 'Other' },
];

interface Props {
  studentId: string;
  transferId?: string | null;
}

export function GenerateParticipantRecordCard({ studentId, transferId = null }: Props) {
  const { toast } = useToast();
  const [format_, setFormat] = useState<'pdf' | 'zip'>('pdf');
  const [purpose, setPurpose] = useState('handoff');
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<string[]>(RECORD_TYPES.map((r) => r.id));
  const gen = useGenerateParticipantRecord();
  const { data: exports = [] } = useParticipantExports(studentId);
  const getUrl = useGetExportUrl();

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleGenerate() {
    try {
      const res = await gen.mutateAsync({
        student_id: studentId,
        format: format_,
        purpose,
        notes,
        include: selected,
        transfer_id: transferId,
      });
      toast({ title: 'Record generated', description: `${res.export.format.toUpperCase()} bundle ready.` });
      if (res.signed_url) window.open(res.signed_url, '_blank');
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    }
  }

  async function handleDownload(exportId: string) {
    try {
      const url = await getUrl.mutateAsync(exportId);
      window.open(url, '_blank');
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Generate Participant Record
          </CardTitle>
          <CardDescription>
            One-click handoff-ready report. PDF gives a complete narrative; ZIP also bundles original attachments and certification files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Format</Label>
              <Select value={format_} onValueChange={(v) => setFormat(v as 'pdf' | 'zip')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF report</SelectItem>
                  <SelectItem value="zip">ZIP bundle (PDF + files)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Sections to include</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 border rounded-md">
              {RECORD_TYPES.map((rt) => (
                <label key={rt.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selected.includes(rt.id)} onCheckedChange={() => toggle(rt.id)} />
                  <span className="text-sm">{rt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context for the receiving organization or auditor…" />
          </div>

          <Button onClick={handleGenerate} disabled={gen.isPending || selected.length === 0}>
            {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (format_ === 'zip' ? <Package className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />)}
            Generate {format_.toUpperCase()}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export history</CardTitle>
          <CardDescription>All records generated for this participant.</CardDescription>
        </CardHeader>
        <CardContent>
          {exports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet.</p>
          ) : (
            <div className="space-y-2">
              {exports.map((e) => (
                <div key={e.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{e.format.toUpperCase()}</Badge>
                      <Badge variant="secondary">{e.purpose}</Badge>
                      {(e.validation_report?.length ?? 0) > 0 && (
                        <Badge variant="destructive">{e.validation_report.length} finding(s)</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), 'PPpp')} • {e.file_size ? `${(e.file_size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(e.id)} disabled={getUrl.isPending}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
