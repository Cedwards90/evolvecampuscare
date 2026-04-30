import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ReportPreset } from '@/hooks/useInteractionReport';
import { getPresetRange } from '@/hooks/useInteractionReport';

interface Props {
  preset: ReportPreset;
  from: Date;
  to: Date;
  onChange: (next: { preset: ReportPreset; from: Date; to: Date }) => void;
}

const PRESETS: { key: Exclude<ReportPreset, 'custom'>; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export function ReportRangePicker({ preset, from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const setPreset = (p: Exclude<ReportPreset, 'custom'>) => {
    const range = getPresetRange(p);
    onChange({ preset: p, ...range });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.key}
          type="button"
          size="sm"
          variant={preset === p.key ? 'default' : 'outline'}
          onClick={() => setPreset(p.key)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={preset === 'custom' ? 'default' : 'outline'}
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {preset === 'custom'
              ? `${format(from, 'PP')} – ${format(to, 'PP')}`
              : 'Custom range'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from, to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange({ preset: 'custom', from: range.from, to: range.to });
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
