import { useState } from 'react';
import { 
  Building2, Plus, Pencil, Users, Search, 
  GraduationCap, UserCheck, Shield, Loader2,
  Mail, User, ToggleLeft, ToggleRight
} from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  useTrainingOrganizations, 
  useCreateOrganization, 
  useUpdateOrganization,
  type TrainingOrganization 
} from '@/hooks/useTrainingOrganizations';
import { useUsers } from '@/hooks/useUsers';
import { BulkAssignOrgDialog } from '@/components/admin/BulkAssignOrgDialog';
export default function TrainingOrganizations() {
  const { data: orgs, isLoading } = useTrainingOrganizations();
  const { data: users } = useUsers();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<TrainingOrganization | null>(null);
  const [form, setForm] = useState({ name: '', description: '', contact_name: '', contact_email: '' });
  const [bulkAssignOrg, setBulkAssignOrg] = useState<TrainingOrganization | null>(null);

  const filtered = (orgs || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.contact_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Count members per org by role
  const getMemberCounts = (orgId: string) => {
    if (!users) return { students: 0, case_managers: 0, admins: 0 };
    const orgUsers = users.filter((u: any) => u.organization_id === orgId);
    return {
      students: orgUsers.filter((u: any) => u.role === 'student').length,
      case_managers: orgUsers.filter((u: any) => u.role === 'case_manager').length,
      admins: orgUsers.filter((u: any) => u.role === 'admin').length,
    };
  };

  const openCreate = () => {
    setEditingOrg(null);
    setForm({ name: '', description: '', contact_name: '', contact_email: '' });
    setDialogOpen(true);
  };

  const openEdit = (org: TrainingOrganization) => {
    setEditingOrg(org);
    setForm({
      name: org.name,
      description: org.description || '',
      contact_name: org.contact_name || '',
      contact_email: org.contact_email || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Organization name is required.', variant: 'destructive' });
      return;
    }
    try {
      if (editingOrg) {
        await updateOrg.mutateAsync({
          id: editingOrg.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          contact_name: form.contact_name.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
        });
        toast({ title: 'Updated', description: `${form.name} has been updated.` });
      } else {
        await createOrg.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          contact_name: form.contact_name.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
        });
        toast({ title: 'Created', description: `${form.name} has been added.` });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Something went wrong.', variant: 'destructive' });
    }
  };

  const toggleActive = async (org: TrainingOrganization) => {
    await updateOrg.mutateAsync({ id: org.id, is_active: !org.is_active });
    toast({ title: org.is_active ? 'Deactivated' : 'Activated', description: `${org.name} has been ${org.is_active ? 'deactivated' : 'activated'}.` });
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Training Organizations"
            description="Manage partner organizations and assign users to them"
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Organizations</CardDescription>
              <CardTitle className="text-3xl">{orgs?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl">{orgs?.filter(o => o.is_active).length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactive</CardDescription>
              <CardTitle className="text-3xl">{orgs?.filter(o => !o.is_active).length || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search organizations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium">No organizations found</p>
              <p className="text-sm text-muted-foreground mt-1">Add a training organization to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Members</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(org => {
                  const counts = getMemberCounts(org.id);
                  const totalMembers = counts.students + counts.case_managers + counts.admins;
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          {org.description && <p className="text-xs text-muted-foreground line-clamp-1">{org.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.contact_name ? (
                          <div className="text-sm">
                            <p>{org.contact_name}</p>
                            {org.contact_email && <p className="text-muted-foreground text-xs">{org.contact_email}</p>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {totalMembers === 0 ? (
                            <span className="text-muted-foreground text-sm">No members</span>
                          ) : (
                            <>
                              {counts.students > 0 && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <GraduationCap className="h-3 w-3" />{counts.students}
                                </Badge>
                              )}
                              {counts.case_managers > 0 && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <UserCheck className="h-3 w-3" />{counts.case_managers}
                                </Badge>
                              )}
                              {counts.admins > 0 && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Shield className="h-3 w-3" />{counts.admins}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 px-2"
                          onClick={() => toggleActive(org)}
                          disabled={updateOrg.isPending}
                        >
                          {org.is_active ? (
                            <><ToggleRight className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Active</span></>
                          ) : (
                            <><ToggleLeft className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Inactive</span></>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setBulkAssignOrg(org)} title="Assign users">
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(org)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOrg ? 'Edit Organization' : 'Add Organization'}</DialogTitle>
              <DialogDescription>
                {editingOrg ? 'Update the organization details.' : 'Add a new training organization.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. TechBridge Academy" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the organization" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="john@org.com" />
                </div>
              </div>
              {editingOrg && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Active Status</p>
                    <p className="text-xs text-muted-foreground">Inactive orgs won't appear in selection dropdowns</p>
                  </div>
                  <Switch checked={editingOrg.is_active} onCheckedChange={() => toggleActive(editingOrg)} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createOrg.isPending || updateOrg.isPending}>
                {(createOrg.isPending || updateOrg.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOrg ? 'Save Changes' : 'Create Organization'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarLayout>
  );
}
