import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  fetchImpactAnalytics,
  type ImpactData,
  type ImpactFilters,
} from '@/hooks/useImpactAnalytics';

export interface OrgOption {
  value: string;
  label: string;
}

export interface OrgBreakdownRow {
  orgId: string;
  orgName: string;
  data: ImpactData | null;
  isLoading: boolean;
  isError: boolean;
}

type SortKey =
  | 'org'
  | 'students'
  | 'opened'
  | 'resolved'
  | 'certs'
  | 'placementRate'
  | 'avgWageLift'
  | 'sroi';

interface Props {
  filters: ImpactFilters;
  orgOptions: OrgOption[];
}

function fmtN(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}
function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n}%`;
}
function fmtUsd(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtSroi(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n}x`;
}

export function buildBreakdownRows(
  orgOptions: OrgOption[],
  results: { data?: ImpactData; isLoading: boolean; isError: boolean }[],
): OrgBreakdownRow[] {
  return orgOptions.map((opt, i) => ({
    orgId: opt.value,
    orgName: opt.label,
    data: results[i]?.data ?? null,
    isLoading: !!results[i]?.isLoading,
    isError: !!results[i]?.isError,
  }));
}

export function OrgBreakdownTable({ filters, orgOptions }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'students',
    dir: 'desc',
  });

  // Run one query per org. RLS still scopes results.
  const results = useQueries({
    queries: orgOptions.map((opt) => {
      const f: ImpactFilters = { ...filters, organizationIds: [opt.value] };
      return {
        queryKey: ['impact-analytics-org', opt.value, f],
        queryFn: () => fetchImpactAnalytics(f),
        staleTime: 60 * 1000,
      };
    }),
  });

  const rows = useMemo(
    () => buildBreakdownRows(orgOptions, results as any),
    [orgOptions, results],
  );

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const get = (r: OrgBreakdownRow): number | string => {
        if (sort.key === 'org') return r.orgName.toLowerCase();
        if (!r.data) return -Infinity;
        switch (sort.key) {
          case 'students':
            return r.data.inputs.activeStudents;
          case 'opened':
            return r.data.activities.requestsOpened;
          case 'resolved':
            return r.data.activities.requestsResolved;
          case 'certs':
            return r.data.outputs.certificationsEarned;
          case 'placementRate':
            return r.data.outcomes.placementRate;
          case 'avgWageLift':
            return r.data.outcomes.avgWageLift;
          case 'sroi':
            return r.data.impact.sroi ?? -Infinity;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
    return arr;
  }, [rows, sort]);

  const totals = useMemo(() => {
    const datas = rows.map((r) => r.data).filter((d): d is ImpactData => !!d);
    const sum = (sel: (d: ImpactData) => number) =>
      datas.reduce((s, d) => s + sel(d), 0);
    const students = sum((d) => d.inputs.activeStudents);
    const placed = datas.reduce(
      (s, d) => s + Math.round((d.outcomes.placementRate / 100) * d.inputs.activeStudents),
      0,
    );
    const wageLiftWeighted =
      students > 0
        ? Math.round(
            (datas.reduce(
              (s, d) => s + d.outcomes.avgWageLift * d.inputs.activeStudents,
              0,
            ) /
              students) *
              100,
          ) / 100
        : 0;
    return {
      students,
      opened: sum((d) => d.activities.requestsOpened),
      resolved: sum((d) => d.activities.requestsResolved),
      certs: sum((d) => d.outputs.certificationsEarned),
      placementRate: students > 0 ? Math.round((placed / students) * 100) : 0,
      avgWageLift: wageLiftWeighted,
    };
  }, [rows]);

  const SortBtn = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() =>
          setSort((s) =>
            s.key === k
              ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
              : { key: k, dir: k === 'org' ? 'asc' : 'desc' },
          )
        }
        className={`inline-flex items-center gap-1 hover:text-primary ${active ? 'font-semibold text-foreground' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    );
  };

  if (orgOptions.length === 0) return null;

  const anyLoading = results.some((r) => r.isLoading);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Compare organizations
            </CardTitle>
            <CardDescription>
              Side-by-side impact metrics. Click any header to sort.
            </CardDescription>
          </div>
          {anyLoading && <LoadingSpinner />}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn k="org" label="Organization" /></TableHead>
                <TableHead className="text-right"><SortBtn k="students" label="Students" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="opened" label="Requests opened" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="resolved" label="Resolved" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="certs" label="Certifications" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="placementRate" label="Placement rate" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="avgWageLift" label="Avg wage lift" align="right" /></TableHead>
                <TableHead className="text-right"><SortBtn k="sroi" label="SROI" align="right" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => (
                <TableRow key={r.orgId}>
                  <TableCell className="font-medium">{r.orgName}</TableCell>
                  {r.isLoading ? (
                    <TableCell colSpan={7} className="text-right text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  ) : r.isError || !r.data ? (
                    <TableCell colSpan={7} className="text-right text-xs text-destructive">
                      Failed to load
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="text-right tabular-nums">{fmtN(r.data.inputs.activeStudents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtN(r.data.activities.requestsOpened)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtN(r.data.activities.requestsResolved)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtN(r.data.outputs.certificationsEarned)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(r.data.outcomes.placementRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtUsd(r.data.outcomes.avgWageLift)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtSroi(r.data.impact.sroi)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Totals</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(totals.students)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(totals.opened)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(totals.resolved)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(totals.certs)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPct(totals.placementRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtUsd(totals.avgWageLift)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="px-6 pt-3 text-xs text-muted-foreground">
          Placement rate and avg wage lift in Totals are weighted by active students. SROI varies by inputs and is shown per org only.
        </p>
      </CardContent>
    </Card>
  );
}
