import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRightLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { useActiveOrganizations } from '@/hooks/useTrainingOrganizations';
import { useInitiateTransfer } from '@/hooks/useParticipantTransfers';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const RECORD_TYPES = [
  { id: 'requests', label: 'Support requests' },
  { id: 'case_notes', label: 'Case notes' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'intake', label: 'Intake responses' },
  { id: 'post_grad', label: 'Post-graduation plans' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'attachments', label: 'Uploaded documents' },
  { id: 'messages', label: 'Communication history' },
];

interface Props {
  studentId: string;
  fromOrgId: string | null;
  trigger?: React.ReactNode;
}

export function InitiateTransferDialog({ studentId, fromOrgId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [toOrgId, setToOrgId] = useState('');
  const [reason, setReason] = useState('');
  const [included, setIncluded] = useState<string[]>(RECORD_TYPES.map((r) => r.id));
  const { data: orgs = [] } = useActiveOrganizations();
  const initiate = useInitiateTransfer();
  const { toast } = useToast();

  // Pre-flight validation snapshot via the export pipeline — just call the function with format=pdf? No, that would write a file.
  // Instead, surface validation findings at generate time. For dialog UX show a hint.
  const { data: openEmergencies } = useQuery({
    queryKey: ['transfer-preflight', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('support_requests')
        .select('id, is_emergency, status')
        .eq('student_id', studentId)
        .eq('is_emergency', true)
        .in('status', ['submitted', 'in_progress', 'escalated']);
      return data || [];
    },
    enabled: open,
  });

  function toggle(id: string) {
    setIncluded((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleSubmit() {
    if (!fromOrgId) {
      toast({ title: 'Missing organization', description: 'Participant has no source organization on file.', variant: 'destructive' });
      return;
    }
    if (!toOrgId) {
      toast({ title: 'Pick receiving org', variant: 'destructive' });
      return;
    }
    if (toOrgId === fromOrgId) {
      toast({ title: 'Source and destination cannot match', variant: 'destructive' });
      return;
    }
    try {
      await initiate.mutateAsync({
        student_id: studentId,
        from_organization_id: fromOrgId,
        to_organization_id: toOrgId,
        reason,
        included_record_types: included,
      });
      toast({ title: 'Transfer initiated', description: 'Now generate the record bundle to attach.' });
      setOpen(false);
      setReason(''); setToOrgId('');
    } catch (e: any) {
      toast({ title: 'Failed to initiate', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline"><ArrowRightLeft className="h-4 w-4 mr-2" /> Initiate transfer</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Initiate participant transfer</DialogTitle>
          <DialogDescription>
            Establishes the chain of custody. The receiving Org Admin must acknowledge receipt to mark the transfer complete.
          </DialogDescription>
        </DialogHeader>

        {openEmergencies && openEmergencies.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {openEmergencies.length} open emergency request(s). Resolve or escalate before transferring.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label>Receiving organization</Label>
            <Select value={toOrgId} onValueChange={setToOrgId}>
              <SelectTrigger><SelectValue placeholder="Select organization…" /></SelectTrigger>
              <SelectContent>
                {orgs.filter((o) => o.id !== fromOrgId).map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this participant being transferred?" />
          </div>
          <div>
            <Label>Records included in transfer</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-md">
              {RECORD_TYPES.map((rt) => (
                <label key={rt.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={included.includes(rt.id)} onCheckedChange={() => toggle(rt.id)} />
                  <span className="text-sm">{rt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={initiate.isPending || !toOrgId || !reason.trim()}>
            {initiate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Initiate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
