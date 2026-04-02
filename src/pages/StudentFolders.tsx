import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Search, CheckCircle, Clock, FileText, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStudentFolders } from '@/hooks/useStudentFolders';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function StudentFolders() {
  const { data: students, isLoading } = useStudentFolders();
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('all');

  // Get unique orgs for filter
  const orgOptions = [...new Map((students || []).filter(s => s.organization_name).map(s => [s.organization_id, s.organization_name])).entries()];

  const filtered = (students || []).filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = (s.full_name || '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchesOrg = orgFilter === 'all' || s.organization_id === orgFilter;
    return matchesSearch && matchesOrg;
  });

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Student Folders"
          description="Browse student files, intake responses, and request history."
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {orgOptions.length > 0 && (
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-48">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by org" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {orgOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="secondary" className="whitespace-nowrap">
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No student folders found"
            description={search ? 'Try adjusting your search.' : 'No students are assigned yet.'}
          />
        ) : (
          <Card className="border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Intake</TableHead>
                  <TableHead className="text-center">Requests</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.user_id} className="cursor-pointer">
                    <TableCell>
                      <Link to={`/students/${student.user_id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(student.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{student.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{student.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {student.intake_completed ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {student.total_requests}
                    </TableCell>
                    <TableCell className="text-center">
                      {student.pending_requests > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {student.pending_requests}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.last_activity
                        ? formatDistanceToNow(new Date(student.last_activity), { addSuffix: true })
                        : 'No activity'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
