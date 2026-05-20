import type { ImpactMetrics } from "@/hooks/useImpactMetrics";

function esc(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportImpactCsv(metrics: ImpactMetrics) {
  const lines: string[] = [];
  lines.push("Section,Metric,Value");
  const pg = metrics.participant_growth;
  const rows: Array<[string, string, any]> = [
    ["Participant Growth", "Total participants", pg.total_participants],
    ["Participant Growth", "Certifications earned", pg.certifications_earned],
    ["Participant Growth", "Certifications in range", pg.certifications_in_range],
    ["Participant Growth", "Job placements", pg.job_placements],
    ["Participant Growth", "Placements in range", pg.placements_in_range],
    ["Participant Growth", "Avg baseline wage", pg.avg_baseline_wage],
    ["Participant Growth", "Avg current wage", pg.avg_current_wage],
    ["Participant Growth", "Wage growth %", pg.wage_growth_pct],
    ["Participant Growth", "Retention 30d", pg.retention.d30],
    ["Participant Growth", "Retention 60d", pg.retention.d60],
    ["Participant Growth", "Retention 90d", pg.retention.d90],
    ["Participant Growth", "Retention 180d", pg.retention.d180],
    ["Participant Growth", "Retention 365d", pg.retention.d365],
    ["Participant Growth", "Program completions", pg.program_completed],
    ["Participant Growth", "Completion rate %", pg.completion_rate_pct],
    ["Participant Growth", "Attendance rate %", pg.attendance_rate_pct],
    ["Participant Growth", "Check-ins / participant (avg)", pg.avg_check_ins_per_participant],
    ["Participant Growth", "Support requests total", pg.support_requests_total],
    ["Participant Growth", "Support requests resolved", pg.support_requests_resolved],
    ["Participant Growth", "Avg resolution hours", pg.avg_resolution_hours],
  ];
  for (const [sec, m, v] of rows) lines.push([esc(sec), esc(m), esc(v)].join(","));

  for (const [slug, s] of Object.entries(metrics.social_impact.surveys)) {
    lines.push(
      ["Social Impact", esc(`${s.title} (${slug}) responses`), esc(s.response_count)].join(","),
    );
    lines.push(
      [
        "Social Impact",
        esc(`${s.title} avg score`),
        esc(s.suppressed ? "suppressed (n<5)" : s.avg_score),
      ].join(","),
    );
  }

  if (metrics.funding_goals.length > 0) {
    lines.push("");
    lines.push("Funding Goal,Metric,Target,Current,Progress %");
    for (const g of metrics.funding_goals) {
      lines.push(
        [esc(g.title), esc(g.metric_key), esc(g.target_value), esc(g.current_value), esc(Math.round(g.progress_pct))].join(","),
      );
    }
  }

  if (metrics.trends.length > 0) {
    lines.push("");
    lines.push("Month,Placements,Certifications,Requests Resolved");
    for (const t of metrics.trends) {
      lines.push([t.month, t.placements, t.certifications, t.requests_resolved].join(","));
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evolve-impact_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
