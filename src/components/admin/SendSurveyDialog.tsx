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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useSendSurvey } from '@/hooks/useSurveyInvitations';
import { useAllCohorts } from '@/hooks/useCohorts';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { toast } from 'sonner';
import { StudentPicker } from './StudentPicker';

type Mode = 'cohort' | 'organization' | 'student';

type ControlledProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

interface SendSurveyDialogProps extends ControlledProps {
  /** When provided, sends to this student without showing the target picker. */
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

  const [mode, setMode] = useState<Mode>(presetId ? 'student' : 'cohort');
  const [cohortId, setCohortId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [pickedName, setPickedName] = useState('');
  const [surveyType, setSurveyType] = useState(defaultSurveyType || '');
  const [notes, setNotes] = useState('');
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);

  const { data: cohorts = [] } = useAllCohorts();
  const { data: orgs = [] } = useActiveOrganizations();
  const sendSurvey = useSendSurvey();

  const reset = () => {
    setSurveyType(defaultSurveyType || '');
    setNotes('');
    setPickedId('');
    setPickedName('');
    setCohortId('');
    setOrgId('');
    setSkipAlreadySent(true);
    setMode(presetId ? 'student' : 'cohort');
  };

  const handleSubmit = async () => {
    if (!surveyType) { toast.error('Please select a survey type.'); return; }
    if (presetId) {
      // Preset single-student flow
    } else if (mode === 'cohort' && !cohortId) { toast.error('Please pick a cohort.'); return; }
    else if (mode === 'organization' && !orgId) { toast.error('Please pick an organization.'); return; }
    else if (mode === 'student' && !pickedId) { toast.error('Please select a student.'); return; }

    try {
      const res = await sendSurvey.mutateAsync({
        surveyType,
        notes: notes.trim() || undefined,
        skipAlreadySent,
        studentId: presetId || (mode === 'student' ? pickedId : undefined),
        cohortId: !presetId && mode === 'cohort' ? cohortId : undefined,
        organizationId: !presetId && mode === 'organization' ? orgId : undefined,
      });

      const parts = [`${res.assigned} sent`];
      if (res.skipped) parts.push(`${res.skipped} skipped (already invited)`);
      if (res.assigned === 0 && !res.skipped) {
        toast.message('Nothing to send — no matching students.');
      } else {
        toast.success(parts.join(' · '));
      }
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send survey request.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <ClipboardList className="mr-2 h-4 w-4" />
              Send Survey
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Survey{presetName ? ` to ${presetName}` : ''}</DialogTitle>
          <DialogDescription>
            Request students to complete a survey. They'll receive an in-app notification.
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
                <SelectItem value="checkin">Weekly Check-In</SelectItem>
                <SelectItem value="post_graduation_plan">12-Month Post-Graduation Plan</SelectItem>
                <SelectItem value="intake">Student Intake Survey</SelectItem>
                <SelectItem value="career_intake">Career Intake Survey</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!presetId && (
            <div className="space-y-2">
              <Label className="text-sm">Send to</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="ss-cohort" value="cohort" />
                  <Label htmlFor="ss-cohort" className="text-sm font-normal">A cohort</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="ss-org" value="organization" />
                  <Label htmlFor="ss-org" className="text-sm font-normal">An entire organization</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="ss-student" value="student" />
                  <Label htmlFor="ss-student" className="text-sm font-normal">A specific student</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {!presetId && mode === 'cohort' && (
            <div className="space-y-2">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Select cohort…" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!presetId && mode === 'organization' && (
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Select organization…" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!presetId && mode === 'student' && (
            <div className="space-y-2">
              <Label>Student</Label>
              <StudentPicker
                value={pickedId}
                onChange={(id, name) => { setPickedId(id); setPickedName(name); }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any context or instructions for the student…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="ss-skip-already-sent"
              checked={skipAlreadySent}
              onCheckedChange={(v) => setSkipAlreadySent(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="ss-skip-already-sent" className="text-sm font-normal leading-snug">
              Only send to students who haven't received this survey yet
              <span className="block text-xs text-muted-foreground">
                Skips anyone with an open (uncompleted) invitation for this survey.
              </span>
            </Label>
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
