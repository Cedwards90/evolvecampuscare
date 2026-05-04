import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function FilterMultiSelect({ label, icon, options, selected, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'rounded-full h-9 gap-2 border-border',
            selected.length > 0 && 'border-primary bg-primary/5 text-primary'
          )}
        >
          {icon}
          <span>{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="rounded-full h-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder || `Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <CommandItem key={opt.value} onSelect={() => toggle(opt.value)} className="cursor-pointer">
                    <div className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange([])}>
                  Clear selection
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
