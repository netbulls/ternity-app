import { z } from 'zod';

export const WorkingDayKeySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export type WorkingDayKey = z.infer<typeof WorkingDayKeySchema>;

const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours! * 60 + minutes!;
}

export const WorkingDayScheduleSchema = z
  .object({
    enabled: z.boolean(),
    start: TimeStringSchema,
    end: TimeStringSchema,
  })
  .superRefine((value, ctx) => {
    if (toMinutes(value.start) >= toMinutes(value.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start must be earlier than end',
        path: ['start'],
      });
    }
  });

export type WorkingDaySchedule = z.infer<typeof WorkingDayScheduleSchema>;

export const WeeklyWorkingHoursSchema = z.object({
  mon: WorkingDayScheduleSchema,
  tue: WorkingDayScheduleSchema,
  wed: WorkingDayScheduleSchema,
  thu: WorkingDayScheduleSchema,
  fri: WorkingDayScheduleSchema,
  sat: WorkingDayScheduleSchema,
  sun: WorkingDayScheduleSchema,
});

export type WeeklyWorkingHours = z.infer<typeof WeeklyWorkingHoursSchema>;

export const DEFAULT_WEEKLY_WORKING_HOURS: WeeklyWorkingHours = {
  mon: { enabled: true, start: '08:30', end: '16:30' },
  tue: { enabled: true, start: '08:30', end: '16:30' },
  wed: { enabled: true, start: '08:30', end: '16:30' },
  thu: { enabled: true, start: '08:30', end: '16:30' },
  fri: { enabled: true, start: '08:30', end: '16:30' },
  sat: { enabled: false, start: '08:30', end: '16:30' },
  sun: { enabled: false, start: '08:30', end: '16:30' },
};
