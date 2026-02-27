CREATE TABLE IF NOT EXISTS "jira_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"atlassian_account_id" text NOT NULL,
	"atlassian_display_name" text NOT NULL,
	"atlassian_email" text,
	"atlassian_avatar_url" text,
	"cloud_id" text NOT NULL,
	"site_name" text NOT NULL,
	"site_url" text NOT NULL,
	"site_avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jira_connections_user_id_idx" ON "jira_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jira_connections_user_cloud_idx" ON "jira_connections" USING btree ("user_id","cloud_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "jira_connections" ADD CONSTRAINT "jira_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
