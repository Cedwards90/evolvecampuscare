import { useState, useEffect } from 'react';
import { Brain, Pencil, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/EmptyState';
import { useStudentPersonality, type PersonalityProfile } from '@/hooks/useStudentPersonality';
import { useToast } from '@/hooks/use-toast';

type TraitKey = 'energy' | 'mind' | 'nature' | 'tactics' | 'identity';

const TRAITS: { key: TraitKey; label: string; left: string; right: string }[] = [
  { key: 'energy', label: 'Energy', left: 'Introverted', right: 'Extraverted' },
  { key: 'mind', label: 'Mind', left: 'Intuitive', right: 'Observant' },
  { key: 'nature', label: 'Nature', left: 'Thinking', right: 'Feeling' },
  { key: 'tactics', label: 'Tactics', left: 'Judging', right: 'Prospecting' },
  { key: 'identity', label: 'Identity', left: 'Assertive', right: 'Turbulent' },
];

interface Props {
  studentId: string;
  canEdit: boolean;
}

export function PersonalityCard({ studentId, canEdit }: Props) {
  const { profile, isLoading, upsert, remove } = useStudentPersonality(studentId);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Personality Profile
          </CardTitle>
          <CardDescription>
            {profile?.assessment_source ? `Source: ${profile.assessment_source}` : 'Personality assessment results'}
          </CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {profile ? 'Edit' : 'Add'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? null : !profile ? (
          <EmptyState
            icon={Brain}
            title="No personality profile yet"
            description={canEdit ? "Add results from 16Personalities or any assessment." : 'Your case manager has not added one yet.'}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {profile.type_code && <Badge className="text-base px-3 py-1">{profile.type_code}</Badge>}
              {profile.type_name && <span className="text-lg font-medium">{profile.type_name}</span>}
              {profile.assessment_url && (
                <a
                  href={profile.assessment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {profile.summary && <p className="text-sm whitespace-pre-wrap">{profile.summary}</p>}

            <div className="space-y-2">
              {TRAITS.map((t) => {
                const pct = profile[`${t.key}_pct` as const] as number | null;
                const label = profile[`${t.key}_label` as const] as string | null;
                if (pct == null) return null;
                return (
                  <div key={t.key} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.left}</span>
                      <span className="font-medium text-foreground">
                        {t.label}: {pct}% {label || ''}
                      </span>
                      <span>{t.right}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>

            {profile.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.strengths.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.weaknesses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Weaknesses</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.weaknesses.map((w) => (
                    <Badge key={w} variant="outline" className="text-xs">{w}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {canEdit && (
        <PersonalityDialog
          open={open}
          onOpenChange={setOpen}
          existing={profile}
          onSave={async (input) => {
            await upsert.mutateAsync(input);
          }}
          onDelete={profile ? async () => { await remove.mutateAsync(); } : undefined}
        />
      )}
    </Card>
  );
}

function PersonalityDialog({
  open,
  onOpenChange,
  existing,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: PersonalityProfile | null | undefined;
  onSave: (input: any) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      type_code: existing?.type_code ?? '',
      type_name: existing?.type_name ?? '',
      summary: existing?.summary ?? '',
      assessment_source: existing?.assessment_source ?? '16Personalities',
      assessment_url: existing?.assessment_url ?? '',
      assessed_on: existing?.assessed_on ?? '',
      energy_pct: existing?.energy_pct ?? 50,
      energy_label: existing?.energy_label ?? '',
      mind_pct: existing?.mind_pct ?? 50,
      mind_label: existing?.mind_label ?? '',
      nature_pct: existing?.nature_pct ?? 50,
      nature_label: existing?.nature_label ?? '',
      tactics_pct: existing?.tactics_pct ?? 50,
      tactics_label: existing?.tactics_label ?? '',
      identity_pct: existing?.identity_pct ?? 50,
      identity_label: existing?.identity_label ?? '',
    });
    setStrengthsText((existing?.strengths ?? []).join('\n'));
    setWeaknessesText((existing?.weaknesses ?? []).join('\n'));
  }, [open, existing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...form,
        assessed_on: form.assessed_on || null,
        strengths: strengthsText.split('\n').map((s) => s.trim()).filter(Boolean),
        weaknesses: weaknessesText.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      toast({ title: 'Personality profile saved' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personality Profile</DialogTitle>
          <DialogDescription>Enter results from a personality assessment (e.g. 16Personalities).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type Code</Label>
              <Input value={form.type_code} onChange={(e) => setForm({ ...form, type_code: e.target.value })} placeholder="INTJ-T" maxLength={16} />
            </div>
            <div>
              <Label className="text-xs">Type Name</Label>
              <Input value={form.type_name} onChange={(e) => setForm({ ...form, type_name: e.target.value })} placeholder="Architect" maxLength={64} />
            </div>
            <div>
              <Label className="text-xs">Assessment Source</Label>
              <Input value={form.assessment_source} onChange={(e) => setForm({ ...form, assessment_source: e.target.value })} maxLength={64} />
            </div>
            <div>
              <Label className="text-xs">Assessed On</Label>
              <Input type="date" value={form.assessed_on || ''} onChange={(e) => setForm({ ...form, assessed_on: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Source URL</Label>
              <Input value={form.assessment_url} onChange={(e) => setForm({ ...form, assessment_url: e.target.value })} placeholder="https://www.16personalities.com/profiles/..." maxLength={500} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Summary</Label>
            <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="min-h-[80px]" maxLength={2000} placeholder="Brief overview of the personality type and how it shows up for this student..." />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Trait Scores</p>
            {TRAITS.map((t) => (
              <div key={t.key} className="space-y-2 border border-border/60 rounded-lg p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t.left}</span>
                  <span className="font-medium">{t.label}: {form[`${t.key}_pct`]}%</span>
                  <span className="text-muted-foreground">{t.right}</span>
                </div>
                <Slider
                  value={[form[`${t.key}_pct`] ?? 50]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setForm({ ...form, [`${t.key}_pct`]: v })}
                />
                <Input
                  value={form[`${t.key}_label`] || ''}
                  onChange={(e) => setForm({ ...form, [`${t.key}_label`]: e.target.value })}
                  placeholder={`Label (e.g. "${t.left}" or "${t.right}")`}
                  maxLength={32}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Strengths (one per line)</Label>
              <Textarea value={strengthsText} onChange={(e) => setStrengthsText(e.target.value)} className="min-h-[100px]" maxLength={2000} placeholder="Innovative Mindset&#10;Independent Worker&#10;Conceptual Thinking" />
            </div>
            <div>
              <Label className="text-xs">Weaknesses (one per line)</Label>
              <Textarea value={weaknessesText} onChange={(e) => setWeaknessesText(e.target.value)} className="min-h-[100px]" maxLength={2000} placeholder="Discomfort with Networking&#10;Frustration with Constraints" />
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between">
          {onDelete ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm('Delete this personality profile?')) return;
                await onDelete();
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
