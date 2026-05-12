import jsPDF from 'jspdf';
import type { FolderSummary } from '@/hooks/useFolderSummary';
import { SECTION_LABELS } from '@/hooks/useFolderSummary';

interface Args {
  summary: FolderSummary;
  studentName: string;
  generatedByName?: string;
}

export function downloadFolderSummaryPdf({ summary, studentName, generatedByName }: Args) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(5, 77, 59); // forest green
  doc.text('Evolve Foundation', margin, y);
  y += 18;
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Student folder summary', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  const ts = new Date(summary.generated_at).toLocaleString();
  doc.text(`Student: ${studentName}`, margin, y); y += 12;
  doc.text(`Generated: ${ts}${generatedByName ? `  •  by ${generatedByName}` : ''}`, margin, y); y += 12;
  if (summary.model) {
    doc.text(`Model: ${summary.model} (grounded — bullets without evidence are removed)`, margin, y);
    y += 12;
  }
  y += 6;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 30) {
      doc.addPage();
      y = margin;
    }
  };

  for (const key of Object.keys(SECTION_LABELS)) {
    const section = summary.sections[key];
    if (!section) continue;
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(5, 77, 59);
    doc.text(SECTION_LABELS[key], margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30);
    for (const b of section.bullets) {
      const text = `• ${b.text}`;
      const lines = doc.splitTextToSize(text, pageW - margin * 2 - 10);
      ensureSpace(lines.length * 12 + 4);
      doc.text(lines, margin + 6, y);
      y += lines.length * 12;
      if (b.evidence_ids.length > 0) {
        doc.setTextColor(130);
        doc.setFontSize(8);
        const ev = `   sources: ${b.evidence_ids.join(', ')}`;
        const evLines = doc.splitTextToSize(ev, pageW - margin * 2 - 12);
        ensureSpace(evLines.length * 10 + 2);
        doc.text(evLines, margin + 12, y);
        y += evLines.length * 10;
        doc.setFontSize(10);
        doc.setTextColor(30);
      }
      y += 4;
    }
    y += 8;
  }

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `AI-generated. Grounded in folder records as of ${ts}. Verify before acting.  •  Page ${i} of ${total}`,
      margin,
      pageH - margin / 2,
    );
  }

  const slug = studentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
  const date = new Date(summary.generated_at).toISOString().slice(0, 10);
  doc.save(`evolve-folder-summary_${slug}_${date}.pdf`);
}
