import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAvailability,
  useBlackouts,
  useDeleteAvailability,
  useDeleteBlackout,
  useSaveAvailability,
  useSaveBlackout,
} from '@/hooks/useAvailability';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AvailabilityEditor() {
  const { user } = useAuth();
  const cmId = user?.id;

  const { data: slots = [], isLoading } = useAvailability(cmId);
  const { data: blackouts = [] } = useBlackouts(cmId);
  const saveSlot = useSaveAvailability();
  const delSlot = useDeleteAvailability();
  const saveBlackout = useSaveBlackout();
  const delBlackout = useDeleteBlackout();

  const [newDay, setNewDay] = useState('1');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newSlot, setNewSlot] = useState('30');

  const [boStart, setBoStart] = useState('');
  const [boEnd, setBoEnd] = useState('');
  const [boReason, setBoReason] = useState('');

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  if (!cmId) return null;

  const addSlot = async () => {
    await saveSlot.mutateAsync({
      case_manager_id: cmId,
      day_of_week: Number(newDay),
      start_time: newStart,
      end_time: newEnd,
      slot_minutes: Number(newSlot),
      timezone: tz,
      is_active: true,
    });
  };

  const addBlackout = async () => {
    if (!boStart || !boEnd) return;
    await saveBlackout.mutateAsync({
      case_manager_id: cmId,
      start_at: new Date(boStart).toISOString(),
      end_at: new Date(boEnd).toISOString(),
      reason: boReason || null,
    });
    setBoStart('');
    setBoEnd('');
    setBoReason('');
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="font-display">Weekly availability</CardTitle>
          <CardDescription>
            Recurring hours students can book from. Times are in your local timezone ({tz}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end">
            <div className="space-y-1">
              <Label className="text-xs">Day</Label>
              <Select value={newDay} onValueChange={setNewDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slot</Label>
              <Select value={newSlot} onValueChange={setNewSlot}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60].map((v) => (
                    <SelectItem key={v} value={v.toString()}>
                      {v} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addSlot} disabled={saveSlot.isPending} size="sm" className="rounded-full">
              {saveSlot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring availability set.</p>
            ) : (
              slots.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-full border border-border/50 px-4 py-2 text-sm">
                  <span className="font-medium w-24">{DAYS[s.day_of_week]}</span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.slot_minutes} min slots</span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(checked) =>
                          saveSlot.mutate({ ...s, is_active: checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => delSlot.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="font-display">Time off / blackouts</CardTitle>
          <CardDescription>Block specific date ranges so no one can book them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="datetime-local" value={boStart} onChange={(e) => setBoStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="datetime-local" value={boEnd} onChange={(e) => setBoEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea rows={1} value={boReason} onChange={(e) => setBoReason(e.target.value)} />
            </div>
            <Button onClick={addBlackout} disabled={saveBlackout.isPending} size="sm" className="rounded-full">
              {saveBlackout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {blackouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming blackouts.</p>
            ) : (
              blackouts.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-full border border-border/50 px-4 py-2 text-sm">
                  <span className="font-medium">
                    {format(new Date(b.start_at), 'PP p')} → {format(new Date(b.end_at), 'PP p')}
                  </span>
                  {b.reason && <span className="text-muted-foreground truncate">— {b.reason}</span>}
                  <Button size="icon" variant="ghost" className="ml-auto" onClick={() => delBlackout.mutate(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
