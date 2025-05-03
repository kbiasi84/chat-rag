DROP TABLE "Document";--> statement-breakpoint
DROP TABLE "Suggestion";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reset_token" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reset_token_expires" timestamp;