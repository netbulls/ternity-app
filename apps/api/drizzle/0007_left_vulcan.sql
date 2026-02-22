CREATE TYPE "public"."segment_type" AS ENUM('clocked', 'manual');--> statement-breakpoint
ALTER TYPE "public"."entry_audit_action" ADD VALUE 'adjustment_added';--> statement-breakpoint
CREATE TABLE "entry_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"type" "segment_type" NOT NULL,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"duration_seconds" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry_segments" ADD CONSTRAINT "entry_segments_entry_id_time_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_segments_entry_id_idx" ON "entry_segments" USING btree ("entry_id");--> statement-breakpoint
INSERT INTO "entry_segments" ("id", "entry_id", "type", "started_at", "stopped_at", "duration_seconds", "created_at")
SELECT gen_random_uuid(), "id", 'clocked', "started_at", "stopped_at", "duration_seconds", "created_at"
FROM "time_entries";--> statement-breakpoint
ALTER TABLE "time_entries" DROP COLUMN "started_at";--> statement-breakpoint
ALTER TABLE "time_entries" DROP COLUMN "stopped_at";--> statement-breakpoint
ALTER TABLE "time_entries" DROP COLUMN "duration_seconds";