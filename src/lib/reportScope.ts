import type { InteractionReport } from '@/hooks/useInteractionReport';
import type { SupportRequest } from '@/types/database';

export interface ReportScopeFilters {
  organizationId: string[];
  cohort: string[];
  yearOfStudy: string[];
  assignedCaseManagerId: string[];
  status?: string[];
}

export function hasActiveScope(f: ReportScopeFilters): boolean {
  return (
    f.organizationId.length > 0 ||
    f.cohort.length > 0 ||
    f.yearOfStudy.length > 0 ||
    f.assignedCaseManagerId.length > 0 ||
    (f.status?.length ?? 0) > 0
  );
}

function matchesRequest(r: SupportRequest, f: ReportScopeFilters): boolean {
  const s = r.student as (SupportRequest['student'] & { cohort_id?: string | null; year_of_study?: string | number | null }) | undefined;
  if (f.organizationId.length && (!s?.organization_id || !f.organizationId.includes(s.organization_id))) return false;
  if (f.cohort.length && (!s?.cohort_id || !f.cohort.includes(s.cohort_id))) return false;
  if (f.yearOfStudy.length && (!s?.year_of_study || !f.yearOfStudy.includes(String(s.year_of_study)))) return false;
  if (
    f.assignedCaseManagerId.length &&
    (!r.assigned_case_manager_id || !f.assignedCaseManagerId.includes(r.assigned_case_manager_id))
  ) {
    return false;
  }
  if (f.status?.length && !f.status.includes(r.status)) return false;
  return true;
}

function countBy<T extends string>(rows: SupportRequest[], key: (r: SupportRequest) => T): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    const k = key(r);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Applies the active filter scope to every part of the report that is derived
 * from request rows, so the preview, the metric tiles, the AI payload and the
 * downloads can never disagree. Values that cannot be scoped by request
 * (life skills, impact metrics, messages) are left untouched.
 */
export function applyReportScope(
  data: InteractionReport | undefined,
  filters: ReportScopeFilters,
): InteractionReport | undefined {
  if (!data) return data;
  if (!hasActiveScope(filters)) return data;

  const rows = data.requests.rows.filter((r) => matchesRequest(r, filters));
  const unresolved = data.unresolved.filter((r) => matchesRequest(r, filters));
  const resolvedRows = rows.filter((r) => r.status === 'resolved');

  const resolutionHours = resolvedRows
    .filter((r) => r.resolved_at)
    .map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 36e5)
    .filter((h) => Number.isFinite(h) && h >= 0);

  const financialRows = rows.filter((r) => (r.requested_amount ?? 0) > 0 || (r.approved_amount ?? 0) > 0);
  const sum = (list: SupportRequest[], pick: (r: SupportRequest) => number | null | undefined) =>
    list.reduce((t, r) => t + (pick(r) || 0), 0);
  const approvalStatus = (r: SupportRequest) => String(r.approval_status || 'pending');

  const keptRequestIds = new Set(rows.map((r) => r.id));

  return {
    ...data,
    summary: {
      ...data.summary,
      requestsOpened: rows.length,
      requestsResolved: resolvedRows.length,
      avgResolutionHours: resolutionHours.length
        ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
        : 0,
      unresolvedCount: unresolved.length,
      emergencyCount: rows.filter((r) => r.is_emergency || r.priority === 'emergency').length,
    },
    requests: {
      ...data.requests,
      opened: rows.length,
      inProgress: rows.filter((r) => r.status === 'in_progress').length,
      resolved: resolvedRows.length,
      escalated: rows.filter((r) => r.status === 'escalated').length,
      byCategory: countBy(rows, (r) => r.category),
      byPriority: countBy(rows, (r) => r.priority),
      rows,
    },
    financials: {
      count: financialRows.length,
      requested: sum(financialRows, (r) => r.requested_amount),
      approved: sum(financialRows, (r) => r.approved_amount),
      pending: sum(
        financialRows.filter((r) => approvalStatus(r) === 'pending'),
        (r) => r.requested_amount,
      ),
      approvedCount: financialRows.filter((r) => approvalStatus(r) === 'approved').length,
      partiallyApprovedCount: financialRows.filter((r) => approvalStatus(r) === 'partially_approved').length,
      deniedCount: financialRows.filter((r) => approvalStatus(r) === 'denied').length,
      pendingCount: financialRows.filter((r) => approvalStatus(r) === 'pending').length,
    },
    statusChanges: data.statusChanges.filter((u) => keptRequestIds.has(u.request_id)),
    unresolved,
  };
}

/** Human-readable description of the scope, shown above the report and inside exports. */
export function describeReportScope(opts: {
  from: Date;
  to: Date;
  filters: ReportScopeFilters;
  labelFor: (key: keyof ReportScopeFilters, value: string) => string;
}): string[] {
  const { from, to, filters, labelFor } = opts;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const lines = [`Date range: ${fmt(from)} – ${fmt(to)}`];
  const add = (key: keyof ReportScopeFilters, label: string) => {
    const values = filters[key] || [];
    if (values.length) lines.push(`${label}: ${values.map((v) => labelFor(key, v)).join(', ')}`);
  };
  add('organizationId', 'Organization');
  add('cohort', 'Class');
  add('assignedCaseManagerId', 'Case manager');
  add('yearOfStudy', 'Year');
  add('status', 'Request status');
  if (lines.length === 1) lines.push('Filters: none (all visible records)');
  return lines;
}
