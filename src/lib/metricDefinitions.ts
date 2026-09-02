/**
 * KPI definitions.
 *
 * Every number shown to a user must be explainable. Each metric declares its
 * numerator, denominator, population, time window, and exclusions, so the
 * figure on screen, in an export, and in an AI summary all mean the same thing.
 *
 * A metric with `derivable: false` is never rendered as a number — the UI shows
 * "Not enough data" instead of implying precision we don't have.
 */

export interface MetricDefinition {
  key: string;
  label: string;
  /** One-line plain-English meaning. */
  summary: string;
  numerator: string;
  denominator: string;
  /** Which records are counted at all. */
  population: string;
  timeWindow: string;
  exclusions: string[];
  unit: 'count' | 'percent' | 'hours' | 'currency';
  /**
   * False when the underlying data cannot support an honest figure. Such
   * metrics render as "Not enough data" rather than a misleading value.
   */
  derivable: boolean;
  /** Why it isn't derivable, shown to admins. */
  notDerivableReason?: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  total_students: {
    key: 'total_students',
    label: 'Students in scope',
    summary: 'Distinct students visible to you after the active filters are applied.',
    numerator: 'Distinct student_id values across case manager assignments',
    denominator: 'n/a — this is a count, not a ratio',
    population: 'Students with at least one case manager assignment',
    timeWindow: 'Current state (assignments are not time-bounded)',
    exclusions: [
      'Students in suspended organizations',
      'Students outside your role or organization scope',
      'Students with no case manager assignment',
    ],
    unit: 'count',
    derivable: true,
  },

  total_requests: {
    key: 'total_requests',
    label: 'Requests created',
    summary: 'Support requests created inside the selected date range.',
    numerator: 'Support requests with created_at inside the range',
    denominator: 'n/a — this is a count, not a ratio',
    population: 'All support requests you are permitted to see',
    timeWindow: 'Selected date range, by created_at',
    exclusions: ['Requests created outside the range', 'Requests outside your access scope'],
    unit: 'count',
    derivable: true,
  },

  avg_resolution_hours: {
    key: 'avg_resolution_hours',
    label: 'Average time to resolve',
    summary: 'Mean hours from creation to resolution, counting only requests that were resolved.',
    numerator: 'Sum of (resolved_at − created_at) in hours',
    denominator: 'Number of requests with a resolved_at timestamp',
    population: 'Requests created in the range that have since been resolved',
    timeWindow: 'Selected date range, by created_at',
    exclusions: [
      'Requests still open (they have no resolution time yet)',
      'Cancelled requests',
      'Requests resolved without a recorded resolved_at',
    ],
    unit: 'hours',
    derivable: true,
  },

  resolution_rate: {
    key: 'resolution_rate',
    label: 'Resolution rate',
    summary:
      'Share of requests created in the range that have been resolved as of now. Recent requests drag this down because they have had less time to close.',
    numerator: 'Requests created in the range with a resolved_at timestamp',
    denominator: 'All requests created in the range, excluding cancelled',
    population: 'Requests created in the selected range',
    timeWindow: 'Created in range; resolution measured as of the generated timestamp',
    exclusions: [
      'Cancelled requests (removed from both numerator and denominator)',
      'Requests created outside the range',
    ],
    unit: 'percent',
    derivable: true,
  },

  open_requests: {
    key: 'open_requests',
    label: 'Open requests',
    summary: 'Requests that still need work right now.',
    numerator: 'Requests with status submitted, in_progress, or escalated',
    denominator: 'n/a — this is a count, not a ratio',
    population: 'All requests you are permitted to see, regardless of creation date',
    timeWindow: 'Current state — not limited by the date range',
    exclusions: ['Resolved requests', 'Cancelled requests'],
    unit: 'count',
    derivable: true,
  },

  financial_dispersed: {
    key: 'financial_dispersed',
    label: 'Funds dispersed',
    summary: 'Total approved amount on financial requests, which is what was actually committed.',
    numerator: 'Sum of approved_amount where approval_status = approved',
    denominator: 'n/a — this is a total, not a ratio',
    population: 'Financial-category requests created in the range',
    timeWindow: 'Selected date range, by created_at',
    exclusions: [
      'Requested-but-not-approved amounts',
      'Pending or denied approvals',
      'Non-financial requests',
    ],
    unit: 'currency',
    derivable: true,
  },

  cm_active_students: {
    key: 'cm_active_students',
    label: 'Active students per case manager',
    summary: 'Distinct students currently assigned to this case manager.',
    numerator: 'Distinct student_id in student_assignments for this case manager',
    denominator: 'n/a — this is a count, not a ratio',
    population: 'Active assignments in scope',
    timeWindow: 'Current state',
    exclusions: ['Students in suspended organizations', 'Deactivated students'],
    unit: 'count',
    derivable: true,
  },

  cm_avg_resolution_hours: {
    key: 'cm_avg_resolution_hours',
    label: 'Case manager average resolution time',
    summary: 'Mean hours to resolve, across this case manager’s requests resolved in the range.',
    numerator: 'Sum of (resolved_at − created_at) for their resolved requests',
    denominator: 'Count of their requests resolved in the range',
    population: 'Requests assigned to this case manager',
    timeWindow: 'Resolved inside the selected range',
    exclusions: [
      'Requests reassigned mid-flight are credited to the current assignee only',
      'Open requests',
      'Cancelled requests',
    ],
    unit: 'hours',
    derivable: true,
  },

  student_growth: {
    key: 'student_growth',
    label: 'Student assignment growth',
    summary:
      'Cumulative count of case manager assignments created up to each day in the range.',
    numerator: 'Assignments with created_at on or before the day',
    denominator: 'n/a — this is a running count',
    population: 'Assignments in scope',
    timeWindow: 'Cumulative through each day of the range',
    exclusions: [
      'Assignments that have since been removed are not subtracted, because removals are not timestamped',
    ],
    unit: 'count',
    derivable: false,
    notDerivableReason:
      'student_assignments has no end date, so a historical daily count cannot distinguish an assignment that ended from one that continues. Only the current total is trustworthy.',
  },
};

export function getMetricDefinition(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS[key];
}

/** Human-readable "84% of requests created Jan 1–31, resolved as of Feb 15". */
export function describeMetric(def: MetricDefinition, rangeLabel: string, asOf: string): string {
  const base = `${def.label}: ${def.summary}`;
  return `${base} Window: ${rangeLabel}. Measured as of ${asOf}.`;
}
