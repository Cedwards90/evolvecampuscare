import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAllCohorts } from '@/hooks/useCohorts';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { sendLifeSkillsSurvey } from '@/hooks/useLifeSkillsSurveys';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { StudentPicker } from './StudentPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateSlug: string;
  templateTitle: string;
}

type Mode = 'cohort' | 'organization' | 'student';

export function SendLifeSkillsDialog({ open, onOpenChange, templateSlug, templateTitle }: Props) {
  const { toast } = useToast();
  const { data: cohorts = [] } = useAllCohorts();
  const { data: orgs = [] } = useActiveOrganizations();
  const [mode, setMode] = useState<Mode>('cohort');
  const [cohortId, setCohortId] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => { setCohortId(''); setOrgId(''); setStudentId(''); setNotes(''); };

  const onSend = async () => {
    if (mode === 'cohort' && !cohortId) { toast({ title: 'Pick a cohort', variant: 'destructive' }); return; }
    if (mode === 'organization' && !orgId) { toast({ title: 'Pick an organization', variant: 'destructive' }); return; }
    if (mode === 'student' && !studentId) { toast({ title: 'Pick a student', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const res = await sendLifeSkillsSurvey({
        template_slug: templateSlug,
        cohort_id: mode === 'cohort' ? cohortId : undefined,
        organization_id: mode === 'organization' ? orgId : undefined,
        student_ids: mode === 'student' ? [studentId] : undefined,
        notes: notes.trim() || undefined,
      });
      toast({
        title: 'Survey sent',
        description: `${res.assigned} assigned · ${res.emailed} emailed${res.failed ? ` · ${res.failed} failed` : ''}`,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to send', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Life Skills survey</DialogTitle>
          <DialogDescription>{templateTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Send to</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-2 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="m-cohort" value="cohort" />
                <Label htmlFor="m-cohort" className="text-sm font-normal">A cohort</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="m-org" value="organization" />
                <Label htmlFor="m-org" className="text-sm font-normal">An entire organization</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="m-student" value="student" />
                <Label htmlFor="m-student" className="text-sm font-normal">A specific student</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'cohort' && (
            <div>
              <Label className="text-sm">Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Select cohort..." /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'organization' && (
            <div>
              <Label className="text-sm">Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Select organization..." /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'student' && (
            <div>
              <Label className="text-sm">Student</Label>
              <StudentPicker value={studentId} onChange={(id) => setStudentId(id)} />
            </div>
          )}


          <div>
            <Label className="text-sm">Note to students (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. Please complete this before our session on Friday."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={onSend} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
