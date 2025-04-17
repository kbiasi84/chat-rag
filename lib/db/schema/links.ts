import { sql } from 'drizzle-orm';
import { text, varchar, timestamp, pgTable } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { nanoid } from '@/lib/utils';

export const links = pgTable('links', {
  id: varchar('id', { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  lastProcessed: timestamp('last_processed').notNull().default(sql`now()`),
  createdAt: timestamp('created_at').notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at').notNull().default(sql`now()`),
});

// Schema para links - usado para validar requisições de API
export const insertLinkSchema = createSelectSchema(links).extend({}).omit({
  id: true,
  lastProcessed: true,
  createdAt: true,
  updatedAt: true,
});

export const linkSchema = createSelectSchema(links);

// Tipo para links - usado para tipagem de parâmetros de requisição
export type NewLinkParams = z.infer<typeof insertLinkSchema>;
export type Link = z.infer<typeof linkSchema>;
