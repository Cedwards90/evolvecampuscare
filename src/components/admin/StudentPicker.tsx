import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStudentFolders } from '@/hooks/useStudentFolders';

interface Props {
  value: string | undefined;
  onChange: (studentId: string, name: string) => void;
  placeholder?: string;
}

export function StudentPicker({ value, onChange, placeholder = 'Select a student…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: students = [], isLoading } = useStudentFolders();

  const selected = students.find((s) => s.user_id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? students.filter(
          (s) =>
            (s.full_name || '').toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            (s.organization_name || '').toLowerCase().includes(q),
        )
      : students;
    return list.slice(0, 100);
  }, [students, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? selected.full_name || selected.email : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, org…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No students found.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.user_id}
                type="button"
                onClick={() => {
                  onChange(s.user_id, s.full_name || s.email);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
              >
                <Check className={cn('h-4 w-4', value === s.user_id ? 'opacity-100' : 'opacity-0')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{s.full_name || s.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.email}
                    {s.organization_name ? ` · ${s.organization_name}` : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
