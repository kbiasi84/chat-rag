'use server';

import { nanoid } from '@/lib/utils';
import { SourceType, resources } from '@/lib/db/schema/resources';
import { generateEmbeddings } from '@/lib/ai/embedding';
import { embeddings as embeddingsTable } from '@/lib/db/schema/embeddings';
import { db } from '@/lib/db';

export const saveCuratedChunks = async (input: {
  chunks: string[];
  lei: string;
  contexto: string;
  url: string;
}) => {
  try {
    const { chunks, lei, contexto, url } = input;

    if (!chunks || chunks.length === 0) {
      throw new Error('Nenhum chunk fornecido para salvar');
    }

    // Gerar um ID único para esta sessão de curadoria
    const curadorSessionId = `curador-${nanoid()}`;
    const savedChunks = [];

    for (const [index, chunk] of chunks.entries()) {
      if (!chunk.trim()) {
        continue; // Pula chunks vazios
      }

      // Construir o conteúdo final do chunk com metadados
      let finalContent = '';

      // Adicionar título baseado no índice
      finalContent += `# Chunk Curado ${index + 1} - ${lei || 'Legislação'}\n\n`;

      // Adicionar lei se fornecida
      if (lei.trim()) {
        finalContent += `**Lei:** ${lei.trim()}\n\n`;
      }

      // Adicionar contexto se fornecido
      if (contexto.trim()) {
        finalContent += `**Contexto:** ${contexto.trim()}\n\n`;
      }

      // Adicionar URL de origem
      if (url.trim()) {
        finalContent += `**Fonte:** ${url.trim()}\n\n`;
      }

      // Adicionar o conteúdo do chunk
      finalContent += chunk.trim();

      // Adicionar marcadores de curadoria manual
      finalContent += '\n\n**Tipo:** Curado Manualmente';
      finalContent += `\n**Sessão:** ${curadorSessionId}`;

      // Salvar o chunk como resource
      const chunkId = `${curadorSessionId}-chunk-${index + 1}`;
      
      const [savedResource] = await db
        .insert(resources)
        .values({
          id: nanoid(),
          content: finalContent,
          sourceType: SourceType.TEXT,
          sourceId: chunkId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Gerar embeddings para o chunk
      try {
        const embeddings = await generateEmbeddings(finalContent);
        
        if (embeddings && embeddings.length > 0) {
          const embeddingRecord = {
            resourceId: savedResource.id,
            ...embeddings[0],
          };
          
          await db.insert(embeddingsTable).values(embeddingRecord);
          console.log(`✅ Embedding criado para chunk ${index + 1} (Resource ID: ${savedResource.id})`);
        }
      } catch (embeddingError) {
        console.error(`❌ Erro ao gerar embedding para chunk ${index + 1}:`, embeddingError);
        // Continua mesmo se o embedding falhar
      }

      savedChunks.push({
        id: savedResource.id,
        chunkId,
        content: finalContent,
        tokens: finalContent.length, // Aproximação simples
      });

      console.log(`✅ Chunk ${index + 1} salvo com ID: ${savedResource.id}`);
    }

    return {
      success: true,
      message: `${savedChunks.length} chunks curados salvos com sucesso!`,
      sessionId: curadorSessionId,
      savedChunks,
    };
  } catch (error) {
    console.error('Erro ao salvar chunks curados:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido ao salvar chunks',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};

export const saveCuratedResource = async (input: {
  chunks: string[];
  lei: string;
  contexto: string;
  fullContent: string;
}) => {
  try {
    const { chunks, lei, contexto, fullContent } = input;

    if (!chunks || chunks.length === 0) {
      throw new Error('Nenhum chunk fornecido para salvar');
    }

    // Gerar um ID único para o recurso curado
    const curadorId = `curador-${nanoid()}`;
    
    // Salvar o recurso completo (fonte única)
    const [savedResource] = await db
      .insert(resources)
      .values({
        id: nanoid(),
        content: fullContent,
        sourceType: SourceType.TEXT,
        sourceId: curadorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Gerar embeddings para cada chunk individual
    const embeddingPromises = chunks.map(async (chunk, index) => {
      if (!chunk.trim()) {
        return null; // Pula chunks vazios
      }

      try {
        // Construir o conteúdo do embedding (mantendo estrutura formatada)
        let embeddingContent = '';
        
        if (lei.trim()) {
          embeddingContent += `**Lei:** ${lei.trim()}\n\n`;
        }
        
        if (contexto.trim()) {
          embeddingContent += `**Contexto:** ${contexto.trim()}\n\n`;
        }
        
        // Manter a estrutura e formatação do chunk
        embeddingContent += chunk.trim();

        // Gerar embedding para este chunk
        const embeddings = await generateEmbeddings(embeddingContent);
        
        if (embeddings && embeddings.length > 0) {
          const embeddingRecord = {
            resourceId: savedResource.id, // Todos apontam para o mesmo recurso
            content: embeddingContent, // Salvar o conteúdo estruturado na coluna content
            embedding: embeddings[0].embedding,
          };
          
          await db.insert(embeddingsTable).values(embeddingRecord);
          console.log(`✅ Embedding criado para chunk ${index + 1} (Resource ID: ${savedResource.id})`);
          return { success: true, chunkIndex: index + 1 };
        }
        
        return null;
      } catch (embeddingError) {
        console.error(`❌ Erro ao gerar embedding para chunk ${index + 1}:`, embeddingError);
        return { success: false, chunkIndex: index + 1, error: embeddingError };
      }
    });

    // Aguardar todos os embeddings serem processados
    const embeddingResults = await Promise.allSettled(embeddingPromises);
    const successfulEmbeddings = embeddingResults.filter(
      (result) => result.status === 'fulfilled' && result.value?.success
    ).length;

    console.log(`✅ Recurso curado salvo com ID: ${savedResource.id}`);
    console.log(`✅ ${successfulEmbeddings} embeddings criados de ${chunks.length} chunks`);

    return {
      success: true,
      message: `Recurso curado salvo com ${chunks.length} chunks e ${successfulEmbeddings} embeddings criados!`,
      resourceId: savedResource.id,
      chunksProcessed: chunks.length,
      embeddingsCreated: successfulEmbeddings,
    };
  } catch (error) {
    console.error('Erro ao salvar recurso curado:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido ao salvar recurso curado',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}; 