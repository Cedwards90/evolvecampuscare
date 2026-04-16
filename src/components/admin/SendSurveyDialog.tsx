import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSendSurvey } from '@/hooks/useSurveyInvitations';
import { toast } from 'sonner';

interface SendSurveyDialogProps {
  studentId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

export function SendSurveyDialog({ studentId, studentName, trigger }: SendSurveyDialogProps) {
  const [open, setOpen] = useState(false);
  const [surveyType, setSurveyType] = useState('');
  const [notes, setNotes] = useState('');
  const sendSurvey = useSendSurvey();

  const handleSubmit = async () => {
    if (!surveyType) {
      toast.error('Please select a survey type.');
      return;
    }
    try {
      await sendSurvey.mutateAsync({ studentId, surveyType, notes: notes.trim() || undefined });
      toast.success(`Survey request sent to ${studentName}.`);
      setOpen(false);
      setSurveyType('');
      setNotes('');
    } catch {
      toast.error('Failed to send survey request.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ClipboardList className="mr-2 h-4 w-4" />
            Send Survey
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Survey to {studentName}</DialogTitle>
          <DialogDescription>
            Request the student to complete a survey. They'll receive an in-app notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <Select value={surveyType} onValueChange={setSurveyType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a survey…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">3-Week Check-In</SelectItem>
                <SelectItem value="post_graduation_plan">12-Month Post-Graduation Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any context or instructions for the student…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sendSurvey.isPending}>
            {sendSurvey.isPending ? 'Sending…' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
