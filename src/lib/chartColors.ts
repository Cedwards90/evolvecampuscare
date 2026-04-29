/**
 * Shared recharts color palette using semantic design tokens.
 * Use for Pie/Bar/Line charts so colors stay consistent across dashboards.
 */
export const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--success))",
  "hsl(var(--muted))",
] as const;
