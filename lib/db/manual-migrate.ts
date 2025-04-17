import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db';

// Carregar variáveis de ambiente
config({
  path: '.env.local',
});

async function manualMigration() {
  try {
    console.log('⏳ Executando migração manual...');

    // Lê o arquivo SQL
    const sqlFilePath = path.join(
      process.cwd(),
      'lib',
      'db',
      'migrations',
      'manual_vector.sql',
    );
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Divide o conteúdo em declarações SQL individuais
    const statements = sqlContent
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    // Executa cada declaração
    for (const statement of statements) {
      try {
        console.log(`Executando: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(`${statement};`));
      } catch (error) {
        console.error(`Erro ao executar: ${statement}`);
        console.error(error);
        // Continua executando as próximas declarações
      }
    }

    console.log('✅ Migração manual concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante a migração manual:', error);
  } finally {
    process.exit(0);
  }
}

manualMigration();
