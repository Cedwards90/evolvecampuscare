import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfDay, eachDayOfInterval, differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export interface ImpactFilters {
  /** ISO date string – inclusive lower bound */
  from: string;
  /** ISO date string – inclusive upper bound */
  to: string;
  /** Empty = all orgs the caller can see */
  organizationIds: string[];
  /** Empty = all cohorts */
  cohorts: string[];
}

const FUNNEL_STAGES = [
  'qr_scan',
  'signup_started',
  'signup_completed',
  'nda_accepted',
  'profile_completed',
  'intake_completed',
  'first_request_submitted',
  'first_meeting_scheduled',
  'placement_recorded',
] as const;

export type FunnelStage = typeof FUNNEL_STAGES[number];

export interface CoverageRow {
  key: string;
  label: string;
  entered: number;
  total: number;
  pct: number;
  hint?: string;
}

export interface ImpactData {
  scope: {
    studentIds: string[];
    organizationIds: string[] | 'all';
  };
  inputs: {
    totalProgramCost: number;
    costPerParticipant: number;
    activeStaff: number;
    activeStudents: number;
  };
  costSettings: any[];
  activities: {
    funnel: { stage: FunnelStage; label: string; count: number; pctOfFirst: number }[];
    requestsOpened: number;
    requestsResolved: number;
    meetings: number;
    checkIns: number;
    timeline: { date: string; requests: number; resolved: number; meetings: number }[];
  };
  outputs: {
    certificationsEarned: number;
    certsByCategory: { name: string; count: number }[];
    postGradPlans: number;
    recordsTransferred: number;
  };
  outcomes: {
    placed: number;
    placementRate: number;
    avgWageLift: number;
    avgTimeToPlacementDays: number | null;
    completed: number;
    completionRate: number;
    retention: { milestone: '30' | '60' | '90' | '180' | '365'; met: number; eligible: number; pct: number }[];
  };
  impact: {
    sroi: number | null;
    annualWageLift: number;
    publicBenefitOffset: number;
    totalReturn: number;
    equity: {
      dimension: string;
      groups: { label: string; placementRate: number; n: number }[];
    }[];
  };
  coverage: CoverageRow[];
}

const HOURS_PER_YEAR = 2080;

/**
 * Standalone fetcher so non-hook callers (e.g. useQueries) can reuse the
 * exact same computation. RLS scopes everything based on the current session.
 */
export async function fetchImpactAnalytics(filters: ImpactFilters): Promise<ImpactData> {
  {
    {
      const fromIso = new Date(filters.from).toISOString();
      const toIso = new Date(filters.to).toISOString();
      const orgScope = filters.organizationIds.length > 0 ? filters.organizationIds : null;

      // 1. Build the eligible student set (RLS already scopes profiles).
      let profilesQ = supabase
        .from('profiles')
        .select('user_id, organization_id, cohort_start_date');
      if (orgScope) profilesQ = profilesQ.in('organization_id', orgScope);
      const { data: profileRows, error: pErr } = await profilesQ;
      if (pErr) throw pErr;

      // Determine which profile rows actually have the student role.
      const profileUserIds = (profileRows || []).map((p: any) => p.user_id);
      let studentIds: string[] = [];
      if (profileUserIds.length) {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', profileUserIds)
          .eq('role', 'student');
        const studentSet = new Set((roleRows || []).map((r: any) => r.user_id));
        studentIds = (profileRows || [])
          .filter((p: any) => studentSet.has(p.user_id))
          .filter((p: any) => {
            if (!filters.cohorts.length) return true;
            const y = p.cohort_start_date
              ? String(new Date(p.cohort_start_date).getUTCFullYear())
              : null;
            return y && filters.cohorts.includes(y);
          })
          .map((p: any) => p.user_id);
      }

      // 2. Program cost settings overlapping the period.
      let costQ = supabase
        .from('program_cost_settings')
        .select('*')
        .lte('period_start', filters.to)
        .gte('period_end', filters.from);
      if (orgScope) {
        costQ = costQ.in('organization_id', orgScope);
      }
      const { data: costs } = await costQ;
      const totalProgramCost = (costs || []).reduce(
        (sum: number, c: any) => sum + Number(c.annual_program_cost || 0),
        0,
      );
      const publicBenefitOffset = (costs || []).reduce(
        (sum: number, c: any) =>
          sum + Number(c.avg_public_benefit_offset || 0) * studentIds.length,
        0,
      );

      // 3. Active staff (case managers + org admins) within scope.
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['case_manager', 'org_admin']);
      const activeStaff = (staffRoles || []).length;

      // 4. Funnel events.
      let funnelQ = supabase
        .from('participant_funnel_events')
        .select('event_type, user_id, organization_id, created_at')
        .gte('created_at', fromIso)
        .lte('created_at', toIso);
      if (orgScope) funnelQ = funnelQ.in('organization_id', orgScope);
      const { data: funnelRows } = await funnelQ;
      const funnelCounts: Record<string, Set<string>> = {};
      FUNNEL_STAGES.forEach((s) => (funnelCounts[s] = new Set()));
      (funnelRows || []).forEach((e: any) => {
        if (FUNNEL_STAGES.includes(e.event_type)) {
          funnelCounts[e.event_type].add(e.user_id || `anon-${e.created_at}`);
        }
      });
      const firstStageCount = funnelCounts[FUNNEL_STAGES[0]].size;
      const funnel = FUNNEL_STAGES.map((stage) => ({
        stage,
        label: stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count: funnelCounts[stage].size,
        pctOfFirst:
          firstStageCount > 0
            ? Math.round((funnelCounts[stage].size / firstStageCount) * 100)
            : 0,
      }));

      // 5. Activities: requests, appointments, check-ins (scoped to student set).
      const inStudents = (q: any) =>
        studentIds.length ? q.in('student_id', studentIds) : q;

      const [reqRes, apptRes, checkinRes] = await Promise.all([
        inStudents(
          supabase
            .from('support_requests')
            .select('id, created_at, resolved_at, status, student_id')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
        ),
        inStudents(
          supabase
            .from('appointments')
            .select('id, scheduled_at, status, student_id')
            .gte('scheduled_at', fromIso)
            .lte('scheduled_at', toIso),
        ),
        inStudents(
          supabase
            .from('student_checkins')
            .select('id, created_at, student_id')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
        ),
      ]);
      const requests = (reqRes.data || []) as any[];
      const appointments = (apptRes.data || []) as any[];
      const checkins = (checkinRes.data || []) as any[];

      const requestsOpened = requests.length;
      const requestsResolved = requests.filter((r) => !!r.resolved_at).length;

      // Daily timeline
      const fromD = new Date(filters.from);
      const toD = new Date(filters.to);
      const days = differenceInDays(toD, fromD) > 120
        ? []
        : eachDayOfInterval({ start: fromD, end: toD });
      const timeline = days.map((d) => {
        const ds = startOfDay(d).getTime();
        const dayKey = format(d, 'MMM dd');
        const inDay = (iso: string | null) => {
          if (!iso) return false;
          const t = startOfDay(new Date(iso)).getTime();
          return t === ds;
        };
        return {
          date: dayKey,
          requests: requests.filter((r) => inDay(r.created_at)).length,
          resolved: requests.filter((r) => inDay(r.resolved_at)).length,
          meetings: appointments.filter((a) => inDay(a.scheduled_at)).length,
        };
      });

      // 6. Outputs: certifications, plans.
      const [certRes, planRes] = await Promise.all([
        inStudents(
          supabase
            .from('student_certifications')
            .select('id, status, catalog_id, student_id, earned_date, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso),
        ),
        inStudents(
          supabase
            .from('post_graduation_plans')
            .select('id, student_id, updated_at')
            .gte('updated_at', fromIso)
            .lte('updated_at', toIso),
        ),
      ]);
      const certifications = (certRes.data || []) as any[];
      const earned = certifications.filter(
        (c) => c.status === 'earned' || c.status === 'completed',
      );
      const certCategoryMap = new Map<string, number>();
      // Resolve catalog category names if catalog ids present
      const catIds = Array.from(
        new Set(earned.map((c) => c.catalog_id).filter(Boolean)),
      );
      let catalogMap = new Map<string, string>();
      if (catIds.length) {
        const { data: cats } = await supabase
          .from('certification_catalog')
          .select('id, category, name')
          .in('id', catIds);
        (cats || []).forEach((c: any) =>
          catalogMap.set(c.id, c.category || c.name || 'Other'),
        );
      }
      earned.forEach((c) => {
        const key = catalogMap.get(c.catalog_id) || 'Other';
        certCategoryMap.set(key, (certCategoryMap.get(key) || 0) + 1);
      });

      // 7. Outcomes
      let outcomes: any[] = [];
      if (studentIds.length) {
        const { data: oc } = await supabase
          .from('participant_outcomes')
          .select('*')
          .in('student_id', studentIds);
        outcomes = oc || [];
      }
      const placedRows = outcomes.filter((o) => !!o.placement_date);
      const placed = placedRows.length;
      const placementRate =
        studentIds.length > 0 ? Math.round((placed / studentIds.length) * 100) : 0;
      const wageLifts = placedRows
        .map((o) => {
          const w = Number(o.hourly_wage || 0);
          const b = Number(o.baseline_wage || 0);
          return w && b ? w - b : null;
        })
        .filter((v): v is number => v !== null);
      const avgWageLift = wageLifts.length
        ? wageLifts.reduce((a, b) => a + b, 0) / wageLifts.length
        : 0;
      const completed = outcomes.filter((o) => o.program_completed).length;
      const completionRate =
        studentIds.length > 0 ? Math.round((completed / studentIds.length) * 100) : 0;

      // Avg time-to-placement: needs intake date proxy. Use earliest funnel signup_completed per user.
      const signupTimes = new Map<string, number>();
      (funnelRows || []).forEach((e: any) => {
        if (e.event_type === 'signup_completed' && e.user_id) {
          const t = new Date(e.created_at).getTime();
          const cur = signupTimes.get(e.user_id);
          if (!cur || t < cur) signupTimes.set(e.user_id, t);
        }
      });
      const placementDeltas = placedRows
        .map((o) => {
          const start = signupTimes.get(o.student_id);
          if (!start || !o.placement_date) return null;
          return (new Date(o.placement_date).getTime() - start) / (1000 * 60 * 60 * 24);
        })
        .filter((v): v is number => v !== null && v >= 0);
      const avgTimeToPlacementDays = placementDeltas.length
        ? Math.round(placementDeltas.reduce((a, b) => a + b, 0) / placementDeltas.length)
        : null;

      const milestones: ('30' | '60' | '90' | '180' | '365')[] = ['30', '60', '90', '180', '365'];
      const retention = milestones.map((m) => {
        const met = placedRows.filter((o) => o[`retention_${m}_met`]).length;
        const eligible = placedRows.filter((o) => {
          if (!o.placement_date) return false;
          const days = differenceInDays(new Date(), new Date(o.placement_date));
          return days >= Number(m);
        }).length;
        return {
          milestone: m,
          met,
          eligible,
          pct: eligible > 0 ? Math.round((met / eligible) * 100) : 0,
        };
      });

      // 8. Impact / SROI
      const annualWageLift = placedRows.reduce((sum, o) => {
        const w = Number(o.hourly_wage || 0);
        const b = Number(o.baseline_wage || 0);
        const hours = Number(o.weekly_hours || 40) * 52;
        const lift = w && b ? (w - b) * Math.min(hours, HOURS_PER_YEAR) : 0;
        return sum + Math.max(0, lift);
      }, 0);
      const totalReturn = annualWageLift + publicBenefitOffset;
      const sroi = totalProgramCost > 0 ? totalReturn / totalProgramCost : null;

      // 9. Equity panel: load demographics for the placed/all students.
      let demos: any[] = [];
      if (studentIds.length) {
        const { data: d } = await supabase
          .from('participant_demographics')
          .select('student_id, gender, age_range, veteran_status, justice_involved, disability_status')
          .in('student_id', studentIds);
        demos = d || [];
      }
      const placedSet = new Set(placedRows.map((o) => o.student_id));

      const equityDim = (
        label: string,
        groupBy: (d: any) => string | null,
      ) => {
        const groups = new Map<string, { placed: number; total: number }>();
        demos.forEach((d) => {
          const g = groupBy(d);
          if (!g) return;
          const cur = groups.get(g) || { placed: 0, total: 0 };
          cur.total += 1;
          if (placedSet.has(d.student_id)) cur.placed += 1;
          groups.set(g, cur);
        });
        return {
          dimension: label,
          groups: Array.from(groups.entries())
            .map(([k, v]) => ({
              label: k,
              placementRate: v.total ? Math.round((v.placed / v.total) * 100) : 0,
              n: v.total,
            }))
            .sort((a, b) => b.n - a.n),
        };
      };

      const equity = [
        equityDim('Gender', (d) => d.gender || null),
        equityDim('Age Range', (d) => d.age_range || null),
        equityDim('Veteran', (d) =>
          d.veteran_status === true ? 'Veteran' : d.veteran_status === false ? 'Non-veteran' : null,
        ),
        equityDim('Justice-Involved', (d) =>
          d.justice_involved === true
            ? 'Justice-involved'
            : d.justice_involved === false
              ? 'Not justice-involved'
              : null,
        ),
      ].filter((e) => e.groups.length > 0);

      // 10. Coverage — how much of the data needed to compute impact is on file?
      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
      let intakeCount = 0, demoCount = 0, planAllCount = 0;
      if (studentIds.length) {
        const [intakeQ, demoQ, planAllQ] = await Promise.all([
          supabase.from('intake_responses').select('student_id').in('student_id', studentIds),
          supabase.from('participant_demographics').select('student_id').in('student_id', studentIds),
          supabase.from('post_graduation_plans').select('student_id').in('student_id', studentIds),
        ]);
        intakeCount = new Set((intakeQ.data || []).map((r: any) => r.student_id)).size;
        demoCount = new Set((demoQ.data || []).map((r: any) => r.student_id)).size;
        planAllCount = new Set((planAllQ.data || []).map((r: any) => r.student_id)).size;
      }
      const outcomesCount = new Set(outcomes.map((o: any) => o.student_id)).size;
      const withPlacementDate = placedRows.length;
      const withBaselineWage = placedRows.filter((o: any) => Number(o.baseline_wage || 0) > 0).length;
      const total = studentIds.length;
      const coverage: CoverageRow[] = [
        { key: 'intake', label: 'Intake completed', entered: intakeCount, total, pct: pct(intakeCount, total) },
        { key: 'demographics', label: 'Demographics on file', entered: demoCount, total, pct: pct(demoCount, total) },
        { key: 'plans', label: 'Post-graduation plan', entered: planAllCount, total, pct: pct(planAllCount, total) },
        { key: 'outcomes', label: 'Outcomes record started', entered: outcomesCount, total, pct: pct(outcomesCount, total) },
        { key: 'placement', label: 'Placement date recorded', entered: withPlacementDate, total: outcomesCount, pct: pct(withPlacementDate, outcomesCount), hint: 'of students with outcomes started' },
        { key: 'baseline_wage', label: 'Baseline wage entered', entered: withBaselineWage, total: withPlacementDate, pct: pct(withBaselineWage, withPlacementDate), hint: 'of placed students — needed for SROI' },
        { key: 'cost_periods', label: 'Cost periods covering range', entered: (costs || []).length, total: (costs || []).length, pct: (costs || []).length > 0 ? 100 : 0, hint: 'needed for SROI' },
        { key: 'certs', label: 'Certifications earned (in range)', entered: earned.length, total: earned.length, pct: earned.length > 0 ? 100 : 0 },
        { key: 'funnel', label: 'Funnel events (in range)', entered: (funnelRows || []).length, total: (funnelRows || []).length, pct: (funnelRows || []).length > 0 ? 100 : 0 },
      ];

      return {
        scope: {
          studentIds,
          organizationIds: orgScope ?? 'all',
        },
        inputs: {
          totalProgramCost,
          costPerParticipant:
            studentIds.length > 0 ? Math.round(totalProgramCost / studentIds.length) : 0,
          activeStaff,
          activeStudents: studentIds.length,
        },
        costSettings: costs || [],
        activities: {
          funnel,
          requestsOpened,
          requestsResolved,
          meetings: appointments.length,
          checkIns: checkins.length,
          timeline,
        },
        outputs: {
          certificationsEarned: earned.length,
          certsByCategory: Array.from(certCategoryMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
          postGradPlans: (planRes.data || []).length,
          recordsTransferred: (exportRes.data || []).length,
        },
        outcomes: {
          placed,
          placementRate,
          avgWageLift: Math.round(avgWageLift * 100) / 100,
          avgTimeToPlacementDays,
          completed,
          completionRate,
          retention,
        },
        impact: {
          sroi: sroi !== null ? Math.round(sroi * 100) / 100 : null,
          annualWageLift: Math.round(annualWageLift),
          publicBenefitOffset: Math.round(publicBenefitOffset),
          totalReturn: Math.round(totalReturn),
          equity,
        },
        coverage,
      };
    };
  }
}

/**
 * Composed query for the unified impact dashboard. All data respects
 * existing RLS — Org Admins only see their orgs, Admins see everything.
 */
export function useImpactAnalytics(filters: ImpactFilters) {
  const { user, role } = useAuth();

  return useQuery<ImpactData>({
    queryKey: ['impact-analytics', filters, role, user?.id],
    enabled: !!user && (role === 'admin' || role === 'org_admin'),
    staleTime: 60 * 1000,
    queryFn: () => fetchImpactAnalytics(filters),
  });
}

export function defaultImpactRange(days = 90): ImpactFilters {
  return {
    from: format(subDays(new Date(), days), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
    organizationIds: [],
    cohorts: [],
  };
}
