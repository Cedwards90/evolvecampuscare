import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Users, Mail, User, GraduationCap, UserCheck, Shield, FileText, Ban, RotateCcw, History } from 'lucide-react';
import { format } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { PageNav } from '@/components/navigation/PageNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrganizationDetail } from '@/hooks/useOrganizationDetail';
import { useAuth } from '@/contexts/AuthContext';
import { useMyOrgAdminOrgs } from '@/hooks/useOrgAdmins';
import { useOrgSuspensionAudit } from '@/hooks/useOrgSuspension';
import { SuspendOrgDialog } from '@/components/admin/SuspendOrgDialog';

const roleIcons: Record<string, typeof GraduationCap> = {
  student: GraduationCap,
  case_manager: UserCheck,
  admin: Shield,
};

const roleLabels: Record<string, string> = {
  student: 'Student',
  case_manager: 'Case Manager',
  admin: 'Admin',
};

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const { org, members, stats } = useOrganizationDetail(id);
  const { role } = useAuth();
  const { data: myOrgAdminOrgs } = useMyOrgAdminOrgs();
  const audit = useOrgSuspensionAudit(id);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const isAdmin = role === 'admin';
  const isOrgAdminHere = !!id && (myOrgAdminOrgs ?? []).includes(id);
  // Org admins lose all write ability once a platform admin suspends the org.
  // Only platform admins can reinstate.
  const canManageSuspension = isAdmin || (isOrgAdminHere && !org.data?.suspended_at);
  const canViewAudit = isAdmin || isOrgAdminHere;

  if (org.isLoading) {
    return <SidebarLayout><LoadingSpinner /></SidebarLayout>;
  }

  if (!org.data) {
    return (
      <SidebarLayout>
        <div className="space-y-6">
          <PageNav
            fallback="/admin/organizations"
            crumbs={[
              { label: 'Organizations', to: '/admin/organizations' },
              { label: 'Not found' },
            ]}
          />
          <EmptyState icon={Building2} title="Organization not found" description="This organization doesn't exist or you don't have access." />
        </div>
      </SidebarLayout>
    );
  }

  const organization = org.data;
  const allMembers = members.data || [];
  const currentMembers = allMembers.filter(m => !m.left_at);
  const pastMembers = allMembers.filter(m => m.left_at);
  const requestStats = stats.data || { total: 0, pending: 0, resolved: 0 };

  const MemberRow = ({ member, showLeftAt }: { member: typeof allMembers[0]; showLeftAt?: boolean }) => {
    const RoleIcon = roleIcons[member.role] || User;
    return (
      <TableRow>
        <TableCell>
          <Link to={`/students/${member.user_id}`} className="font-medium hover:underline">
            {member.full_name || 'Unnamed'}
          </Link>
          <p className="text-xs text-muted-foreground">{member.email}</p>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="gap-1">
            <RoleIcon className="h-3 w-3" />
            {roleLabels[member.role] || member.role}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
          {format(new Date(member.joined_at), 'MMM d, yyyy')}
        </TableCell>
        {showLeftAt && (
          <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
            {member.left_at ? format(new Date(member.left_at), 'MMM d, yyyy') : '—'}
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageNav
          fallback="/admin/organizations"
          crumbs={[
            { label: 'Organizations', to: '/admin/organizations' },
            { label: organization.name },
          ]}
        />

        {/* Header */}
        <Card className={organization.suspended_at ? 'border-destructive/50' : undefined}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-h2 font-bold">{organization.name}</h1>
                  {organization.suspended_at ? (
                    <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Suspended</Badge>
                  ) : (
                    <Badge variant={organization.is_active ? 'default' : 'secondary'}>
                      {organization.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </div>
                {organization.description && <p className="text-muted-foreground mt-1">{organization.description}</p>}
                {organization.contact_name && (
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{organization.contact_name}</span>
                    {organization.contact_email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{organization.contact_email}</span>}
                  </div>
                )}
                {organization.suspended_at && (
                  <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm">
                    <p className="font-medium text-destructive">
                      Suspended on {format(new Date(organization.suspended_at), 'MMM d, yyyy')}
                    </p>
                    {organization.suspension_reason && (
                      <p className="text-destructive/90 mt-0.5">Reason: {organization.suspension_reason}</p>
                    )}
                  </div>
                )}
                {canManageSuspension && (
                  <div className="mt-3">
                    {organization.suspended_at ? (
                      <Button size="sm" variant="outline" onClick={() => setSuspendOpen(true)}>
                        <RotateCcw className="h-4 w-4 mr-2" />Reinstate access
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => setSuspendOpen(true)}>
                        <Ban className="h-4 w-4 mr-2" />Suspend access
                      </Button>
                    )}
                  </div>
                )}
                {!canManageSuspension && organization.suspended_at && isOrgAdminHere && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Only a platform administrator can reinstate this organization.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{currentMembers.length}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{requestStats.total}</p>
                  <p className="text-xs text-muted-foreground">Requests</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{requestStats.resolved}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="current" className="space-y-4">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="current" className="gap-2">
              <Users className="h-4 w-4" />Current Members ({currentMembers.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <Users className="h-4 w-4" />Past Members ({pastMembers.length})
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <FileText className="h-4 w-4" />Request Stats
            </TabsTrigger>
            {canViewAudit && (
              <TabsTrigger value="audit" className="gap-2">
                <History className="h-4 w-4" />Suspension Log
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="current">
            {currentMembers.length === 0 ? (
              <EmptyState icon={Users} title="No current members" description="No users are currently assigned to this organization." />
            ) : (
              <Card>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMembers.map(m => <MemberRow key={`${m.user_id}-${m.joined_at}`} member={m} />)}
                  </TableBody>
                </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastMembers.length === 0 ? (
              <EmptyState icon={Users} title="No past members" description="No users have left this organization." />
            ) : (
              <Card>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Joined</TableHead>
                      <TableHead className="hidden sm:table-cell">Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastMembers.map(m => <MemberRow key={`${m.user_id}-${m.joined_at}`} member={m} showLeftAt />)}
                  </TableBody>
                </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Requests</CardDescription>
                  <CardTitle className="text-3xl">{requestStats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="text-3xl">{requestStats.pending}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resolved</CardDescription>
                  <CardTitle className="text-3xl">{requestStats.resolved}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>

          {canViewAudit && (
            <TabsContent value="audit">
              {(audit.data ?? []).length === 0 ? (
                <EmptyState icon={History} title="No suspension events" description="This organization has not been suspended or reinstated." />
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.data!.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(new Date(a.created_at), 'MMM d, yyyy h:mm a')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={a.action === 'suspended' ? 'destructive' : 'default'}>
                                {a.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{a.reason || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>

        {canManageSuspension && (
          <SuspendOrgDialog
            open={suspendOpen}
            onOpenChange={setSuspendOpen}
            orgId={organization.id}
            orgName={organization.name}
            mode={organization.suspended_at ? 'reinstate' : 'suspend'}
          />
        )}
      </div>
    </SidebarLayout>
  );
}
