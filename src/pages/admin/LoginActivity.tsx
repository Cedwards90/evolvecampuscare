import { useEffect, useMemo, useState } from 'react';
import { SidebarLayout } from '@/components/layouts/SidebarLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow, format } from 'date-fns';
import { Search } from 'lucide-react';

interface LoginEvent {
  id: string;
  user_id: string;
  signed_in_at: string;
  source: string;
}

interface UserSummary {
  user_id: string;
  full_name: string | null;
  email: string | null;
  organization_id: string | null;
  organization_name?: string | null;
  role?: string | null;
  last_sign_in: string | null;
  total_logins: number;
}

export default function LoginActivity() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [summaries, setSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: eventRows } = await supabase
        .from('user_login_events')
        .select('id, user_id, signed_in_at, source')
        .order('signed_in_at', { ascending: false })
        .limit(2000);

      const events = (eventRows ?? []) as LoginEvent[];
      setEvents(events.slice(0, 100));

      // Aggregate per user
      const map = new Map<string, { last: string; count: number }>();
      for (const e of events) {
        const cur = map.get(e.user_id);
        if (!cur) map.set(e.user_id, { last: e.signed_in_at, count: 1 });
        else {
          cur.count += 1;
          if (e.signed_in_at > cur.last) cur.last = e.signed_in_at;
        }
      }

      const userIds = Array.from(map.keys());
      let profilesById = new Map<string, any>();
      let rolesById = new Map<string, string>();
      let orgsById = new Map<string, string>();

      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, organization_id')
          .in('user_id', userIds);
        profilesById = new Map((profs ?? []).map((p: any) => [p.user_id, p]));

        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        for (const r of roles ?? []) rolesById.set((r as any).user_id, (r as any).role);

        const orgIds = Array.from(
          new Set(
            (profs ?? [])
              .map((p: any) => p.organization_id)
              .filter((v: any): v is string => !!v),
          ),
        );
        if (orgIds.length) {
          const { data: orgs } = await supabase
            .from('training_organizations')
            .select('id, name')
            .in('id', orgIds);
          for (const o of orgs ?? []) orgsById.set((o as any).id, (o as any).name);
        }
      }

      const summaries: UserSummary[] = userIds.map((uid) => {
        const agg = map.get(uid)!;
        const p = profilesById.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          organization_id: p?.organization_id ?? null,
          organization_name: p?.organization_id ? orgsById.get(p.organization_id) ?? null : null,
          role: rolesById.get(uid) ?? null,
          last_sign_in: agg.last,
          total_logins: agg.count,
        };
      });

      summaries.sort((a, b) => (b.last_sign_in ?? '').localeCompare(a.last_sign_in ?? ''));
      setSummaries(summaries);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        (s.full_name ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.organization_name ?? '').toLowerCase().includes(q),
    );
  }, [summaries, search]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of summaries) m.set(s.user_id, s.full_name || s.email || s.user_id.slice(0, 8));
    return m;
  }, [summaries]);

  return (
    <SidebarLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Login Activity</h1>
          <p className="text-muted-foreground text-sm mt-1">
            See when each user last signed in. History going forward is captured automatically; the
            earliest entry per user is backfilled from existing sign-in records.
          </p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Users</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, org…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Logins recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No login activity yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium">{s.full_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                      <TableCell>
                        {s.role ? <Badge variant="secondary">{s.role}</Badge> : '—'}
                      </TableCell>
                      <TableCell>{s.organization_name || '—'}</TableCell>
                      <TableCell>
                        {s.last_sign_in ? (
                          <div className="flex flex-col">
                            <span>{formatDistanceToNow(new Date(s.last_sign_in), { addSuffix: true })}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(s.last_sign_in), 'PPp')}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">{s.total_logins}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Signed in</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No events yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {userNameById.get(e.user_id) ?? e.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatDistanceToNow(new Date(e.signed_in_at), { addSuffix: true })}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(e.signed_in_at), 'PPp')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.source === 'backfill' ? 'outline' : 'secondary'}>
                          {e.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
