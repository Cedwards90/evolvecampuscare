import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { CohortStudentsDialog } from './CohortStudentsDialog';
import {
  useAllCohortsDetailed,
  useDeleteCohort,
  useUnassignedStudentsCount,
  type Cohort,
  type CohortWithDetails,
} from '@/hooks/useCohorts';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/** Cross-organization list of classes with create, edit and assignment actions. */
export function CohortsIndex() {
  const { role } = useAuth();
  const { toast } = useToast();
  const { data: cohorts, isLoading } = useAllCohortsDetailed();
  const { data: organizations } = useActiveOrganizations();
  const { data: orgAdminOrgs } = useMyOrgAdminOrgs();
  const { data: unassignedCount } = useUnassignedStudentsCount();
  const deleteCohort = useDeleteCohort();

  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [hideGraduated, setHideGraduated] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [managing, setManaging] = useState<Cohort | null>(null);
  const [deleting, setDeleting] = useState<CohortWithDetails | null>(null);

  const isAdmin = role === 'admin';
  const canManage = (organizationId: string) =>
    isAdmin || (role === 'org_admin' && (orgAdminOrgs ?? []).includes(organizationId));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cohorts || []).filter((c) => {
      if (orgFilter !== 'all' && c.organization_id !== orgFilter) return false;
      if (hideGraduated && c.graduated_at) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.organization_name || '').toLowerCase().includes(q)
      );
    });
  }, [cohorts, search, orgFilter, hideGraduated]);

  const handleDelete = async () => {
    if (!deleting) return;
    if (deleting.student_count > 0) {
      toast({
        title: 'Cannot delete this class',
        description: 'Move its students to another class first. Students are never deleted.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await deleteCohort.mutateAsync(deleting.id);
      toast({ title: 'Class deleted' });
      setDeleting(null);
    } catch (e: any) {
      toast({ title: 'Failed to delete class', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {typeof unassignedCount === 'number' && unassignedCount > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {unassignedCount} student{unassignedCount === 1 ? '' : 's'} are not in any class yet
              </p>
              <p className="text-sm text-muted-foreground">
                Open a class below and use "In no class" to add them, including students added long ago.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="rounded-full">
              <Link to="/admin/users">
                <UsersRound className="h-4 w-4 mr-1.5" />
                View students
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Classes
              </CardTitle>
              <CardDescription>
                Every class across all organizations. Create one, then add students and case managers.
              </CardDescription>
            </div>
            <Button size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New class
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search class or organization…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-[220px] rounded-full">
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {(organizations || [])
                  .filter((o) => isAdmin || (orgAdminOrgs ?? []).includes(o.id))
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="hide-graduated" checked={hideGraduated} onCheckedChange={setHideGraduated} />
              <Label htmlFor="hide-graduated" className="text-sm font-normal">
                Hide graduated
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={(cohorts || []).length === 0 ? 'No classes yet' : 'No classes match your search'}
              description={
                (cohorts || []).length === 0
                  ? 'Create your first class, then add students to it — new and existing.'
                  : 'Try a different name, organization, or clear the graduated filter.'
              }
              action={
                (cohorts || []).length === 0 ? (
                  <Button onClick={() => setCreateOpen(true)} className="rounded-full">
                    <Plus className="h-4 w-4 mr-1.5" />
                    New class
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="hidden md:table-cell">Dates</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead className="hidden sm:table-cell">Case managers</TableHead>
                    <TableHead className="w-[190px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const manage = canManage(c.organization_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="min-w-[180px]">
                          <div className="font-medium break-words">{c.name}</div>
                          {c.graduated_at && (
                            <Badge variant="outline" className="mt-1 gap-1">
                              <GraduationCap className="h-3 w-3" />
                              Graduated {format(new Date(c.graduated_at), 'MMM d, yyyy')}
                            </Badge>
                          )}
                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="break-words">
                          <Link to={`/admin/organizations/${c.organization_id}`} className="hover:underline">
                            {c.organization_name || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {c.start_date ? format(new Date(c.start_date), 'MMM d, yyyy') : '—'}
                          {' → '}
                          {c.end_date ? format(new Date(c.end_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {c.student_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{c.case_manager_count}</TableCell>
                        <TableCell className="text-right">
                          {manage ? (
                            <div className="flex justify-end">
                              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setManaging(c)}>
                                <UserPlus className="h-4 w-4 mr-1" />
                                People
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="Edit class">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleting(c)}
                                className="text-destructive hover:text-destructive"
                                aria-label="Delete class"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">View only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CohortDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allowedOrganizationIds={isAdmin ? undefined : orgAdminOrgs ?? []}
      />
      <CohortDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        organizationId={editing?.organization_id}
        cohort={editing}
      />
      <CohortStudentsDialog
        open={!!managing}
        onOpenChange={(o) => !o && setManaging(null)}
        cohort={managing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleting?.student_count ?? 0) > 0 ? (
                <>
                  This class still has <strong>{deleting?.student_count}</strong> student(s). Move them to another class
                  first — students themselves are never deleted.
                </>
              ) : (
                <>This removes the class only. Student records stay exactly as they are.</>
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
    </div>
  );
}
