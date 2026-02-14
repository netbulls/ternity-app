import { useState } from 'react';
import { Check, ChevronDown, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLabels } from '@/hooks/use-reference-data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
interface Props {
  value: string[];
  onChange: (labelIds: string[]) => void;
}

export function LabelSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: labels } = useLabels();

  const selectedLabels = labels?.filter((l) => value.includes(l.id)) ?? [];

  const toggle = (labelId: string) => {
    if (value.includes(labelId)) {
      onChange(value.filter((id) => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
            selectedLabels.length > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Tags className="h-3.5 w-3.5" />
          {selectedLabels.length > 0 ? (
            <span>{selectedLabels.length} label{selectedLabels.length > 1 ? 's' : ''}</span>
          ) : (
            <span>Labels</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search labels..." />
          <CommandList>
            <CommandEmpty>No labels found.</CommandEmpty>
            <CommandGroup>
              {labels?.map((label) => (
                <CommandItem
                  key={label.id}
                  onSelect={() => toggle(label.id)}
                >
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-border',
                      value.includes(label.id) && 'bg-primary border-primary',
                    )}
                  >
                    {value.includes(label.id) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  {label.color && (
                    <span
                      className="mr-1.5 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                  )}
                  <span className="truncate">{label.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
