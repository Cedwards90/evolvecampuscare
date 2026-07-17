import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { RequestAnalyticsData } from '@/hooks/useRequestAnalytics';

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvSection(title: string, headers: string[], rows: unknown[][]): string {
  const lines = [title, headers.map(csvEscape).join(',')];
  rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
  lines.push('');
  return lines.join('\n');
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const stamp = () => format(new Date(), 'yyyy-MM-dd_HH-mm');

export function exportRequestAnalyticsCsv(d: RequestAnalyticsData, days: number) {
  const sections: string[] = [];

  sections.push(
    toCsvSection(
      'Summary',
      ['Metric', 'Value'],
      [
        ['Range (days)', days],
        ['Total requests', d.summary.total],
        ['Open', d.summary.open],
        ['Resolved', d.summary.resolved],
        ['Escalated', d.summary.escalated],
        ['Emergency', d.summary.emergency],
        ['Avg resolution (hours)', d.summary.avgResolutionHours],
        ['Median resolution (hours)', d.summary.medianResolutionHours],
        ['Repeat requester rate (%)', d.summary.repeatRequesterRate],
        ['Financial requested', money(d.summary.financialRequested)],
        ['Financial approved', money(d.summary.financialApproved)],
        ['Financial pending', money(d.summary.financialPending)],
      ],
    ),
  );

  sections.push(
    toCsvSection(
      'Volume by Day',
      ['Date', 'Total', 'Resolved', 'Emergency'],
      d.volume.map((v) => [v.date, v.total, v.resolved, v.emergency]),
    ),
  );

  sections.push(
    toCsvSection(
      'By Category',
      ['Category', 'Count', 'Resolved', 'Avg Hours'],
      d.byCategory.map((c) => [c.category, c.count, c.resolved, c.avgHours]),
    ),
  );

  sections.push(
    toCsvSection(
      'By Priority',
      ['Priority', 'Count'],
      d.byPriority.map((p) => [p.priority, p.count]),
    ),
  );

  sections.push(
    toCsvSection(
      'By Status',
      ['Status', 'Count'],
      d.byStatus.map((s) => [s.status, s.count]),
    ),
  );

  sections.push(
    toCsvSection(
      'Unresolved Backlog (age)',
      ['Bucket', 'Count'],
      d.backlogAge.map((b) => [b.bucket, b.count]),
    ),
  );

  sections.push(
    toCsvSection(
      'Repeat Requesters',
      ['Student', 'Requests in Range'],
      d.repeat.map((r) => [r.studentName, r.count]),
    ),
  );

  sections.push(
    toCsvSection(
      'Financial by Category',
      ['Category', 'Requested', 'Approved', 'Pending'],
      d.financialByCategory.map((f) => [f.category, f.requested, f.approved, f.pending]),
    ),
  );

  sections.push(
    toCsvSection(
      'Financial by Organization',
      ['Organization', 'Requested', 'Approved', 'Pending'],
      d.financialByOrg.map((f) => [f.organization, f.requested, f.approved, f.pending]),
    ),
  );

  sections.push(
    toCsvSection(
      'By Case Manager',
      ['Case Manager', 'Total', 'Open', 'Resolved', 'Avg Hours'],
      d.byCaseManager.map((c) => [c.name, c.total, c.open, c.resolved, c.avgHours]),
    ),
  );

  sections.push(
    toCsvSection(
      'Breakdown (Org / Cohort / Case Manager / Category)',
      ['Organization', 'Cohort', 'Case Manager', 'Category', 'Total', 'Resolved', 'Resolved %', 'Avg Hours', 'Approved $'],
      d.breakdown.map((b) => [
        b.organization,
        b.cohort,
        b.caseManager,
        b.category,
        b.total,
        b.resolved,
        b.resolvedPct,
        b.avgHours,
        b.approved,
      ]),
    ),
  );

  downloadBlob(sections.join('\n'), 'text/csv;charset=utf-8', `request-analytics_${stamp()}.csv`);
}

export function exportRequestAnalyticsRowsCsv(d: RequestAnalyticsData) {
  const rows = d.rows.map((r) => [
    r.id,
    r.created_at,
    r.resolved_at || '',
    r.status,
    r.priority,
    r.category,
    r.is_emergency ? 'yes' : 'no',
    r.organization_name || '',
    r.cohort_name || '',
    r.case_manager_name || '',
    r.year_of_study || '',
    r.program || '',
    r.student_status,
    r.requested_amount ?? '',
    r.approved_amount ?? '',
    r.approval_status || '',
  ]);
  const csv = toCsvSection(
    'Requests',
    [
      'Request ID', 'Created At', 'Resolved At', 'Status', 'Priority', 'Category', 'Emergency',
      'Organization', 'Cohort', 'Case Manager', 'Year of Study', 'Program', 'Student Status',
      'Requested Amount', 'Approved Amount', 'Approval Status',
    ],
    rows,
  );
  downloadBlob(csv, 'text/csv;charset=utf-8', `request-analytics_rows_${stamp()}.csv`);
}

export function exportRequestAnalyticsPdf(d: RequestAnalyticsData, days: number) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const marginX = 40;
  let y = 40;

  doc.setFontSize(16);
  doc.text('Support Request Analytics', marginX, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Last ${days} days · Generated ${format(new Date(), 'PP p')}`, marginX, y);
  doc.setTextColor(0);
  y += 16;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total requests', String(d.summary.total)],
      ['Open', String(d.summary.open)],
      ['Resolved', String(d.summary.resolved)],
      ['Escalated', String(d.summary.escalated)],
      ['Emergency', String(d.summary.emergency)],
      ['Avg resolution (h)', String(d.summary.avgResolutionHours)],
      ['Median resolution (h)', String(d.summary.medianResolutionHours)],
      ['Repeat requester rate', `${d.summary.repeatRequesterRate}%`],
      ['Financial requested', money(d.summary.financialRequested)],
      ['Financial approved', money(d.summary.financialApproved)],
      ['Financial pending', money(d.summary.financialPending)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [5, 77, 59] },
    margin: { left: marginX, right: marginX },
  });

  autoTable(doc, {
    head: [['Category', 'Count', 'Resolved', 'Avg Hours']],
    body: d.byCategory.map((c) => [c.category, c.count, c.resolved, c.avgHours]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [5, 77, 59] },
    margin: { left: marginX, right: marginX },
  });

  autoTable(doc, {
    head: [['Backlog Age', 'Count']],
    body: d.backlogAge.map((b) => [b.bucket, b.count]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [5, 77, 59] },
    margin: { left: marginX, right: marginX },
  });

  if (d.financialByOrg.length) {
    autoTable(doc, {
      head: [['Organization', 'Requested', 'Approved', 'Pending']],
      body: d.financialByOrg.map((f) => [f.organization, money(f.requested), money(f.approved), money(f.pending)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [5, 77, 59] },
      margin: { left: marginX, right: marginX },
    });
  }

  if (d.byCaseManager.length) {
    autoTable(doc, {
      head: [['Case Manager', 'Total', 'Open', 'Resolved', 'Avg Hours']],
      body: d.byCaseManager.map((c) => [c.name, c.total, c.open, c.resolved, c.avgHours]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [5, 77, 59] },
      margin: { left: marginX, right: marginX },
    });
  }

  if (d.breakdown.length) {
    autoTable(doc, {
      head: [['Org', 'Cohort', 'Case Manager', 'Category', 'Total', 'Resolved', 'Resolved %', 'Avg h', 'Approved $']],
      body: d.breakdown
        .slice(0, 200)
        .map((b) => [
          b.organization,
          b.cohort,
          b.caseManager,
          b.category,
          b.total,
          b.resolved,
          `${b.resolvedPct}%`,
          b.avgHours,
          money(b.approved),
        ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 77, 59] },
      margin: { left: marginX, right: marginX },
    });
  }

  doc.save(`request-analytics_${stamp()}.pdf`);
}
