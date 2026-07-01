import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { NotebookPen, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Row {
  id: string;
  student_id: string;
  author_id: string;
  title: string | null;
  content: string;
  note_type: string;
  contact_date: string | null;
  created_at: string;
}

export default function CaseNotesActivity() {
  const [days, setDays] = useState(30);
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['recent-case-notes', days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: notes, error } = await supabase
        .from('file_notes')
        .select('id, student_id, author_id, title, content, note_type, contact_date, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (notes || []) as Row[];
      const ids = Array.from(new Set(rows.flatMap((r) => [r.student_id, r.author_id])));
      if (ids.length === 0) return { rows, profiles: new Map() };
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return { rows, profiles: map };
    },
    refetchOnWindowFocus: true,
  });

  const filtered = useMemo(() => {
    const rows = data?.rows || [];
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    const p = data!.profiles;
    return rows.filter((r) => {
      const student = (p.get(r.student_id) as any)?.full_name?.toLowerCase() || '';
      const author = (p.get(r.author_id) as any)?.full_name?.toLowerCase() || '';
      return (
        student.includes(needle) ||
        author.includes(needle) ||
        (r.title || '').toLowerCase().includes(needle) ||
        (r.content || '').toLowerCase().includes(needle)
      );
    });
  }, [data, q]);

  return (
    <SidebarLayout>
      <PageHeader
        title="Recent Case Notes"
        description="Every case note added across accessible students in the selected window."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Search student, author, title or content..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
              className="rounded-full"
            >
              {d}d
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {isLoading ? '…' : `${filtered.length} note${filtered.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No case notes found" description="Try widening the date range or clearing the search." />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const student = (data!.profiles.get(n.student_id) as any) || {};
            const author = (data!.profiles.get(n.author_id) as any) || {};
            const dateStr = n.contact_date
              ? format(new Date(n.contact_date), 'MMM d, yyyy')
              : format(new Date(n.created_at), 'MMM d, yyyy');
            return (
              <Card key={n.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="secondary">{dateStr}</Badge>
                        <Badge variant="outline">{n.note_type}</Badge>
                        <span className="text-muted-foreground">
                          {student.full_name || student.email || 'Unknown student'} · by {author.full_name || author.email || 'Unknown'}
                        </span>
                      </div>
                      {n.title && <p className="text-sm font-medium">{n.title}</p>}
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {n.content}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="rounded-full">
                      <Link to={`/students/${n.student_id}?tab=case-notes`}>
                        Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SidebarLayout>
  );
}
