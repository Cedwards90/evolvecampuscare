import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Users, 
  Shield, 
  UserCheck, 
  GraduationCap,
  MoreHorizontal,
  Mail,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Send,
  Trash2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { PendingInvitationsSection } from '@/components/admin/PendingInvitationsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePendingInvitations } from '@/hooks/useInvitations';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers, useUpdateUserRole, useDeleteUser } from '@/hooks/useUsers';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import type { AppRole } from '@/types/database';

const ITEMS_PER_PAGE = 10;

const roleIcons: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap,
  case_manager: UserCheck,
  admin: Shield,
};

const roleColors: Record<AppRole, string> = {
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  case_manager: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; currentRole: AppRole } | null>(null);
  const [newRole, setNewRole] = useState<AppRole | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string; role: AppRole } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const { data: organizations } = useTrainingOrganizations();
  const { data: pendingInvitations } = usePendingInvitations();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  // Filter and paginate users
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    return users.filter(user => {
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesOrg = orgFilter === 'all' || user.organization_id === orgFilter;
      
      return matchesSearch && matchesRole && matchesOrg;
    });
  }, [users, searchQuery, roleFilter, orgFilter]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Stats
  const stats = useMemo(() => {
    if (!users) return { total: 0, students: 0, caseManagers: 0, admins: 0, pendingInvites: 0 };
    
    return {
      total: users.length,
      students: users.filter(u => u.role === 'student').length,
      caseManagers: users.filter(u => u.role === 'case_manager').length,
      admins: users.filter(u => u.role === 'admin').length,
      pendingInvites: pendingInvitations?.length || 0,
    };
  }, [users, pendingInvitations]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await updateRole.mutateAsync({
        userId: selectedUser.id,
        newRole: newRole,
      });
      toast({
        title: 'Role Updated',
        description: `${selectedUser.name}'s role has been changed to ${newRole.replace('_', ' ')}.`,
      });
      setSelectedUser(null);
      setNewRole(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user role. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openRoleDialog = (userId: string, name: string, currentRole: AppRole, targetRole: AppRole) => {
    setSelectedUser({ id: userId, name, currentRole });
    setNewRole(targetRole);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || deleteConfirmation !== 'DELETE') return;

    try {
      await deleteUser.mutateAsync(userToDelete.id);
      toast({
        title: 'User Deleted',
        description: `${userToDelete.name} has been permanently removed from the system.`,
      });
      setUserToDelete(null);
      setDeleteConfirmation('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (userId: string, name: string, email: string, role: AppRole) => {
    setUserToDelete({ id: userId, name, email, role });
    setDeleteConfirmation('');
  };

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="User Management"
            description="Manage users and their roles across the platform"
          />
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <InviteUserDialog />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                All registered users
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Students</CardDescription>
              <CardTitle className="text-3xl">{stats.students}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                Active student accounts
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Case Managers</CardDescription>
              <CardTitle className="text-3xl">{stats.caseManagers}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                Support staff
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Administrators</CardDescription>
              <CardTitle className="text-3xl">{stats.admins}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                System administrators
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Invites</CardDescription>
              <CardTitle className="text-3xl">{stats.pendingInvites}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="h-4 w-4" />
                Awaiting acceptance
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Invitations Section */}
        <PendingInvitationsSection />

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Search and filter users, manage their roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select 
                value={roleFilter} 
                onValueChange={(value) => {
                  setRoleFilter(value as AppRole | 'all');
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="case_manager">Case Managers</SelectItem>
                  <SelectItem value="admin">Administrators</SelectItem>
                </SelectContent>
              </Select>
              {organizations && organizations.length > 0 && (
                <Select 
                  value={orgFilter} 
                  onValueChange={(value) => {
                    setOrgFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by org" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Users Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No users found matching your criteria
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Organization</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Joined</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => {
                      const RoleIcon = roleIcons[user.role];
                      return (
                        <TableRow key={user.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {user.organization_name ? (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Building2 className="h-3 w-3" />{user.organization_name}
                              </Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={`gap-1 ${roleColors[user.role]}`}>
                              <RoleIcon className="h-3 w-3" />
                              <span className="capitalize">{user.role.replace('_', ' ')}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {user.role !== 'student' && (
                                  <DropdownMenuItem 
                                    onClick={() => openRoleDialog(user.user_id, user.full_name || 'User', user.role, 'student')}
                                  >
                                    <GraduationCap className="mr-2 h-4 w-4" />
                                    Make Student
                                  </DropdownMenuItem>
                                )}
                                {user.role !== 'case_manager' && (
                                  <DropdownMenuItem 
                                    onClick={() => openRoleDialog(user.user_id, user.full_name || 'User', user.role, 'case_manager')}
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Make Case Manager
                                  </DropdownMenuItem>
                                )}
                                {user.role !== 'admin' && (
                                  <DropdownMenuItem 
                                    onClick={() => openRoleDialog(user.user_id, user.full_name || 'User', user.role, 'admin')}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Make Administrator
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(user.user_id, user.full_name || 'User', user.email, user.role)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  disabled={user.user_id === currentUser?.id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={!!selectedUser && !!newRole} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change {selectedUser?.name}'s role from{' '}
              <strong className="capitalize">{selectedUser?.currentRole.replace('_', ' ')}</strong> to{' '}
              <strong className="capitalize">{newRole?.replace('_', ' ')}</strong>?
              <br /><br />
              This will immediately affect their access permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateRole.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} disabled={updateRole.isPending}>
              {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => {
        if (!open) {
          setUserToDelete(null);
          setDeleteConfirmation('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User Permanently
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to permanently delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}).
                </p>
                
                {userToDelete?.role === 'admin' && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm">
                    <strong>⚠️ Warning:</strong> This user is an administrator. Deleting them will remove their admin access.
                  </div>
                )}
                
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium mb-2">This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Remove the user's profile and login access</li>
                    <li>Delete their appointments and messages</li>
                    <li>Remove their student/case manager assignments</li>
                    <li>Clear case manager assignments on support requests</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteConfirmation !== 'DELETE' || deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
