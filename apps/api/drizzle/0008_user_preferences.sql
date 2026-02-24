ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}';--> statement-breakpoint
UPDATE "users" SET "preferences" = jsonb_build_object('theme', COALESCE("theme_preference", 'ternity-dark'));--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "theme_preference";