import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings';
import { db } from '../db';

const embeddingModel = openai.embedding('text-embedding-ada-002');

// Token limite aproximado para cada pedaço (chunk)
const MAX_CHUNK_SIZE = 1000;

// Função melhorada para dividir texto em pedaços menores
const generateChunks = (input: string): string[] => {
  // Limpar o texto
  const cleanText = input.trim().replace(/\s+/g, ' ');

  // Primeiro dividir por quebras naturais (parágrafos, artigos, etc.)
  const paragraphs = cleanText
    .split(/\n+|\r\n+|(?:Art\.\s\d+\.)/g)
    .filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // Se o parágrafo sozinho já é maior que o limite, dividir por sentenças
    if (paragraph.length > MAX_CHUNK_SIZE) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/g);

      for (const sentence of sentences) {
        if (sentence.trim().length === 0) continue;

        if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }

          // Se uma única sentença for maior que o limite, dividi-la
          if (sentence.length > MAX_CHUNK_SIZE) {
            const words = sentence.split(' ');
            for (const word of words) {
              if (currentChunk.length + word.length + 1 > MAX_CHUNK_SIZE) {
                chunks.push(currentChunk.trim());
                currentChunk = word;
              } else {
                currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
              }
            }
          } else {
            currentChunk = sentence;
          }
        } else {
          currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
        }
      }
    } else if (currentChunk.length + paragraph.length + 1 > MAX_CHUNK_SIZE) {
      // Se adicionar este parágrafo exceder o limite, iniciar um novo chunk
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      // Adicionar o parágrafo ao chunk atual
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + paragraph;
    }
  }

  // Adicionar o último chunk se houver algo
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Garantir que nenhum chunk esteja vazio
  return chunks.filter((chunk) => chunk.length > 0);
};

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);

  // Processando chunks em lotes para evitar exceder limites
  const results: Array<{ embedding: number[]; content: string }> = [];

  // Processamento em lotes de 20 chunks por vez
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    try {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: batch,
      });

      for (let j = 0; j < batch.length; j++) {
        results.push({
          content: batch[j],
          embedding: embeddings[j],
        });
      }

      // Pequena pausa para não sobrecarregar a API
      if (i + 20 < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Erro ao processar lote de chunks ${i}-${i + 20}:`, error);
      // Continua para o próximo lote mesmo se houver erro
    }
  }

  return results;
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\n', ' ');
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (userQuery: string) => {
  try {
    console.log(`Buscando conteúdo relevante para: "${userQuery}"`);

    // Normalizar a consulta do usuário
    const normalizedQuery = userQuery.toLowerCase().trim();
    console.log(`Consulta normalizada: "${normalizedQuery}"`);

    // Gerar embedding para a consulta
    const userQueryEmbedded = await generateEmbedding(normalizedQuery);
    console.log(`Embedding gerado para a consulta`);

    // Calcular similaridade usando distância de cosseno
    const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;

    // Threshold de similaridade reduzido para capturar mais resultados potencialmente relevantes
    const similarityThreshold = 0.2;

    // Buscar fragmentos relevantes
    const similarContent = await db
      .select({
        content: embeddings.content,
        similarity,
        resourceId: embeddings.resourceId,
      })
      .from(embeddings)
      .where(gt(similarity, similarityThreshold))
      .orderBy((t) => desc(t.similarity))
      .limit(8); // Aumentando o limite para obter mais contexto

    console.log(`Encontrados ${similarContent.length} fragmentos relevantes`);
    similarContent.forEach((item, index) => {
      console.log(
        `Fragmento #${index + 1} - Similaridade: ${item.similarity.toFixed(4)}`,
      );
    });

    return similarContent;
  } catch (error) {
    console.error('Erro ao buscar conteúdo relevante:', error);
    return [];
  }
};
