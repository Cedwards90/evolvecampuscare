import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveShift, useClockIn } from '@/hooks/useActiveShift';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Clock } from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'case_management', label: 'Case Management' },
  { value: 'direct_service', label: 'Direct Service' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
];

const SKIP_ROUTES = ['/auth', '/accept-nda', '/complete-profile', '/intake-survey'];
const SESSION_KEY = 'cm_clockin_prompted';
const skipKey = () => `cm_clockin_skip_${new Date().toISOString().slice(0, 10)}`;

export function ClockInPrompt() {
  const { user, role } = useAuth();
  const location = useLocation();
  const { data: activeShift, isLoading } = useActiveShift(user?.id);
  const clockIn = useClockIn();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [serviceType, setServiceType] = useState('case_management');
  const [notes, setNotes] = useState('');
  const [shownBanner, setShownBanner] = useState(false);

  const eligible = role === 'case_manager';
  const onSkippedRoute = SKIP_ROUTES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!user || !eligible || isLoading || onSkippedRoute) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    if (activeShift) {
      if (!shownBanner) {
        setShownBanner(true);
        sessionStorage.setItem(SESSION_KEY, '1');
        const started = new Date(activeShift.start_time).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
        toast({
          title: "You're still clocked in",
          description: `Shift started at ${started}.`,
          action: (
            <Link
              to="/time-tracking"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Manage
            </Link>
          ) as any,
        });
      }
      return;
    }

    if (localStorage.getItem(skipKey())) return;
    setOpen(true);
    sessionStorage.setItem(SESSION_KEY, '1');
  }, [user, eligible, isLoading, activeShift, onSkippedRoute, shownBanner, toast]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({
        service_type: serviceType,
        notes: notes.trim() || null,
      });
      toast({ title: 'Clocked in', description: 'Your shift is being tracked.' });
      setOpen(false);
      setNotes('');
    } catch (e: any) {
      toast({
        title: 'Could not clock in',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleSkipToday = () => {
    localStorage.setItem(skipKey(), '1');
    setOpen(false);
  };

  if (!eligible) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Start tracking your shift?</DialogTitle>
          <DialogDescription className="text-center">
            Clock in now so your time is captured in Time Reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="service-type">Service type</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger id="service-type" className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What are you working on?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleClockIn}
            disabled={clockIn.isPending}
            className="w-full rounded-full"
          >
            {clockIn.isPending ? 'Clocking in…' : 'Clock In'}
          </Button>
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full"
            >
              Not now
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkipToday}
              className="flex-1 rounded-full"
            >
              Don't ask today
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
