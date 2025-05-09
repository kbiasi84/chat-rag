import { sql } from 'drizzle-orm';
import { text, varchar, timestamp, pgTable } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { nanoid } from '@/lib/utils';

// Tipo para categorizar a origem do conteúdo
export const SourceType = {
  TEXT: 'text',
  LINK: 'link',
  PDF: 'pdf',
} as const;

export const resources = pgTable('resources', {
  id: varchar('id', { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  content: text('content').notNull(),
  // Novo campo para identificar a origem do conteúdo
  sourceType: varchar('source_type', { length: 10 }).default(SourceType.TEXT),
  // Campo opcional para armazenar ID de referência (como ID do link)
  sourceId: varchar('source_id', { length: 191 }),

  createdAt: timestamp('created_at').notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
});

// Schema for resources - used to validate API requests
export const insertResourceSchema = createSelectSchema(resources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Modifica o schema para tornar sourceId realmente opcional
export const insertResourceSchemaWithOptionalSourceId =
  insertResourceSchema.partial({
    sourceId: true,
  });

// Type for resources - used to type API request params and within Components
export type NewResourceParams = z.infer<
  typeof insertResourceSchemaWithOptionalSourceId
>;
