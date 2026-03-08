import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** ISO date string (YYYY-MM-DD) */
type ISODate = string;

export interface DateRangePickerProps {
  /** ISO "YYYY-MM-DD" start date */
  from: ISODate;
  /** ISO "YYYY-MM-DD" end date */
  to: ISODate;
  /** Called when either end of the range changes — always ISO strings */
  onChange: (from: ISODate, to: ISODate) => void;
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

export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const fromDate = isoToDate(from);
  const toDate = isoToDate(to);

  const selected: DateRange = { from: fromDate, to: toDate };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) return;
    const newFrom = range.from ? dateToIso(range.from) : from;
    const newTo = range.to ? dateToIso(range.to) : newFrom;
    onChange(newFrom, newTo);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !from && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span>
            {format(fromDate, 'MMM d, yyyy')} – {format(toDate, 'MMM d, yyyy')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={fromDate}
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
          weekStartsOn={1}
          showWeekNumber
          showOutsideDays={false}
          captionLayout="dropdown"
          startMonth={new Date(2020, 0)}
          endMonth={new Date(2030, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
