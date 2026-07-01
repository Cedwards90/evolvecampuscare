import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Users, Trash2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useSurveyCompletions, type CompletionSource } from '@/hooks/useSurveyCompletions';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: CompletionSource | null;
  title: string;
}

export function SurveyCompletionsDialog({ open, onOpenChange, source, title }: Props) {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading, error } = useSurveyCompletions(source, open);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.full_name || '').toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.organization_name || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Completed by — {title}</DialogTitle>
          <DialogDescription>
            {rows.length} student{rows.length === 1 ? '' : 's'} have completed this survey.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by student or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : error ? (
          <p className="text-sm text-destructive py-6 text-center">Could not load completions.</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No completions yet" description="When students complete this survey, they'll appear here." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No results match your search.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead>Last submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.student_id}>
                    <TableCell>
                      <Link
                        to={`/students/${r.student_id}`}
                        className="font-medium text-primary hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        {r.full_name || r.email}
                      </Link>
                      {r.full_name && (
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.organization_name || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{r.count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.last_at ? format(new Date(r.last_at), 'PPP') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
