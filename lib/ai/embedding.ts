import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings';
import { db } from '../db';
import { filterLowQualityContent } from './utils/content-quality';
import { countTokens } from './utils/token-counter';
import { SourceType } from '../db/schema/resources';

// Atualizar para modelo mais recente de embeddings
const embeddingModel = openai.embedding('text-embedding-3-small');

// Configurações para chunking baseado em tokens
const MAX_TOKEN_SIZE = 800;
const MIN_TOKEN_SIZE = 350;

// Expressões regulares para identificar elementos de legislação
const ARTICLE_PATTERNS = [
  /Art(?:igo)?\s*\.?\s*(\d+)(?:\s*º|\s*o)?(?:\s*\.|\s*\-|\s*–|$)/i,
  /Art(?:igo)?\s*\.?\s*([IVXLCDM]+)(?:\s*º|\s*o)?(?:\s*\.|\s*\-|\s*–|$)/i,
  /Art(?:igo)?\s*\.?\s*(\d+[A-Z]?)(?:\s*\-[A-Z])?(?:\s*\.|\s*\-|\s*–|$)/i,
];

// Padrão para identificar elementos estruturais (TÍTULO, CAPÍTULO, SEÇÃO)
const STRUCTURAL_PATTERN = /(?:\n|\s|^)(TÍTULO|CAPÍTULO|SEÇÃO)\s+[^\n]+/gi;

// Função para verificar se o texto é provavelmente uma legislação
export const isLegalContent = (text: string): boolean => {
  // Verificar menções frequentes a artigos
  const articleMatches = text.match(/Art(?:igo)?\s*\.?\s*\d+/gi);
  if (articleMatches && articleMatches.length > 3) {
    return true;
  }

  // Verificar menções a leis, decretos, etc.
  const legalTerms = [
    /lei(?:\s+n[o|º]\.?\s+\d+)/i,
    /decreto(?:\-lei|\s+n[o|º]\.?\s+\d+)/i,
    /resolução(?:\s+n[o|º]\.?\s+\d+)/i,
    /portaria(?:\s+n[o|º]\.?\s+\d+)/i,
    /código\s+\w+/i,
    /constituição\s+federal/i,
  ];

  for (const term of legalTerms) {
    if (text.match(term)) {
      return true;
    }
  }

  return false;
};

// Função para identificar artigos em um texto legal
export const extractArticles = (
  text: string,
): { start: number; end: number; article: string; content: string }[] => {
  const articles: {
    start: number;
    end: number;
    article: string;
    content: string;
  }[] = [];

  // Encontrar todos os possíveis inícios de artigos
  const potentialStarts: { index: number; article: string }[] = [];

  for (const pattern of ARTICLE_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match.index !== undefined) {
        potentialStarts.push({
          index: match.index,
          article: match[0].trim(),
        });
      }
    }
  }

  // Ordenar por posição no texto
  potentialStarts.sort((a, b) => a.index - b.index);

  // Extrair o conteúdo de cada artigo
  for (let i = 0; i < potentialStarts.length; i++) {
    const start = potentialStarts[i].index;
    const end =
      i < potentialStarts.length - 1
        ? potentialStarts[i + 1].index
        : text.length;
    const content = text.substring(start, end).trim();

    articles.push({
      start,
      end,
      article: potentialStarts[i].article,
      content,
    });
  }

  return articles;
};

// Função para remover elementos estruturais do final de um texto
export const removeTrailingStructuralElements = (text: string): string => {
  // Padrão que identifica TÍTULO, CAPÍTULO ou SEÇÃO no final do texto
  const trailingPattern = /(?:\n|\s)(TÍTULO|CAPÍTULO|SEÇÃO)\s+[^\n]+\s*$/i;

  let cleanedText = text;
  let match = trailingPattern.exec(cleanedText);

  // Enquanto encontrar elementos estruturais no final do texto, removê-los
  while (match !== null) {
    cleanedText = cleanedText.substring(0, match.index).trim();
    match = trailingPattern.exec(cleanedText);
  }

  return cleanedText;
};

// Função especializada para chunking de conteúdo jurídico
export const generateLegalChunks = (text: string): string[] => {
  // Extrair artigos
  const articles = extractArticles(text);
  if (articles.length === 0) {
    // Se não encontrou artigos, recorrer ao método padrão
    return generateStandardChunks(text);
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokenCount = 0;

  // Extrair título da lei dos metadados do documento
  let documentTitle = '';

  if (articles.length > 0 && articles[0].start > 0) {
    const metaText = text.substring(0, articles[0].start).trim();

    // Extrair título da lei (primeira linha significativa)
    const lines = metaText.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length > 0) {
      // Procurar por padrões de título de lei
      for (const line of lines) {
        if (
          line.match(/(?:DECRETO|LEI|CÓDIGO|CONSTITUIÇÃO|RESOLUÇÃO|PORTARIA)/i)
        ) {
          documentTitle = line.trim();
          break;
        }
      }

      // Se não encontrou padrão específico, usar a primeira linha não-vazia
      if (!documentTitle && lines[0]) {
        documentTitle = lines[0].trim();
      }
    }
  }

  // Processar cada artigo
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    // Limpar elementos estruturais do final do artigo
    const cleanArticleText = removeTrailingStructuralElements(article.content);
    const articleTokens = countTokens(cleanArticleText);

    // Adicionar título da lei como metadado no final de cada chunk
    const lawMetadata = documentTitle ? `\n\n[Fonte: ${documentTitle}]` : '';
    const metadataTokens = countTokens(lawMetadata);

    // Caso 1: Artigo cabe completamente dentro do limite (considerando metadados)
    if (articleTokens + metadataTokens <= MAX_TOKEN_SIZE) {
      // Verificar se podemos agrupar com o chunk atual
      if (
        currentTokenCount > 0 &&
        currentTokenCount + articleTokens + metadataTokens <= MAX_TOKEN_SIZE
      ) {
        // Agrupar com o chunk atual
        currentChunk += `\n\n${cleanArticleText}`;
        currentTokenCount += articleTokens;
      } else {
        // Finalizar chunk atual se existir e atender ao mínimo
        if (currentChunk && currentTokenCount >= MIN_TOKEN_SIZE) {
          const finalChunk = currentChunk + lawMetadata;
          chunks.push(finalChunk);
        } else if (currentChunk && currentTokenCount > 0) {
          // Se não atingiu o mínimo, tentar agrupar com o próximo artigo
          const combinedContent = `${currentChunk}\n\n${cleanArticleText}`;
          const combinedTokens = countTokens(combinedContent) + metadataTokens;

          if (combinedTokens <= MAX_TOKEN_SIZE) {
            // Se couber, agrupamos e finalizamos
            const finalChunk = combinedContent + lawMetadata;
            chunks.push(finalChunk);
            currentChunk = '';
            currentTokenCount = 0;
            continue;
          } else {
            // Se não couber, salvamos o chunk atual mesmo sendo menor
            const finalChunk = currentChunk + lawMetadata;
            chunks.push(finalChunk);
          }
        }

        // Iniciar novo chunk com este artigo
        currentChunk = cleanArticleText;
        currentTokenCount = articleTokens;
      }
    }
    // Caso 2: Artigo grande demais para caber em um único chunk
    else {
      // Finalizar chunk atual se existir
      if (currentChunk) {
        const finalChunk = currentChunk + lawMetadata;
        chunks.push(finalChunk);
        currentChunk = '';
        currentTokenCount = 0;
      }

      // Dividir o artigo grande em partes menores
      const articleParts = splitLargeArticle(cleanArticleText, documentTitle);

      // Adicionar as partes do artigo dividido
      chunks.push(...articleParts);
    }
  }

  // Adicionar o último chunk se ainda houver algo pendente
  if (currentChunk) {
    const lawMetadata = documentTitle ? `\n\n[Fonte: ${documentTitle}]` : '';
    const finalChunk = currentChunk + lawMetadata;
    chunks.push(finalChunk);
  }

  // Validar que todos os chunks estão dentro dos limites
  const validatedChunks = chunks.filter((chunk) => {
    const tokenCount = countTokens(chunk);
    if (tokenCount > MAX_TOKEN_SIZE) {
      console.warn(
        `Chunk excede limite de tokens: ${tokenCount} > ${MAX_TOKEN_SIZE}`,
      );
      return false;
    }
    return true;
  });

  console.log(`Gerados ${validatedChunks.length} chunks jurídicos válidos`);
  return validatedChunks;
};

// Função para dividir artigos muito grandes em chunks menores
export const splitLargeArticle = (
  articleText: string,
  documentTitle: string,
): string[] => {
  const chunks: string[] = [];

  // Dividir por parágrafos primeiro
  const paragraphs = articleText
    .split(/\n\s*\n+/)
    .filter((p) => p.trim().length > 0);

  // Se não há parágrafos distintos, dividir por sentenças
  if (paragraphs.length <= 1) {
    const sentences = articleText
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
    return splitBySentences(sentences, documentTitle);
  }

  // Extrair o cabeçalho do artigo (primeira linha)
  const articleHeader = paragraphs[0];
  let currentChunk = articleHeader;

  // Metadados da lei para incluir em cada chunk
  const lawMetadata = documentTitle ? `\n\n[Fonte: ${documentTitle}]` : '';
  const metadataTokens = countTokens(lawMetadata);

  let currentTokenCount = countTokens(currentChunk);

  // Processar cada parágrafo
  for (let i = 1; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphTokens = countTokens(paragraph);

    // Verificar se adicionar este parágrafo excederá o limite (considerando metadados)
    if (currentTokenCount + paragraphTokens + metadataTokens > MAX_TOKEN_SIZE) {
      // Finalizar chunk atual
      const finalChunk = currentChunk + lawMetadata;
      chunks.push(finalChunk);

      // Novo chunk com referência ao artigo
      const articleReference = `(Continuação ${articleHeader.split('\n')[0]})`;
      currentChunk = `${articleReference}\n\n${paragraph}`;
      currentTokenCount = countTokens(currentChunk);
    } else {
      // Adicionar parágrafo ao chunk atual
      currentChunk += `\n\n${paragraph}`;
      currentTokenCount += paragraphTokens;
    }
  }

  // Adicionar o último chunk se ainda houver algo
  if (currentChunk) {
    const finalChunk = currentChunk + lawMetadata;
    chunks.push(finalChunk);
  }

  return chunks;
};

// Função auxiliar para dividir por sentenças
const splitBySentences = (
  sentences: string[],
  documentTitle: string,
): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';

  const lawMetadata = documentTitle ? `\n\n[Fonte: ${documentTitle}]` : '';
  const metadataTokens = countTokens(lawMetadata);

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    const currentTokens = countTokens(currentChunk);

    if (currentTokens + sentenceTokens + metadataTokens > MAX_TOKEN_SIZE) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk + lawMetadata);
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk + lawMetadata);
  }

  return chunks;
};

// Função padrão para chunking de conteúdo não-jurídico
const generateStandardChunks = (input: string): string[] => {
  // Limpar o texto
  const cleanText = input.trim().replace(/\s+/g, ' ');

  // Primeiro dividir por quebras naturais (parágrafos, artigos, etc.)
  const paragraphs = cleanText
    .split(/\n+|\r\n+/)
    .filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // Se o parágrafo sozinho já é maior que o limite, dividir por sentenças
    if (countTokens(paragraph) > MAX_TOKEN_SIZE) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/g);

      for (const sentence of sentences) {
        if (sentence.trim().length === 0) continue;

        const sentenceTokens = countTokens(sentence);
        const currentTokens = countTokens(currentChunk);

        if (currentTokens + sentenceTokens > MAX_TOKEN_SIZE) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }

          // Se uma única sentença for maior que o limite, dividi-la
          if (sentenceTokens > MAX_TOKEN_SIZE) {
            const words = sentence.split(' ');
            for (const word of words) {
              const wordTokens = countTokens(word);
              const currentTokens = countTokens(currentChunk);

              if (currentTokens + wordTokens + 1 > MAX_TOKEN_SIZE) {
                if (currentChunk.trim().length > 0) {
                  chunks.push(currentChunk.trim());
                }
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
    } else if (
      countTokens(currentChunk) + countTokens(paragraph) + 1 >
      MAX_TOKEN_SIZE
    ) {
      // Se adicionar este parágrafo exceder o limite, iniciar um novo chunk
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      // Adicionar o parágrafo ao chunk atual
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + paragraph;
    }
  }

  // Adicionar o último chunk se houver algo
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Validar que todos os chunks estão dentro dos limites
  const validatedChunks = chunks.filter((chunk) => {
    const tokenCount = countTokens(chunk);
    if (tokenCount > MAX_TOKEN_SIZE) {
      console.warn(
        `Chunk padrão excede limite de tokens: ${tokenCount} > ${MAX_TOKEN_SIZE}`,
      );
      return false;
    }
    return tokenCount > 0; // Garantir que não há chunks vazios
  });

  console.log(`Gerados ${validatedChunks.length} chunks padrão válidos`);
  return validatedChunks;
};

// Função principal para dividir texto em pedaços menores
const generateChunks = (input: string, sourceType?: string): string[] => {
  // Se for conteúdo de fonte de texto manual (da aba de texto na interface), retornar como um único chunk
  if (sourceType === SourceType.TEXT) {
    return [input];
  }

  // Para links, verificar se é conteúdo jurídico
  if (sourceType === SourceType.LINK && isLegalContent(input)) {
    return generateLegalChunks(input);
  }

  // Para outros tipos, usar a abordagem padrão
  return generateStandardChunks(input);
};

export const generateEmbeddings = async (
  value: string,
  sourceType?: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value, sourceType);
  console.log(`Total de chunks gerados: ${chunks.length}`);

  // Validar e filtrar chunks que excedem o limite
  const validChunks = chunks.filter((chunk) => {
    const tokenCount = countTokens(chunk);
    if (tokenCount > MAX_TOKEN_SIZE) {
      console.warn(
        `Chunk rejeitado por exceder limite: ${tokenCount} tokens > ${MAX_TOKEN_SIZE}`,
      );
      console.warn(`Conteúdo do chunk: ${chunk.substring(0, 200)}...`);
      return false;
    }
    return true;
  });

  console.log(`Chunks válidos após filtragem: ${validChunks.length}`);

  // Processando chunks em lotes para evitar exceder limites
  const results: Array<{ embedding: number[]; content: string }> = [];

  // Limite da API OpenAI para embeddings: 300.000 tokens por requisição
  const API_TOKEN_LIMIT = 300000;
  const BATCH_SIZE = 20; // Tamanho máximo do lote

  // Processamento em lotes dinâmicos baseados no limite de tokens
  let currentBatch: string[] = [];
  let currentBatchTokens = 0;
  let batchCount = 0;

  for (let i = 0; i < validChunks.length; i++) {
    const chunk = validChunks[i];
    const chunkTokens = countTokens(chunk);

    // Verificar se adicionar este chunk excederia o limite de tokens ou tamanho do lote
    if (
      currentBatchTokens + chunkTokens > API_TOKEN_LIMIT ||
      currentBatch.length >= BATCH_SIZE
    ) {
      // Processar o lote atual se não estiver vazio
      if (currentBatch.length > 0) {
        try {
          console.log(
            `Processando lote ${batchCount + 1}: ${currentBatch.length} chunks, ${currentBatchTokens} tokens`,
          );

          const { embeddings } = await embedMany({
            model: embeddingModel,
            values: currentBatch,
          });

          for (let j = 0; j < currentBatch.length; j++) {
            results.push({
              content: currentBatch[j],
              embedding: embeddings[j],
            });
          }

          batchCount++;

          // Pequena pausa para não sobrecarregar a API
          if (i < validChunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Erro ao processar lote ${batchCount + 1}:`, error);
          // Continua para o próximo lote mesmo se houver erro
        }
      }

      // Iniciar novo lote
      currentBatch = [chunk];
      currentBatchTokens = chunkTokens;
    } else {
      // Adicionar chunk ao lote atual
      currentBatch.push(chunk);
      currentBatchTokens += chunkTokens;
    }
  }

  // Processar o último lote se houver chunks restantes
  if (currentBatch.length > 0) {
    try {
      console.log(
        `Processando lote final ${batchCount + 1}: ${currentBatch.length} chunks, ${currentBatchTokens} tokens`,
      );

      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: currentBatch,
      });

      for (let j = 0; j < currentBatch.length; j++) {
        results.push({
          content: currentBatch[j],
          embedding: embeddings[j],
        });
      }
    } catch (error) {
      console.error(`Erro ao processar lote final ${batchCount + 1}:`, error);
    }
  }

  console.log(
    `Processamento concluído: ${results.length} embeddings gerados de ${validChunks.length} chunks válidos`,
  );
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
    // Logs informativos removidos
    // Normalizar a consulta do usuário
    const normalizedQuery = userQuery.toLowerCase().trim();
    try {
      // Gerar embedding para a consulta
      const userQueryEmbedded = await generateEmbedding(normalizedQuery);
      // Calcular similaridade usando distância de cosseno
      const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;
      // Threshold de similaridade mais baixo para capturar mais resultados
      const similarityThreshold = 0.2;
      // Buscar fragmentos relevantes - buscamos mais para aplicar filtragem de qualidade
      const similarContent = await db
        .select({
          content: embeddings.content,
          similarity,
          resourceId: embeddings.resourceId,
        })
        .from(embeddings)
        .where(gt(similarity, similarityThreshold))
        .orderBy((t) => desc(t.similarity))
        .limit(20);
      // Aplicar filtragem por qualidade de conteúdo
      const minQualityScore = 5;
      const filteredByQuality = filterLowQualityContent(
        similarContent,
        minQualityScore,
      );
      // Implementar diversidade de fontes e controle de tokens
      const processedResults = [];
      const resourceCount = new Map();
      let totalTokens = 0;
      const MAX_TOTAL_TOKENS = 2500;
      for (const item of filteredByQuality) {
        // Contagem precisa de tokens
        const fragmentTokens = countTokens(item.content, 'gpt-4o');
        // Verificar limite de tokens
        if (totalTokens + fragmentTokens > MAX_TOTAL_TOKENS) {
          break;
        }
        // Controlar diversidade de fontes
        const currentCount = resourceCount.get(item.resourceId) || 0;
        if (currentCount >= 2) {
          continue;
        }
        processedResults.push({
          ...item,
          tokenCount: fragmentTokens,
        });
        totalTokens += fragmentTokens;
        resourceCount.set(item.resourceId, currentCount + 1);
        if (processedResults.length >= 6) {
          break;
        }
      }
      return processedResults;
    } catch (embeddingError: unknown) {
      console.error(
        '[EMBEDDING] Erro ao gerar embedding ou consultar base:',
        embeddingError,
      );
      console.error(
        (embeddingError as Error)?.stack || 'Sem stack trace disponível',
      );
      throw embeddingError;
    }
  } catch (error: unknown) {
    console.error('[EMBEDDING] Erro ao buscar conteúdo relevante:', error);
    console.error((error as Error)?.stack || 'Sem stack trace disponível');
    return [];
  }
};
