import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** ISO date string (YYYY-MM-DD) */
type ISODate = string;

export interface DatePickerProps {
  /** ISO "YYYY-MM-DD" value, or empty string if not set */
  value: ISODate;
  /** Called with ISO string when a date is selected */
  onChange: (value: ISODate) => void;
  /** Placeholder when no date is selected */
  placeholder?: string;
  /** Minimum selectable date (ISO string) */
  min?: ISODate;
  /** Maximum selectable date (ISO string) */
  max?: ISODate;
  className?: string;
}

/** Parse "YYYY-MM-DD" to a local Date (noon to avoid DST edge cases) */
function isoToDate(iso: string): Date {
  const parts = iso.split('-').map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!, 12);
}

/** Format a Date to "YYYY-MM-DD" */
function dateToIso(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  min,
  max,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = value ? isoToDate(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(dateToIso(date));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span>{value ? format(isoToDate(value), 'MMM d, yyyy') : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          defaultMonth={selected ?? new Date()}
          selected={selected}
          onSelect={handleSelect}
          weekStartsOn={1}
          showWeekNumber
          showOutsideDays={false}
          captionLayout="dropdown"
          startMonth={new Date(2020, 0)}
          endMonth={new Date(2030, 11)}
          disabled={[
            ...(min ? [{ before: isoToDate(min) }] : []),
            ...(max ? [{ after: isoToDate(max) }] : []),
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}
