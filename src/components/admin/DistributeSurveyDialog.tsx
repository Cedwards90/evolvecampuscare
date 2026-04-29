import { useState, useMemo } from 'react';
import { Send, Loader2, CalendarClock, Users, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useTrainingOrganizations } from '@/hooks/useTrainingOrganizations';
import { useDistributeSurvey } from '@/hooks/useSurveyDistribution';
import { toast } from 'sonner';

interface StudentRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  cohort_start_date: string | null;
  organization_id: string | null;
}

export function DistributeSurveyDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [surveyType, setSurveyType] = useState<'checkin' | 'post_graduation_plan' | ''>('');
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [requireEmail, setRequireEmail] = useState(true);
  const [excludePending, setExcludePending] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const { data: organizations } = useTrainingOrganizations();
  const distribute = useDistributeSurvey();

  const { data: students } = useQuery({
    queryKey: ['distribute-survey-students'],
    enabled: open,
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      const ids = (roleRows ?? []).map(r => r.user_id);
      if (ids.length === 0) return [] as StudentRow[];
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, cohort_start_date, organization_id')
        .in('user_id', ids);
      return (profs ?? []) as StudentRow[];
    },
  });

  const { data: pendingByType } = useQuery({
    queryKey: ['pending-by-type', surveyType],
    enabled: open && !!surveyType,
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_invitations')
        .select('student_id')
        .eq('survey_type', surveyType)
        .is('completed_at', null);
      return new Set((data ?? []).map(r => r.student_id));
    },
  });

  const cohorts = useMemo(() => {
    const set = new Set<string>();
    (students ?? []).forEach(s => s.cohort_start_date && set.add(s.cohort_start_date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [students]);

  const filtered = useMemo(() => {
    return (students ?? []).filter(s => {
      if (search && !(`${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))) return false;
      if (cohortFilter !== 'all' && s.cohort_start_date !== cohortFilter) return false;
      if (orgFilter !== 'all' && s.organization_id !== orgFilter) return false;
      if (requireEmail && !s.email) return false;
      if (excludePending && pendingByType?.has(s.user_id)) return false;
      return true;
    });
  }, [students, search, cohortFilter, orgFilter, requireEmail, excludePending, pendingByType]);

  const toggleAll = () => {
    if (filtered.every(s => selected.has(s.user_id))) {
      const next = new Set(selected);
      filtered.forEach(s => next.delete(s.user_id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(s => next.add(s.user_id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const reset = () => {
    setSurveyType('');
    setSearch('');
    setCohortFilter('all');
    setOrgFilter('all');
    setRequireEmail(true);
    setExcludePending(true);
    setSelected(new Set());
    setScheduleMode('now');
    setScheduleDate('');
    setScheduleTime('09:00');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!surveyType) return toast.error('Pick a survey type.');
    if (selected.size === 0) return toast.error('Select at least one recipient.');

    let scheduledFor: string | undefined;
    if (scheduleMode === 'later') {
      if (!scheduleDate || !scheduleTime) return toast.error('Pick a date and time.');
      const dt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
        return toast.error('Schedule time must be in the future.');
      }
      scheduledFor = dt.toISOString();
    }

    try {
      const res = await distribute.mutateAsync({
        surveyType,
        recipientIds: Array.from(selected),
        notes: notes.trim() || undefined,
        scheduledFor,
      });

      if (res.scheduled) {
        toast.success(`Scheduled for ${format(new Date(res.scheduledFor!), 'PPp')}.`);
      } else {
        const parts = [`${res.sent ?? 0} sent`];
        if (res.failed) parts.push(`${res.failed} failed`);
        if (res.skipped) parts.push(`${res.skipped} skipped`);
        toast.success(parts.join(' · '));
      }
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to distribute survey.');
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Send className="h-4 w-4 mr-2" />
            Distribute Survey
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribute Survey</DialogTitle>
          <DialogDescription>
            Send a survey to selected students now or schedule it for later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <Select value={surveyType} onValueChange={(v: any) => setSurveyType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a survey…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkin">3-Week Check-In</SelectItem>
                <SelectItem value="post_graduation_plan">12-Month Post-Graduation Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {surveyType && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search students…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={cohortFilter} onValueChange={setCohortFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cohorts</SelectItem>
                    {cohorts.map(d => (
                      <SelectItem key={d} value={d}>
                        {format(new Date(d), 'MMMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {organizations && organizations.length > 0 && (
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {organizations.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={requireEmail} onCheckedChange={v => setRequireEmail(!!v)} />
                  Has email
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={excludePending} onCheckedChange={v => setExcludePending(!!v)} />
                  Exclude already pending
                </label>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between p-2 border-b bg-muted/30">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every(s => selected.has(s.user_id))}
                      onCheckedChange={toggleAll}
                    />
                    Select all visible ({filtered.length})
                  </label>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {selected.size} selected
                  </Badge>
                </div>
                <ScrollArea className="h-56">
                  <div className="divide-y">
                    {filtered.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No students match the filters.
                      </div>
                    ) : (
                      filtered.map(s => (
                        <label
                          key={s.user_id}
                          className="flex items-center gap-3 p-2 hover:bg-muted/30 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(s.user_id)}
                            onCheckedChange={() => toggleOne(s.user_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.email || 'No email'}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Schedule</Label>
                <RadioGroup value={scheduleMode} onValueChange={(v: any) => setScheduleMode(v)}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="now" /> Send now
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="later" /> Schedule for later
                  </label>
                </RadioGroup>
                {scheduleMode === 'later' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      type="date"
                      min={minDate}
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add context for the recipients…"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={distribute.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={distribute.isPending || !surveyType || selected.size === 0}
          >
            {distribute.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {scheduleMode === 'later' ? <CalendarClock className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {scheduleMode === 'later' ? `Schedule (${selected.size})` : `Send Now (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
