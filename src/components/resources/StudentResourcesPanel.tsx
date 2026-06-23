import { useState } from 'react';
import { Sparkles, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useResourceRecommendations,
  useGenerateRecommendations,
} from '@/hooks/useResourceRecommendations';
import { useCommunityResources } from '@/hooks/useCommunityResources';
import { ResourceCard } from './ResourceCard';

interface Props {
  studentId: string;
}

export function StudentResourcesPanel({ studentId }: Props) {
  const { data, isLoading } = useResourceRecommendations(studentId, { includeDismissed: true });
  const generate = useGenerateRecommendations();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Recommended Resources</h3>
          <p className="text-xs text-muted-foreground">
            AI-matched community resources, plus anything you've shared with this student manually.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              generate.mutate(
                { studentId, source: 'intake' },
                {
                  onSuccess: (r) =>
                    toast({
                      title: r?.degraded ? 'Generated (limited)' : 'Recommendations generated',
                      description: r?.message,
                    }),
                  onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                },
              )
            }
            disabled={generate.isPending}
          >
            {generate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Generate from intake
          </Button>
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full">
                <Plus className="h-3 w-3 mr-1" /> Share resource
              </Button>
            </DialogTrigger>
            <ManualSharePicker
              studentId={studentId}
              onDone={() => setPickerOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No recommendations yet. Use "Generate from intake" or share one manually.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((r) =>
            r.resource ? (
              <div key={r.id} className={r.dismissed_at ? 'opacity-60' : ''}>
                <ResourceCard
                  resource={r.resource}
                  reason={r.reason}
                  actions={
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.source}{r.dismissed_at ? ' · dismissed' : r.clicked_at ? ' · opened' : ''}
                    </span>
                  }
                />
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function ManualSharePicker({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const { data } = useCommunityResources({ search });
  const { toast } = useToast();

  async function share() {
    if (!selectedId) return;
    const { error } = await supabase.from('resource_recommendations').insert({
      student_id: studentId,
      resource_id: selectedId,
      source: 'manual',
      reason: reason.trim() || null,
    });
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Resource shared' });
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Share a resource with this student</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pantry, housing, legal aid…" />
        </div>
        <div className="space-y-1.5">
          <Label>Resource</Label>
          <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
            {(data || []).slice(0, 30).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left p-2 text-xs hover:bg-muted/50 ${selectedId === r.id ? 'bg-muted' : ''}`}
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-muted-foreground">{r.category}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this might help…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
          <Button onClick={share} disabled={!selectedId}>Share</Button>
        </div>
      </div>
    </DialogContent>
  );
}
