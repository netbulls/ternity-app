CREATE TYPE "public"."sync_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_source" AS ENUM('toggl', 'timetastic');--> statement-breakpoint
ALTER TYPE "public"."leave_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "stg_toggl_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_toggl_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_toggl_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_toggl_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_toggl_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_tt_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_tt_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_tt_leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "stg_tt_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sync_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "sync_source" NOT NULL,
	"entity" text NOT NULL,
	"external_id" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "sync_source" NOT NULL,
	"entity" text NOT NULL,
	"status" "sync_run_status" DEFAULT 'running' NOT NULL,
	"record_count" integer,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "deducted" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "toggl_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timetastic_id" text;--> statement-breakpoint
ALTER TABLE "stg_toggl_clients" ADD CONSTRAINT "stg_toggl_clients_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_toggl_projects" ADD CONSTRAINT "stg_toggl_projects_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_toggl_tags" ADD CONSTRAINT "stg_toggl_tags_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_toggl_time_entries" ADD CONSTRAINT "stg_toggl_time_entries_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_toggl_users" ADD CONSTRAINT "stg_toggl_users_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_tt_absences" ADD CONSTRAINT "stg_tt_absences_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_tt_departments" ADD CONSTRAINT "stg_tt_departments_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_tt_leave_types" ADD CONSTRAINT "stg_tt_leave_types_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_tt_users" ADD CONSTRAINT "stg_tt_users_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_mappings_source_entity_ext_idx" ON "sync_mappings" USING btree ("source","entity","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_toggl_id_idx" ON "users" USING btree ("toggl_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_timetastic_id_idx" ON "users" USING btree ("timetastic_id");