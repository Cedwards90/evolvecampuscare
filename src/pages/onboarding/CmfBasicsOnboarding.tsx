import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CMF_NEEDS } from '@/lib/cmfNeeds';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const PREFERRED_CONTACT = ['In-Person', 'Phone', 'Video', 'Email'];

export default function CmfBasicsOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: file } = useQuery({
    queryKey: ['student-file', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_files')
        .select('primary_reason_for_contact')
        .eq('student_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [reason, setReason] = useState('');
  const [needs, setNeeds] = useState<number[]>([]);
  const [contactType, setContactType] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (file?.primary_reason_for_contact) setReason(file.primary_reason_for_contact);
  }, [file]);

  const toggleNeed = (code: number) =>
    setNeeds((n) => (n.includes(code) ? n.filter((c) => c !== code) : [...n, code]));

  const handleSubmit = async () => {
    if (!reason.trim() || !contactType) {
      toast({ title: 'Please complete required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error: fileErr } = await supabase
        .from('student_files')
        .update({
          primary_reason_for_contact: reason.trim(),
          cmf_identified_needs: needs,
        } as any)
        .eq('student_id', user!.id);
      if (fileErr) throw fileErr;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ cmf_preferred_contact_type: contactType } as any)
        .eq('user_id', user!.id);
      if (profErr) throw profErr;

      await qc.invalidateQueries({ queryKey: ['onboarding-status'] });
      await qc.invalidateQueries({ queryKey: ['student-file', user?.id] });
      navigate('/onboarding/personality-quiz');
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step={4}
      title="Case Management Basics"
      description="A few quick details so we can connect you with the right support."
    >
      <div className="space-y-2">
        <Label htmlFor="reason">Primary reason you're seeking support *</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="In your own words…"
        />
      </div>

      <div className="space-y-2">
        <Label>Areas you'd like help with (select all that apply)</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {CMF_NEEDS.map((n) => (
            <Label key={n.code} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={needs.includes(n.code)} onCheckedChange={() => toggleNeed(n.code)} />
              <span className="text-sm">{n.label}</span>
            </Label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred contact method *</Label>
        <RadioGroup value={contactType} onValueChange={setContactType} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PREFERRED_CONTACT.map((c) => (
            <Label key={c} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer">
              <RadioGroupItem value={c} /> {c}
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={saving} className="rounded-full">
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </OnboardingShell>
  );
}
