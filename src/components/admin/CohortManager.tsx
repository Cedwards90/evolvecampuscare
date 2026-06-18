import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Users, GraduationCap, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { EmptyState } from '@/components/EmptyState';
import { CohortDialog } from './CohortDialog';
import { useOrgCohorts, useDeleteCohort, type Cohort } from '@/hooks/useCohorts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';

interface Props {
  organizationId: string;
}

export function CohortManager({ organizationId }: Props) {
  const { role } = useAuth();
  const { data: orgAdminOrgs } = useMyOrgAdminOrgs();
  const { data: cohorts, isLoading } = useOrgCohorts(organizationId);
  const deleteCohort = useDeleteCohort();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [deleting, setDeleting] = useState<Cohort | null>(null);

  const canManage =
    role === 'admin' || (role === 'org_admin' && (orgAdminOrgs ?? []).includes(organizationId));

  const handleDelete = async () => {
    if (!deleting) return;
    if ((deleting.student_count ?? 0) > 0) {
      toast({
        title: 'Cannot delete cohort',
        description: 'Reassign or remove students from this cohort first.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await deleteCohort.mutateAsync(deleting.id);
      toast({ title: 'Cohort deleted' });
      setDeleting(null);
    } catch (e: any) {
      toast({ title: 'Failed to delete cohort', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Classes / Cohorts
          </CardTitle>
          <CardDescription>Group students inside this organization.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="rounded-full">
            <Plus className="h-4 w-4 mr-1.5" />
            New cohort
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !cohorts || cohorts.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No cohorts yet"
            description={canManage ? 'Create a cohort to start grouping students.' : 'No cohorts have been created for this organization.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Dates</TableHead>
                  <TableHead>Students</TableHead>
                  {canManage && <TableHead className="w-[120px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohorts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {c.start_date ? format(new Date(c.start_date), 'MMM d, yyyy') : '—'}
                      {' → '}
                      {c.end_date ? format(new Date(c.end_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {c.student_count ?? 0}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(c)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {canManage && (
        <>
          <CohortDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            organizationId={organizationId}
          />
          <CohortDialog
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
            organizationId={organizationId}
            cohort={editing}
          />
          <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete cohort?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(deleting?.student_count ?? 0) > 0 ? (
                    <>
                      This cohort still has <strong>{deleting?.student_count}</strong> student(s).
                      Reassign them first — students themselves will not be deleted.
                    </>
                  ) : (
                    <>This will remove the cohort. Students are never deleted.</>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteCohort.isPending || (deleting?.student_count ?? 0) > 0}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteCohort.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </Card>
  );
}
