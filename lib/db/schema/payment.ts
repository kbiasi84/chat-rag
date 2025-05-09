import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './user';
import { subscription } from './subscription';

// Registra o histórico de pagamentos
export const payment = pgTable('payment', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscription.id),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  invoiceUrl: varchar('invoice_url', { length: 500 }),
  valor: integer('valor').notNull(), // em centavos
  status: varchar('status', {
    enum: ['paid', 'pending', 'failed'],
  }).notNull(),
  dataPagamento: timestamp('data_pagamento'),
  criadoEm: timestamp('criado_em').notNull().defaultNow(),
});

export type Payment = InferSelectModel<typeof payment>;
