ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_resource_id_resources_id_fk";
--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "source_type" SET DEFAULT 'text';--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "source_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "source_id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "url" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "links" ALTER COLUMN "title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "resource_id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "resource_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embeddingIndex" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);