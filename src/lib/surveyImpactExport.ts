import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { SurveyImpactResult } from '@/hooks/useSurveyImpact';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvSection(title: string, headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push(headers.map(csvEscape).join(','));
  rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
  lines.push('');
  return lines.join('\n');
}

export function exportSurveyImpactCsv(
  surveyTitle: string,
  result: SurveyImpactResult,
  range: { from: Date; to: Date },
) {
  const sections: string[] = [];
  sections.push(
    toCsvSection('Report', ['Survey', 'From', 'To', 'Generated At'], [[
      surveyTitle,
      format(range.from, 'yyyy-MM-dd'),
      format(range.to, 'yyyy-MM-dd'),
      format(new Date(), 'yyyy-MM-dd HH:mm'),
    ]]),
  );
  sections.push(
    toCsvSection('Summary', ['Metric', 'Value'], [
      ['Total responses', result.totalResponses],
      ['Unique respondents', result.uniqueRespondents],
      ['First submission', result.firstAt || ''],
      ['Last submission', result.lastAt || ''],
      ...Object.entries(result.metrics).map(([k, v]) => [k, v ?? '']),
    ]),
  );
  sections.push(toCsvSection('Volume by Day', ['Date', 'Count'], result.volumeByDay.map((v) => [v.date, v.count])));
  for (const d of result.distributions) {
    sections.push(toCsvSection(d.title, ['Bucket', 'Count'], d.data.map((row) => [row.name, row.value])));
  }
  for (const t of result.textHighlights) {
    sections.push(toCsvSection(t.title, ['Text', 'Count'], t.items.map((i) => [i.text, i.count])));
  }
  sections.push(
    toCsvSection(
      'Responses',
      ['Submitted At', 'Student', 'Email', 'Organization', 'Cohort', 'Year', 'Payload'],
      result.rows.map((r) => [r.ts, r.full_name || '', r.email || '', r.organization_name || '', r.cohort_id || '', r.year_of_study || '', r.data]),
    ),
  );
  downloadBlob('\ufeff' + sections.join('\n'), 'text/csv;charset=utf-8', `survey-impact_${slug(surveyTitle)}_${format(range.from, 'yyyyMMdd')}-${format(range.to, 'yyyyMMdd')}.csv`);
}

export function exportSurveyImpactPdf(
  surveyTitle: string,
  result: SurveyImpactResult,
  range: { from: Date; to: Date },
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(5, 77, 59);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Survey Impact Report', 40, 32);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(surveyTitle, 40, 52);
  doc.setFontSize(9);
  doc.setTextColor(220, 230, 220);
  doc.text('Powered by Evolve Foundation', pageWidth - 40, 32, { align: 'right' });

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(
    `Range: ${format(range.from, 'PP')} – ${format(range.to, 'PP')}    Generated: ${format(new Date(), 'PP p')}`,
    40,
    95,
  );

  autoTable(doc, {
    startY: 110,
    head: [['Summary', 'Value']],
    body: [
      ['Total responses', String(result.totalResponses)],
      ['Unique respondents', String(result.uniqueRespondents)],
      ['First submission', result.firstAt ? format(new Date(result.firstAt), 'PP') : '—'],
      ['Last submission', result.lastAt ? format(new Date(result.lastAt), 'PP') : '—'],
      ...Object.entries(result.metrics).map(([k, v]) => [k, v == null ? '—' : String(v)]),
    ],
    headStyles: { fillColor: [5, 77, 59] },
    theme: 'striped',
    styles: { fontSize: 10 },
  });

  for (const d of result.distributions) {
    if (!d.data.length) continue;
    autoTable(doc, {
      head: [[d.title, 'Count']],
      body: d.data.map((row) => [row.name, String(row.value)]),
      headStyles: { fillColor: [136, 169, 140] },
      theme: 'striped',
      styles: { fontSize: 10 },
    });
  }

  for (const t of result.textHighlights) {
    if (!t.items.length) continue;
    autoTable(doc, {
      head: [[t.title, 'Mentions']],
      body: t.items.map((i) => [i.text, String(i.count)]),
      headStyles: { fillColor: [136, 169, 140] },
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 400 } },
    });
  }

  if (result.volumeByDay.length) {
    autoTable(doc, {
      head: [['Date', 'Submissions']],
      body: result.volumeByDay.map((v) => [v.date, String(v.count)]),
      headStyles: { fillColor: [5, 77, 59] },
      theme: 'striped',
      styles: { fontSize: 9 },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Confidential • Generated by Evolve Foundation • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    );
  }

  doc.save(`survey-impact_${slug(surveyTitle)}_${format(range.from, 'yyyyMMdd')}-${format(range.to, 'yyyyMMdd')}.pdf`);
}
