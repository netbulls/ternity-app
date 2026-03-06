-- Change hours from integer to real (supports 0.5 increments)
ALTER TABLE "leave_requests" ALTER COLUMN "hours" TYPE real USING "hours"::real;

-- Add start_hour column (HH:MM format, e.g. "09:00", "09:30")
ALTER TABLE "leave_requests" ADD COLUMN "start_hour" text;
