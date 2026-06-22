import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Square, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveShift, useClockOut } from '@/hooks/useActiveShift';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function useElapsed(startIso: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startIso]);
  if (!startIso) return '';
  const ms = Math.max(0, now - new Date(startIso).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ShiftHeaderWidget() {
  const { user, role } = useAuth();
  const { data: activeShift } = useActiveShift(user?.id);
  const clockOut = useClockOut();
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);

  const elapsed = useElapsed(activeShift?.start_time);

  if (role !== 'case_manager' || !activeShift) return null;

  const handleClockOut = async () => {
    try {
      await clockOut.mutateAsync({ notes: notes.trim() || null, billable: true });
      toast({
        title: 'Clocked out',
        description: 'Entry submitted to Time Reports.',
      });
      setNotes('');
      setOpen(false);
    } catch (e: any) {
      toast({
        title: 'Could not clock out',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex gap-2 rounded-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <Clock className="h-4 w-4" />
          <span className="font-mono tabular-nums text-xs">{elapsed}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Shift in progress</p>
            <p className="text-xs text-muted-foreground capitalize">
              {activeShift.service_type.replace('_', ' ')} · {elapsed}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clockout-notes" className="text-xs">
              Notes (optional)
            </Label>
            <Textarea
              id="clockout-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleClockOut}
              disabled={clockOut.isPending}
              className="w-full rounded-full"
            >
              {clockOut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Clock out
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full rounded-full"
              onClick={() => setOpen(false)}
            >
              <Link to="/time-tracking">Open Time Tracking</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
