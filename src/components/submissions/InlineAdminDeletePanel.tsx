import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { useMyCheckIns, useDeleteCheckIn } from '@/hooks/useStudentCheckIns';
import { useMyPlans, useDeletePlan } from '@/hooks/usePostGraduationPlan';
import { useIntakeSurvey } from '@/hooks/useIntakeSurvey';
import { format } from 'date-fns';

type Kind = 'checkin' | 'plan' | 'intake';

const LABELS: Record<Kind, { title: string; singular: string }> = {
  checkin: { title: 'Check-in submissions', singular: 'check-in' },
  plan: { title: 'Post-Graduation Plan submissions', singular: 'plan' },
  intake: { title: 'Intake Survey responses', singular: 'intake response' },
};

export function InlineAdminDeletePanel({ kind }: { kind: Kind }) {
  const { role } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Hooks must be called unconditionally
  const myCheckins = useMyCheckIns();
  const myPlans = useMyPlans();
  const intake = useIntakeSurvey();
  const delCheckin = useDeleteCheckIn();
  const delPlan = useDeletePlan();

  if (role !== 'admin') return null;

  const rows: { id: string; label: string; sub?: string }[] = (() => {
    if (kind === 'checkin') {
      return (myCheckins.data || []).map((c) => ({
        id: c.id,
        label: format(new Date(c.created_at), 'PPp'),
        sub: `Mood ${c.mood_rating}/5 · Progress ${c.progress_rating}/5`,
      }));
    }
    if (kind === 'plan') {
      return (myPlans.data || []).map((p: any) => ({
        id: p.id,
        label: format(new Date(p.created_at), 'PPp'),
        sub: p.graduation_date ? `Graduation ${p.graduation_date}` : undefined,
      }));
    }
    return (intake.responses || []).map((r: any) => ({
      id: r.id,
      label: r.section,
      sub: format(new Date(r.created_at), 'PPp'),
    }));
  })();

  const onDelete = async (id: string) => {
    try {
      if (kind === 'checkin') await delCheckin.mutateAsync(id);
      else if (kind === 'plan') await delPlan.mutateAsync(id);
      else await intake.deleteSection.mutateAsync(id);
      toast.success('Submission deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card className="border border-destructive/30 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Admin · {LABELS[kind].title}
              <Badge variant="secondary" className="rounded-full">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>
              Delete your own {LABELS[kind].singular}s here. To manage another student's submissions, open their record.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/admin/students">Manage by student</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions on file for your account.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.label}</p>
                {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full"
                onClick={() => setPendingId(r.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <AlertDialog open={!!pendingId} onOpenChange={(o) => !o && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {LABELS[kind].singular}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is irreversible. The submission will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingId && onDelete(pendingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
