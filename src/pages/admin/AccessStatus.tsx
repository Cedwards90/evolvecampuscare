import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldOff, Search, Loader2, ArrowRight } from 'lucide-react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useUsers } from '@/hooks/useUsers';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'active' | 'suspended';

export default function AccessStatus() {
  const { data: orgs, isLoading } = useTrainingOrganizations();
  const { data: users } = useUsers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const memberCount = (orgId: string) =>
    (users || []).filter(u => u.organization_id === orgId).length;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orgs || [])
      .filter(o => {
        const isSuspended = !!o.suspended_at;
        if (statusFilter === 'active' && isSuspended) return false;
        if (statusFilter === 'suspended' && !isSuspended) return false;
        if (term && !o.name.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        // suspended first when viewing all
        if (statusFilter === 'all') {
          if (!!a.suspended_at !== !!b.suspended_at) return a.suspended_at ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [orgs, search, statusFilter]);

  const totals = useMemo(() => {
    const all = orgs || [];
    return {
      total: all.length,
      active: all.filter(o => !o.suspended_at).length,
      suspended: all.filter(o => !!o.suspended_at).length,
    };
  }, [orgs]);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <PageHeader
          title="Organization Access Status"
          description="Platform-wide view of which organizations have access and which are suspended."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total organizations" value={totals.total} />
          <StatCard label="Active" value={totals.active} tone="success" />
          <StatCard label="Suspended" value={totals.suspended} tone="destructive" />
        </div>

        <Card className="rounded-3xl">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 rounded-full"
                  placeholder="Search organizations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'active', 'suspended'] as StatusFilter[]).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={statusFilter === f ? 'default' : 'outline'}
                    className="rounded-full capitalize"
                    onClick={() => setStatusFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                No organizations match the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Members</TableHead>
                      <TableHead className="hidden md:table-cell">Suspended on</TableHead>
                      <TableHead className="hidden lg:table-cell">Reason</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((o) => {
                      const suspended = !!o.suspended_at;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">
                            <Link to={`/admin/organizations/${o.id}`} className="hover:underline text-primary">
                              {o.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {suspended ? (
                              <Badge variant="destructive" className="rounded-full gap-1">
                                <ShieldOff className="h-3 w-3" /> Suspended
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="rounded-full gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <ShieldCheck className="h-3 w-3" /> Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {memberCount(o.id)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {o.suspended_at ? format(new Date(o.suspended_at), 'PP') : '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-xs truncate">
                            {o.suspension_reason || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost" className="rounded-full">
                              <Link to={`/admin/organizations/${o.id}`}>
                                Manage <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
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
      </div>
    </SidebarLayout>
  );
}

function StatCard({
  label, value, tone,
}: { label: string; value: number; tone?: 'success' | 'destructive' }) {
  const toneClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-foreground';
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-3xl font-semibold mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
