import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ImpactMetrics } from "@/hooks/useImpactMetrics";

interface Args {
  metrics: ImpactMetrics;
  templateTitle?: string;
  sections?: string[];
  scopeLabel?: string;
}

const FOREST: [number, number, number] = [5, 77, 59];

export function downloadDonorReportPdf({
  metrics,
  templateTitle = "Impact Report",
  sections = ["cover", "executive", "kpi", "funding", "social", "demographics", "trends", "methodology"],
  scopeLabel = "All participants",
}: Args) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const ts = new Date(metrics.generated_at).toLocaleString();

  // Cover
  if (sections.includes("cover")) {
    doc.setFillColor(...FOREST);
    doc.rect(0, 0, pageW, 200, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Evolve Foundation", margin, 100);
    doc.setFontSize(18);
    doc.text(templateTitle, margin, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(scopeLabel, margin, 160);
    doc.text(`Generated: ${ts}`, margin, 178);
    doc.setTextColor(20);
    doc.addPage();
  }

  let y = margin;
  const ensure = (n: number) => {
    if (y + n > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (txt: string) => {
    ensure(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...FOREST);
    doc.text(txt, margin, y);
    y += 20;
    doc.setTextColor(30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const pg = metrics.participant_growth;

  if (sections.includes("executive")) {
    heading("Executive Summary");
    const lines = [
      `${pg.total_participants} participants in scope.`,
      `${pg.certifications_earned} certifications earned; ${pg.job_placements} job placements to date.`,
      `Wage growth: ${pg.wage_growth_pct}% (baseline $${pg.avg_baseline_wage} → current $${pg.avg_current_wage}).`,
      `Program completion rate: ${pg.completion_rate_pct}%.`,
      `Attendance rate: ${pg.attendance_rate_pct}% across ${pg.appointments_total} appointments.`,
      `Support: ${pg.support_requests_resolved}/${pg.support_requests_total} requests resolved (avg ${pg.avg_resolution_hours}h).`,
    ];
    for (const l of lines) {
      const wrapped = doc.splitTextToSize(l, pageW - margin * 2);
      ensure(wrapped.length * 12 + 4);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12 + 4;
    }
    y += 8;
  }

  if (sections.includes("kpi")) {
    heading("Key Performance Indicators");
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total participants", String(pg.total_participants)],
        ["Certifications earned", String(pg.certifications_earned)],
        ["Job placements", String(pg.job_placements)],
        ["Avg current wage", `$${pg.avg_current_wage}`],
        ["Wage growth", `${pg.wage_growth_pct}%`],
        ["Retention 30/90/180/365 d", `${pg.retention.d30} / ${pg.retention.d90} / ${pg.retention.d180} / ${pg.retention.d365}`],
        ["Program completion rate", `${pg.completion_rate_pct}%`],
        ["Attendance rate", `${pg.attendance_rate_pct}%`],
        ["Avg resolution time (h)", String(pg.avg_resolution_hours)],
      ],
      theme: "grid",
      headStyles: { fillColor: FOREST, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  if (sections.includes("funding") && metrics.funding_goals.length > 0) {
    heading("Funding Goal Progress");
    autoTable(doc, {
      startY: y,
      head: [["Goal", "Target", "Current", "Progress"]],
      body: metrics.funding_goals.map((g: any) => [
        g.title,
        String(g.target_value),
        String(g.current_value),
        `${Math.round(g.progress_pct)}%`,
      ]),
      theme: "grid",
      headStyles: { fillColor: FOREST, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  if (sections.includes("social")) {
    heading("Social Impact Indicators");
    const rows = Object.entries(metrics.social_impact.surveys).map(([slug, s]) => [
      s.title,
      String(s.response_count),
      s.suppressed ? "n<5 suppressed" : s.avg_score !== null ? `${Math.round(s.avg_score)} / 100` : "—",
    ]);
    if (rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Survey", "Responses", "Avg Score"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: FOREST, textColor: 255 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    }
  }

  if (sections.includes("demographics") && metrics.demographic_breakdown) {
    heading("Demographic Breakdown (n≥5 buckets only)");
    for (const [cat, buckets] of Object.entries(metrics.demographic_breakdown)) {
      const rows = Object.entries(buckets)
        .filter(([_, c]) => c > 0)
        .map(([k, c]) => [k, String(c)]);
      if (rows.length === 0) continue;
      autoTable(doc, {
        startY: y,
        head: [[cat.replace(/_/g, " "), "Count"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: FOREST, textColor: 255 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  if (sections.includes("trends") && metrics.trends.length > 0) {
    heading("Trends by Month");
    autoTable(doc, {
      startY: y,
      head: [["Month", "Placements", "Certifications", "Requests Resolved"]],
      body: metrics.trends.map((t) => [t.month, String(t.placements), String(t.certifications), String(t.requests_resolved)]),
      theme: "grid",
      headStyles: { fillColor: FOREST, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  if (sections.includes("methodology")) {
    heading("Methodology");
    const text = `Data sourced from Evolve Campus Care platform records as of ${ts}. Aggregations enforce role-based access; demographic buckets with fewer than 5 participants are suppressed to protect privacy. Survey scores are computed from Likert (1–5) and boolean responses normalized to a 0–100 scale. No free-text responses are included.`;
    const wrapped = doc.splitTextToSize(text, pageW - margin * 2);
    ensure(wrapped.length * 12);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 12;
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Evolve Foundation • ${templateTitle} • Page ${i} of ${total}`,
      margin,
      pageH - margin / 2,
    );
  }

  doc.save(`evolve-impact-report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
