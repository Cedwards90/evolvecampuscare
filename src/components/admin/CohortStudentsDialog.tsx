import { useMemo, useState, useEffect } from 'react';
import { Loader2, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useOrgStudents, useBulkAssignCohort, type Cohort } from '@/hooks/useCohorts';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohort: Cohort | null;
}

export function CohortStudentsDialog({ open, onOpenChange, cohort }: Props) {
  const { data: students, isLoading } = useOrgStudents(cohort?.organization_id);
  const bulk = useBulkAssignCohort();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [selectedInCohort, setSelectedInCohort] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedAvailable(new Set());
      setSelectedInCohort(new Set());
    }
  }, [open, cohort?.id]);

  const { available, inCohort } = useMemo(() => {
    const list = students || [];
    const q = search.trim().toLowerCase();
    const match = (s: typeof list[number]) =>
      !q ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q);
    return {
      available: list.filter((s) => s.cohort_id !== cohort?.id && match(s)),
      inCohort: list.filter((s) => s.cohort_id === cohort?.id && match(s)),
    };
  }, [students, search, cohort?.id]);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  const handleAdd = async () => {
    if (!cohort) return;
    try {
      await bulk.mutateAsync({ studentIds: Array.from(selectedAvailable), cohortId: cohort.id });
      toast({ title: `Added ${selectedAvailable.size} student(s)` });
      setSelectedAvailable(new Set());
    } catch (e: any) {
      toast({ title: 'Failed to add', description: e?.message, variant: 'destructive' });
    }
  };

  const handleRemove = async () => {
    try {
      await bulk.mutateAsync({ studentIds: Array.from(selectedInCohort), cohortId: null });
      toast({ title: `Removed ${selectedInCohort.size} student(s)` });
      setSelectedInCohort(new Set());
    } catch (e: any) {
      toast({ title: 'Failed to remove', description: e?.message, variant: 'destructive' });
    }
  };

  const List = ({
    items,
    selected,
    onToggle,
    emptyText,
  }: {
    items: typeof available;
    selected: Set<string>;
    onToggle: (id: string) => void;
    emptyText: string;
  }) => (
    <ScrollArea className="h-72 rounded-md border">
      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((s) => (
            <li
              key={s.user_id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
              onClick={() => onToggle(s.user_id)}
            >
              <Checkbox checked={selected.has(s.user_id)} onCheckedChange={() => onToggle(s.user_id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.full_name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground truncate">{s.email}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage students — {cohort?.name}</DialogTitle>
          <DialogDescription>
            Add or remove students in this cohort. Students are never deleted; only their cohort assignment changes.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Available <Badge variant="secondary" className="ml-1">{available.length}</Badge></p>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={selectedAvailable.size === 0 || bulk.isPending}
                  className="rounded-full"
                >
                  {bulk.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Add <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <List
                items={available}
                selected={selectedAvailable}
                onToggle={(id) => toggle(selectedAvailable, setSelectedAvailable, id)}
                emptyText="No matching students in this organization."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">In this cohort <Badge variant="secondary" className="ml-1">{inCohort.length}</Badge></p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRemove}
                  disabled={selectedInCohort.size === 0 || bulk.isPending}
                  className="rounded-full"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" /> Remove
                </Button>
              </div>
              <List
                items={inCohort}
                selected={selectedInCohort}
                onToggle={(id) => toggle(selectedInCohort, setSelectedInCohort, id)}
                emptyText="No students assigned yet."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
