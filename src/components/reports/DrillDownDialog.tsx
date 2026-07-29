import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { SupportRequest, Appointment, RequestUpdate } from '@/types/database';
import type { CaseNoteRow } from '@/hooks/useCaseNotesSummary';

export type DrillDownPayload =
  | { kind: 'requests'; title: string; description?: string; rows: SupportRequest[] }
  | { kind: 'notes'; title: string; description?: string; rows: CaseNoteRow[] }
  | { kind: 'appointments'; title: string; description?: string; rows: Appointment[] }
  | { kind: 'status-changes'; title: string; description?: string; rows: RequestUpdate[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: DrillDownPayload | null;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const v = c == null ? '' : String(c);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    )
    .join('\n');
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DrillDownDialog({ open, onOpenChange, payload }: Props) {
  const csv = useMemo(() => {
    if (!payload) return '';
    if (payload.kind === 'requests') {
      const header = ['Created', 'Title', 'Student', 'Category', 'Priority', 'Status', 'Requested', 'Approved'];
      const rows = payload.rows.map((r: any) => [
        r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
        r.title || '',
        r.student?.full_name || '',
        r.category || '',
        r.priority || '',
        r.status || '',
        r.requested_amount != null ? String(r.requested_amount) : '',
        r.approved_amount != null ? String(r.approved_amount) : '',
      ]);
      return toCsv([header, ...rows]);
    }
    if (payload.kind === 'notes') {
      const header = ['Date', 'Student', 'Author', 'Category', 'Contact type', 'Duration (min)', 'Title', 'Next steps'];
      const rows = payload.rows.map((r) => [
        r.contact_date || (r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd') : ''),
        r.student_name || '',
        r.author_name || '',
        r.note_type || '',
        r.contact_type || '',
        r.duration_minutes != null ? String(r.duration_minutes) : '',
        r.title || '',
        r.next_steps || '',
      ]);
      return toCsv([header, ...rows]);
    }
    if (payload.kind === 'appointments') {
      const header = ['Scheduled', 'Title', 'Status'];
      const rows = payload.rows.map((a) => [
        format(new Date(a.scheduled_at), 'yyyy-MM-dd HH:mm'),
        a.title,
        a.status,
      ]);
      return toCsv([header, ...rows]);
    }
    // status-changes
    const header = ['Date', 'From', 'To', 'Note'];
    const rows = payload.rows.map((s) => [
      format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      s.previous_status || '',
      s.new_status || '',
      s.note || '',
    ]);
    return toCsv([header, ...rows]);
  }, [payload]);

  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{payload.title}</DialogTitle>
          {payload.description && <DialogDescription>{payload.description}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {payload.rows.length} record{payload.rows.length === 1 ? '' : 's'}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={payload.rows.length === 0}
            onClick={() =>
              downloadCsv(
                `${payload.title.replace(/\s+/g, '-').toLowerCase()}.csv`,
                csv,
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/60">
          {payload.rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No matching records.</div>
          ) : payload.kind === 'requests' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.created_at ? format(new Date(r.created_at), 'PP') : '—'}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.title}</TableCell>
                    <TableCell>{r.student?.full_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{r.priority}</Badge></TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.requested_amount ? formatCurrency(r.requested_amount) : '—'}
                    </TableCell>
                    <TableCell>
                      <Link to={`/requests/${r.id}`} onClick={() => onOpenChange(false)}>
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : payload.kind === 'notes' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Min</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.contact_date
                        ? format(new Date(r.contact_date), 'PP')
                        : format(new Date(r.created_at), 'PP')}
                    </TableCell>
                    <TableCell>{r.student_name || '—'}</TableCell>
                    <TableCell>{r.author_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{r.note_type}</Badge></TableCell>
                    <TableCell className="text-xs">{r.contact_type || '—'}</TableCell>
                    <TableCell className="text-xs">{r.duration_minutes ?? '—'}</TableCell>
                    <TableCell>
                      <Link
                        to={`/students/${r.student_id}`}
                        onClick={() => onOpenChange(false)}
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : payload.kind === 'appointments' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(a.scheduled_at), 'PP p')}
                    </TableCell>
                    <TableCell>{a.title}</TableCell>
                    <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(s.created_at), 'PP p')}
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.previous_status || '—'}</Badge></TableCell>
                    <TableCell><Badge>{s.new_status || '—'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.note || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
