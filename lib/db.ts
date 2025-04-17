import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/lib/db/schema';
import * as resources from '@/lib/db/schema/resources';
import * as links from '@/lib/db/schema/links';
import * as embeddings from '@/lib/db/schema/embeddings';

// Forçando as credenciais para garantir a conexão
const connectionString =
  'postgresql://postgres:postgres@localhost:5432/chat_rag';
console.log('Conectando ao banco de dados:', connectionString);
const client = postgres(connectionString);

// Crie uma instância do drizzle com o cliente e o esquema
export const db = drizzle(client, {
  schema: {
    ...schema,
    ...resources,
    ...links,
    ...embeddings,
  },
});
