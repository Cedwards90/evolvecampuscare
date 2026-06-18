import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatHours, type TimeEntry } from '@/hooks/useTimeEntries';

interface Props {
  entries: TimeEntry[];
  showCaseManager?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  onEdit?: (e: TimeEntry) => void;
  onDelete?: (e: TimeEntry) => void;
  canModify?: (e: TimeEntry) => boolean;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

export function TimeEntryTable({
  entries,
  showCaseManager,
  selectable,
  selectedIds = [],
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  canModify,
}: Props) {
  const allSelected = selectable && entries.length > 0 && selectedIds.length === entries.length;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </TableHead>
            )}
            <TableHead>Date</TableHead>
            {showCaseManager && <TableHead>Case manager</TableHead>}
            <TableHead>Client</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Billable</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No time entries.</TableCell>
            </TableRow>
          ) : entries.map((e) => {
            const editable = canModify ? canModify(e) : false;
            return (
              <TableRow key={e.id}>
                {selectable && (
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={() => onToggle?.(e.id)} />
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">{format(new Date(e.entry_date), 'MMM d, yyyy')}</TableCell>
                {showCaseManager && (
                  <TableCell className="whitespace-nowrap">{e.case_manager?.full_name || e.case_manager?.email || '—'}</TableCell>
                )}
                <TableCell className="whitespace-nowrap">{e.student?.full_name || e.student?.email || <span className="text-muted-foreground">Internal</span>}</TableCell>
                <TableCell className="capitalize">{e.service_type.replace('_', ' ')}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{e.start_time.slice(0,5)}–{e.end_time.slice(0,5)}</TableCell>
                <TableCell className="text-right">{formatHours(e.duration_minutes)}</TableCell>
                <TableCell>{e.billable ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.status]} className="capitalize">{e.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {onEdit && editable && (
                      <Button size="icon" variant="ghost" onClick={() => onEdit(e)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    )}
                    {onDelete && editable && (
                      <Button size="icon" variant="ghost" onClick={() => onDelete(e)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
