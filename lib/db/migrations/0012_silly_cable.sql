ALTER TABLE "embeddings" ADD COLUMN "content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "chunk_text";--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "chunk_index";