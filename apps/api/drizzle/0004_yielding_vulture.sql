CREATE TYPE "public"."sync_schedule_trigger" AS ENUM('frequent', 'daily', 'manual');--> statement-breakpoint
CREATE TABLE "sync_schedule_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_frequent_run_at" timestamp with time zone,
	"last_daily_run_at" timestamp with time zone,
	"next_frequent_run_at" timestamp with time zone,
	"next_daily_run_at" timestamp with time zone,
	"scheduler_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduler_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "schedule_trigger" "sync_schedule_trigger" DEFAULT 'manual' NOT NULL;