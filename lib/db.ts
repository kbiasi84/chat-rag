import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/lib/db/schema';
import * as resources from '@/lib/db/schema/resources';
import * as links from '@/lib/db/schema/links';
import * as embeddings from '@/lib/db/schema/embeddings';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL não está definida nas variáveis de ambiente');
}

console.log('Conectando ao banco de dados:', process.env.POSTGRES_URL);
const client = postgres(process.env.POSTGRES_URL);

// Crie uma instância do drizzle com o cliente e o esquema
export const db = drizzle(client, {
  schema: {
    ...schema,
    ...resources,
    ...links,
    ...embeddings,
  },
});
