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
import { StudentPicker } from './StudentPicker';

type ControlledProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

interface SendSurveyDialogProps extends ControlledProps {
  /** When provided, sends to this student without showing a picker. */
  studentId?: string;
  studentName?: string;
  /** Optional default survey type. */
  defaultSurveyType?: string;
  trigger?: React.ReactNode;
}

export function SendSurveyDialog({
  studentId: presetId,
  studentName: presetName,
  defaultSurveyType,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: SendSurveyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;
  const setOpen = (o: boolean) => {
    if (!isControlled) setInternalOpen(o);
    onOpenChangeProp?.(o);
  };

  const [pickedId, setPickedId] = useState<string>('');
  const [pickedName, setPickedName] = useState<string>('');
  const [surveyType, setSurveyType] = useState(defaultSurveyType || '');
  const [notes, setNotes] = useState('');
  const sendSurvey = useSendSurvey();

  const activeId = presetId || pickedId;
  const activeName = presetName || pickedName || 'this student';

  const handleSubmit = async () => {
    if (!activeId) {
      toast.error('Please select a student.');
      return;
    }
    if (!surveyType) {
      toast.error('Please select a survey type.');
      return;
    }
    try {
      await sendSurvey.mutateAsync({ studentId: activeId, surveyType, notes: notes.trim() || undefined });
      toast.success(`Survey request sent to ${activeName}.`);
      setOpen(false);
      setSurveyType(defaultSurveyType || '');
      setNotes('');
      setPickedId('');
      setPickedName('');
    } catch {
      toast.error('Failed to send survey request.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <ClipboardList className="mr-2 h-4 w-4" />
              Send Survey
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Survey{presetName ? ` to ${presetName}` : ''}</DialogTitle>
          <DialogDescription>
            Request a student to complete a survey. They'll receive an in-app notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!presetId && (
            <div className="space-y-2">
              <Label>Student</Label>
              <StudentPicker
                value={pickedId}
                onChange={(id, name) => { setPickedId(id); setPickedName(name); }}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <Select value={surveyType} onValueChange={setSurveyType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a survey…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">Weekly Check-In</SelectItem>
                <SelectItem value="post_graduation_plan">12-Month Post-Graduation Plan</SelectItem>
                <SelectItem value="intake">Student Intake Survey</SelectItem>
                <SelectItem value="career_intake">Career Intake Survey</SelectItem>
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
