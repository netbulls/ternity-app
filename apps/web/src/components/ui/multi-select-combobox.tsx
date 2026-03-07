import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface MultiSelectOption {
  id: string;
  label: string;
  /** Optional color dot */
  color?: string | null;
  /** Optional secondary text (e.g. client name) */
  secondary?: string | null;
}

interface Props {
  /** Currently selected IDs */
  value: string[];
  onChange: (ids: string[]) => void;
  options: MultiSelectOption[];
  /** Placeholder when nothing selected */
  placeholder: string;
  /** Icon to show in the trigger */
  icon?: React.ElementType;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Popover width */
  width?: number;
}

export function MultiSelectCombobox({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results.',
  width = 260,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCount = value.length;

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const trimmed = search.trim().toLowerCase();
  const filtered = trimmed
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(trimmed) || o.secondary?.toLowerCase().includes(trimmed),
      )
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition-colors hover:bg-accent',
            selectedCount > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}
          style={{ fontSize: scaled(12) }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {selectedCount > 0 ? <span>{selectedCount} selected</span> : <span>{placeholder}</span>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden p-0" align="start" style={{ width }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList onWheel={(e: React.WheelEvent) => e.stopPropagation()}>
            {filtered.length === 0 && <CommandEmpty>{emptyMessage}</CommandEmpty>}
            {selectedCount > 0 && (
              <div className="flex justify-end px-2 pt-1">
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  style={{ fontSize: scaled(10) }}
                  onClick={() => onChange([])}
                >
                  Clear all
                </button>
              </div>
            )}
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem key={option.id} onSelect={() => toggle(option.id)}>
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-border flex-shrink-0',
                      value.includes(option.id) && 'bg-primary border-primary',
                    )}
                  >
                    {value.includes(option.id) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  {option.color && (
                    <span
                      className="mr-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                  {option.secondary && (
                    <span
                      className="ml-auto truncate text-muted-foreground"
                      style={{ fontSize: scaled(10) }}
                    >
                      {option.secondary}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
