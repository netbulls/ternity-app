CREATE TYPE "public"."entry_audit_action" AS ENUM('created', 'updated', 'deleted', 'timer_started', 'timer_stopped', 'timer_resumed');--> statement-breakpoint
CREATE TABLE "entry_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "entry_audit_action" NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry_audit_log" ADD CONSTRAINT "entry_audit_log_entry_id_time_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_audit_log" ADD CONSTRAINT "entry_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_audit_log" ADD CONSTRAINT "entry_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_audit_log_entry_id_idx" ON "entry_audit_log" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "entry_audit_log_actor_id_created_at_idx" ON "entry_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "entry_audit_log_created_at_idx" ON "entry_audit_log" USING btree ("created_at");