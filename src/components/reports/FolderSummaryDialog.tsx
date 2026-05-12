import { useState } from 'react';
import { Loader2, FileText, Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useFolderSummary, useFolderSummaryAudit, SECTION_LABELS, type FolderSummary } from '@/hooks/useFolderSummary';
import { downloadFolderSummaryPdf } from '@/lib/folderSummaryPdf';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
  generatedByName?: string;
}

export function FolderSummaryDialog({ open, onOpenChange, studentId, studentName, generatedByName }: Props) {
  const { toast } = useToast();
  const generate = useFolderSummary(studentId);
  const { logDownload } = useFolderSummaryAudit(studentId);
  const [summary, setSummary] = useState<FolderSummary | null>(null);

  const run = async () => {
    setSummary(null);
    try {
      const data = await generate.mutateAsync();
      setSummary(data);
    } catch (e: any) {
      toast({ title: 'Could not generate summary', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  // Auto-run on open
  if (open && !summary && !generate.isPending && !generate.isError) {
    run();
  }

  const empty = summary && Object.values(summary.sections).every(
    (s) => s.bullets.length === 1 && s.bullets[0].text === 'No data available.',
  );

  const onDownload = async () => {
    if (!summary) return;
    downloadFolderSummaryPdf({ summary, studentName, generatedByName });
    await logDownload();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSummary(null); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Folder summary — {studentName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {generate.isPending && (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating grounded summary…
            </div>
          )}

          {summary && empty && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              This student's folder has no records yet. Add notes, requests, certifications,
              or check-ins, then regenerate.
            </div>
          )}

          {summary && !empty && (
            <div className="space-y-5">
              {Object.entries(SECTION_LABELS).map(([key, label]) => {
                const section = summary.sections[key];
                if (!section) return null;
                return (
                  <section key={key}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{label}</h3>
                    <ul className="space-y-2">
                      {section.bullets.map((b, i) => (
                        <li key={i} className="text-sm">
                          <p className="leading-snug">{b.text}</p>
                          {b.evidence_ids.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {b.evidence_ids.slice(0, 6).map((id) => (
                                <Badge key={id} variant="secondary" className="text-[10px] font-mono">
                                  {id}
                                </Badge>
                              ))}
                              {b.evidence_ids.length > 6 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +{b.evidence_ids.length - 6}
                                </Badge>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <p className="text-[11px] text-muted-foreground pt-3 border-t">
                AI-generated and grounded in stored records. Bullets without supporting evidence
                are filtered. Verify before acting.
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={run} disabled={generate.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Regenerate
          </Button>
          <Button onClick={onDownload} disabled={!summary || generate.isPending}>
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
