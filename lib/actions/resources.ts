'use server';

import {
  NewResourceParams,
  insertResourceSchemaWithOptionalSourceId,
  resources,
  SourceType,
} from '@/lib/db/schema/resources';
import { generateEmbeddings } from '../ai/embedding';
import { db } from '../db';
import { embeddings as embeddingsTable } from '../db/schema/embeddings';
import { sql } from 'drizzle-orm';

export const createResource = async (input: NewResourceParams) => {
  try {
    console.log('Iniciando criação do recurso...');
    //console.log('Input recebido:', JSON.stringify(input));

    try {
      // Usar o schema com sourceId opcional
      const parsed = insertResourceSchemaWithOptionalSourceId.parse(input);
      //console.log('Schema validado com sucesso:', JSON.stringify(parsed));

      const { content, sourceType = SourceType.TEXT, sourceId } = parsed;
      console.log(`Tamanho do conteúdo: ${content.length} caracteres`);
      console.log(
        `Origem do conteúdo: ${sourceType}, ID: ${sourceId || 'N/A'}`,
      );

      const [resource] = await db
        .insert(resources)
        .values({ content, sourceType, sourceId })
        .returning();
      console.log(`Recurso criado com ID: ${resource.id}`);

      console.log('Gerando embeddings para o conteúdo...');
      const embeddings = await generateEmbeddings(content);
      console.log(`Gerados ${embeddings.length} fragmentos de embeddings`);

      // Inserir embeddings em lotes para evitar exceder limites
      const batchSize = 100;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        console.log(
          `Inserindo lote de embeddings ${i + 1}-${i + batch.length} de ${embeddings.length}`,
        );

        await db.insert(embeddingsTable).values(
          batch.map((embedding) => ({
            resourceId: resource.id,
            ...embedding,
          })),
        );

        if (i + batchSize < embeddings.length) {
          console.log('Pausa entre lotes para evitar sobrecarga...');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      console.log('Todos os embeddings foram inseridos com sucesso');
      return 'Resource successfully created and embedded.';
    } catch (parseError) {
      console.error('Erro na validação do schema:', parseError);
      console.error('Detalhes da validação:', (parseError as Error).message);
      throw parseError;
    }
  } catch (error) {
    console.error('Erro ao criar recurso:', error);
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.';
  }
};

export const getAllResources = async () => {
  try {
    const allResources = await db
      .select()
      .from(resources)
      .orderBy(resources.createdAt);
    return allResources;
  } catch (error) {
    console.error('Error fetching resources:', error);
    return [];
  }
};

export const deleteResource = async (id: string) => {
  try {
    // Deleta os embeddings associados (a constraint ON DELETE CASCADE cuidará disso automaticamente)
    await db.execute(sql`DELETE FROM resources WHERE id = ${id}`);
    return 'Recurso excluído com sucesso.';
  } catch (error) {
    console.error('Error deleting resource:', error);
    return 'Erro ao excluir o recurso.';
  }
};

// Buscar recursos pelo tipo de origem
export const getResourcesBySourceType = async (sourceType: string) => {
  try {
    const filteredResources = await db
      .select()
      .from(resources)
      .where(sql`source_type = ${sourceType}`)
      .orderBy(resources.createdAt);
    return filteredResources;
  } catch (error) {
    console.error(`Error fetching resources of type ${sourceType}:`, error);
    return [];
  }
};

// Buscar recursos pelo ID de origem
export const getResourcesBySourceId = async (sourceId: string) => {
  try {
    const filteredResources = await db
      .select()
      .from(resources)
      .where(sql`source_id = ${sourceId}`)
      .orderBy(resources.createdAt);
    return filteredResources;
  } catch (error) {
    console.error(`Error fetching resources with sourceId ${sourceId}:`, error);
    return [];
  }
};

// Excluir recursos pelo ID de origem
export const deleteResourcesBySourceId = async (sourceId: string) => {
  try {
    await db.execute(sql`DELETE FROM resources WHERE source_id = ${sourceId}`);
    return 'Recursos associados excluídos com sucesso.';
  } catch (error) {
    console.error(`Error deleting resources with sourceId ${sourceId}:`, error);
    return 'Erro ao excluir recursos associados.';
  }
};
