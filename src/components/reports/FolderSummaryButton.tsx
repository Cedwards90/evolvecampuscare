import { useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { FolderSummaryDialog } from './FolderSummaryDialog';
import { useFolderSummaryAudit } from '@/hooks/useFolderSummary';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  studentId: string;
  studentName: string;
}

export function FolderSummaryButton({ studentId, studentName }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: audit } = useFolderSummaryAudit(studentId);

  // Hide for the student themselves
  if (user?.id === studentId) return null;

  const lastGen = audit?.find((a) => a.action === 'generated');

  return (
    <>
      <Card className="border border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Folder summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            AI-generated overview of this student's full folder, grounded only in stored records
            (notes, requests, certifications, meetings, check-ins, intake, plans).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1" />
              Generate folder summary
            </Button>
            {lastGen && (
              <span className="text-xs text-muted-foreground ml-auto">
                Last generated {formatDistanceToNow(new Date(lastGen.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {open && (
        <FolderSummaryDialog
          open={open}
          onOpenChange={setOpen}
          studentId={studentId}
          studentName={studentName}
          generatedByName={profile?.full_name || profile?.email || undefined}
        />
      )}
    </>
  );
}
