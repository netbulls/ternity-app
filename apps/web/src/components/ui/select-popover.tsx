import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { scaled } from '@/lib/scaled';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface SelectPopoverItem {
  value: string;
  label: string;
  color?: string;
  /** Optional group label — items with the same group are rendered under a shared header */
  group?: string;
}

interface SelectPopoverProps {
  /** Currently selected value (empty string = nothing selected) */
  value: string;
  /** Called when a value is selected */
  onChange: (value: string) => void;
  /** List of selectable items */
  items: SelectPopoverItem[];
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Show search input (recommended when items > 8) */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Compact variant for inline table cells */
  compact?: boolean;
  /** Trigger and popover stretch to fill parent width */
  fullWidth?: boolean;
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Popover width (defaults to 220, ignored when fullWidth) */
  width?: number;
  /**
   * Action-trigger mode: resets value to '' after selection.
   * Useful for bulk actions like "Assign group..." where the select
   * acts as a trigger rather than showing a persistent value.
   */
  actionTrigger?: boolean;
}

export function SelectPopover({
  value,
  onChange,
  items,
  placeholder = 'Select...',
  searchable = false,
  searchPlaceholder = 'Search...',
  disabled = false,
  compact = false,
  fullWidth = false,
  align = 'start',
  width = 220,
  actionTrigger = false,
}: SelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = items.find((i) => i.value === value) ?? null;

  const filtered = search
    ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  useEffect(() => {
    if (open && searchable) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setSearch('');
  }, [open, searchable]);

  const fontSize = compact ? scaled(11) : scaled(12);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border transition-colors',
            compact ? 'px-2 py-1' : 'px-3 py-1.5',
            fullWidth && 'w-full',
            disabled ? 'cursor-not-allowed opacity-30' : 'hover:border-primary/50',
            selected && !actionTrigger ? 'text-foreground' : 'text-muted-foreground',
          )}
          style={{ fontSize }}
        >
          {selected && !actionTrigger ? (
            <>
              {selected.color && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
              )}
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('overflow-hidden p-0', fullWidth && 'w-[var(--radix-popover-trigger-width)]')}
        style={fullWidth ? undefined : { width }}
        align={align}
        sideOffset={6}
      >
        {/* Search */}
        {searchable && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <motion.input
                ref={searchRef}
                className="h-8 w-full rounded-md bg-muted/40 pl-8 pr-3 text-foreground outline-none"
                style={{ border: '1px solid hsl(var(--border))', fontSize: scaled(12) }}
                whileFocus={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
                transition={{ duration: 0.2 }}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="max-h-[260px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <div
              className="px-3 py-4 text-center text-muted-foreground"
              style={{ fontSize: scaled(11) }}
            >
              No results
            </div>
          ) : (
            filtered.map((item, i) => {
              const isSelected = value === item.value;
              const prevGroup = i > 0 ? filtered[i - 1]?.group : undefined;
              const showGroupHeader = item.group && item.group !== prevGroup;
              return (
                <div key={item.value}>
                  {showGroupHeader && (
                    <div
                      className={cn(
                        'px-2.5 pb-1 pt-2 text-muted-foreground',
                        i > 0 && 'mt-1 border-t border-border',
                      )}
                      style={{
                        fontSize: scaled(9),
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.group}
                    </div>
                  )}
                  <motion.button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
                      isSelected
                        ? 'bg-primary/8 text-foreground'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground',
                    )}
                    style={{ fontSize: scaled(12) }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.15 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    {item.color && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </motion.button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
