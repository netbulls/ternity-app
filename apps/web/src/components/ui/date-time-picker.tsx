import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** ISO date string (YYYY-MM-DD) */
type ISODate = string;
/** Time string (HH:MM) */
type TimeString = string;

export interface DateTimePickerProps {
  /** ISO "YYYY-MM-DD" date */
  date: ISODate;
  /** "HH:MM" start time */
  startTime: TimeString;
  /** "HH:MM" end time */
  endTime: TimeString;
  onDateChange: (date: ISODate) => void;
  onStartTimeChange: (time: TimeString) => void;
  onEndTimeChange: (time: TimeString) => void;
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

export function DateTimePicker({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = date ? isoToDate(date) : undefined;

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    onDateChange(dateToIso(d));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span>
            {date
              ? `${format(isoToDate(date), 'MMM d, yyyy')}  ${startTime} – ${endTime}`
              : 'Pick date & time'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto bg-background p-0" align="start">
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
        />
        <FieldGroup className="flex-row gap-3 px-3 pb-3">
          <Field className="gap-1">
            <FieldLabel htmlFor="dt-start">Start Time</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Clock2Icon className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="dt-start"
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
            </InputGroup>
          </Field>
          <Field className="gap-1">
            <FieldLabel htmlFor="dt-end">End Time</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Clock2Icon className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="dt-end"
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}
