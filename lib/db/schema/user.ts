import type { InferSelectModel } from 'drizzle-orm';
import { pgTable, varchar, timestamp, uuid } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  nome: varchar('nome', { length: 255 }), // novo campo
  email: varchar('email', { length: 255 }).notNull().unique(),
  senha: varchar('senha', { length: 255 }), // alterado de "password" para "senha"
  whatsapp: varchar('whatsapp', { length: 20 }), // novo campo
  atividade: varchar('atividade', { length: 50 }), // novo campo
  perfil: varchar('perfil', { length: 20 }).notNull().default('usuario'), // novo campo para perfil
  resetToken: varchar('reset_token', { length: 255 }), // token de recuperação de senha
  resetTokenExpires: timestamp('reset_token_expires'), // expiração do token
  criadoEm: timestamp('criado_em').notNull().defaultNow(), // novo campo
  atualizadoEm: timestamp('atualizado_em').notNull().defaultNow(), // novo campo
});

export type User = InferSelectModel<typeof user>;
