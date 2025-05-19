import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';
import { user } from './user';

// Planos disponíveis
export const PLANOS = {
  FREE: 'free',
  STARTER: 'starter',
  STANDARD: 'standard',
  ENTERPRISE: 'enterprise',
} as const;

// Quantidade de consultas por plano
export const LIMITES_CONSULTA = {
  [PLANOS.FREE]: 3,
  [PLANOS.STARTER]: 30,
  [PLANOS.STANDARD]: 60,
  [PLANOS.ENTERPRISE]: 100,
} as const;

// Preços em centavos
export const PRECOS_PLANOS = {
  [PLANOS.FREE]: 0,
  [PLANOS.STARTER]: 3900,
  [PLANOS.STANDARD]: 6900,
  [PLANOS.ENTERPRISE]: 9900,
} as const;

export const subscription = pgTable('subscription', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id),
  status: varchar('status', {
    enum: [
      'active',
      'canceled',
      'canceled_at_period_end',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid',
    ],
  })
    .notNull()
    .default('active'),
  plano: varchar('plano', {
    enum: ['free', 'starter', 'standard', 'enterprise'],
  })
    .notNull()
    .default(PLANOS.FREE),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  consultasUsadas: integer('consultas_usadas').notNull().default(0),
  criadoEm: timestamp('criado_em').notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em').notNull().defaultNow(),
  terminaEm: timestamp('termina_em'),
});

export type Subscription = InferSelectModel<typeof subscription>;
