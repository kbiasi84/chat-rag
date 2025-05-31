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

  // Processar cada artigo
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    // Limpar elementos estruturais do final do artigo
    const cleanArticleText = removeTrailingStructuralElements(article.content);
    const articleTokens = countTokens(cleanArticleText);

    // Caso 1: Artigo cabe completamente dentro do limite
    if (articleTokens <= MAX_TOKEN_SIZE) {
      // Verificar se podemos agrupar com o chunk atual
      if (
        currentTokenCount > 0 &&
        currentTokenCount + articleTokens <= MAX_TOKEN_SIZE
      ) {
        // Agrupar com o chunk atual
        currentChunk += `\n\n${cleanArticleText}`;
        currentTokenCount += articleTokens;
      } else {
        // Finalizar chunk atual se existir e atender ao mínimo
        if (currentChunk && currentTokenCount >= MIN_TOKEN_SIZE) {
          chunks.push(currentChunk);
        } else if (currentChunk && currentTokenCount > 0) {
          // Se não atingiu o mínimo, tentar agrupar com o próximo artigo
          const combinedContent = `${currentChunk}\n\n${cleanArticleText}`;
          const combinedTokens = countTokens(combinedContent);

          if (combinedTokens <= MAX_TOKEN_SIZE) {
            // Se couber, agrupamos e finalizamos
            chunks.push(combinedContent);
            currentChunk = '';
            currentTokenCount = 0;
            continue;
          } else {
            // Se não couber, salvamos o chunk atual mesmo sendo menor
            chunks.push(currentChunk);
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
        chunks.push(currentChunk);
        currentChunk = '';
        currentTokenCount = 0;
      }

      // Dividir o artigo grande em partes menores
      const articleParts = splitLargeArticle(cleanArticleText);

      // Adicionar as partes do artigo dividido
      chunks.push(...articleParts);
    }
  }

  // Adicionar o último chunk se ainda houver algo pendente
  if (currentChunk) {
    chunks.push(currentChunk);
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
export const splitLargeArticle = (articleText: string): string[] => {
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
    return splitBySentences(sentences);
  }

  // Extrair o cabeçalho do artigo (primeira linha)
  const articleHeader = paragraphs[0];
  let currentChunk = articleHeader;

  let currentTokenCount = countTokens(currentChunk);

  // Processar cada parágrafo
  for (let i = 1; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const paragraphTokens = countTokens(paragraph);

    // Verificar se adicionar este parágrafo excederá o limite
    if (currentTokenCount + paragraphTokens > MAX_TOKEN_SIZE) {
      // Finalizar chunk atual
      const finalChunk = currentChunk;
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
    const finalChunk = currentChunk;
    chunks.push(finalChunk);
  }

  return chunks;
};

// Função auxiliar para dividir por sentenças
const splitBySentences = (sentences: string[]): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    const currentTokens = countTokens(currentChunk);

    if (currentTokens + sentenceTokens > MAX_TOKEN_SIZE) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
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
  if (currentChunk?.trim()) {
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
const generateChunks = (
  input: string,
  sourceType?: string,
  linkMetadata?: { lei?: string; contexto?: string },
): string[] => {
  // Se for conteúdo de fonte de texto manual (da aba de texto na interface), retornar como um único chunk
  if (sourceType === SourceType.TEXT) {
    return [input];
  }

  // Para links, usar a função especializada com overlap e metadados
  if (sourceType === SourceType.LINK) {
    return generateLinkChunks(input, linkMetadata);
  }

  // Para outros tipos, usar a abordagem padrão
  return generateStandardChunks(input);
};

export const generateEmbeddings = async (
  value: string,
  sourceType?: string,
  linkMetadata?: { lei?: string; contexto?: string },
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value, sourceType, linkMetadata);
  console.log(`Total de chunks gerados: ${chunks.length}`);

  // Validar e filtrar chunks que excedem o limite
  // Para chunks de links com metadados, permitir tamanho maior
  const isLinkWithMetadata =
    sourceType === SourceType.LINK &&
    (linkMetadata?.lei || linkMetadata?.contexto);
  const tokenLimit = isLinkWithMetadata ? MAX_TOKEN_SIZE + 500 : MAX_TOKEN_SIZE; // Permite 500 tokens extras para metadados de links

  const validChunks = chunks.filter((chunk) => {
    const tokenCount = countTokens(chunk);
    if (tokenCount > tokenLimit) {
      console.warn(
        `Chunk rejeitado por exceder limite: ${tokenCount} tokens > ${tokenLimit} (limite ${isLinkWithMetadata ? 'flexível para links com metadados' : 'padrão'})`,
      );
      console.warn(`Conteúdo do chunk: ${chunk.substring(0, 200)}...`);
      return false;
    }
    return true;
  });

  console.log(
    `Chunks válidos após filtragem: ${validChunks.length} (limite aplicado: ${tokenLimit} tokens)`,
  );

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

// Função específica para chunking de conteúdo de links com overlap e metadados
export const generateLinkChunks = (
  text: string,
  linkMetadata?: { lei?: string; contexto?: string },
): string[] => {
  const TARGET_CONTENT_TOKENS = 500; // Conteúdo fixo de 500 tokens
  const TARGET_OVERLAP_TOKENS = 120; // Overlap fixo de 120 tokens

  // Calcular tokens dos metadados (sem limitação)
  const metadataText =
    linkMetadata?.lei || linkMetadata?.contexto
      ? `\n\n--- Metadados ---${linkMetadata.lei ? `\n**Lei:** ${linkMetadata.lei}` : ''}${linkMetadata.contexto ? `\n**Contexto:** ${linkMetadata.contexto}` : ''}`
      : '';
  const metadataTokens = countTokens(metadataText);

  console.log(
    `Estratégia flexível: conteúdo=${TARGET_CONTENT_TOKENS}, overlap=${TARGET_OVERLAP_TOKENS}, metadados=${metadataTokens} tokens (sem limite)`,
  );

  // Limpar e preparar texto como conteúdo corrido
  const cleanText = text.trim().replace(/\s+/g, ' ');

  // Gerar chunks com estratégia simples e uniforme
  const baseChunks = generateSimpleChunks(cleanText, TARGET_CONTENT_TOKENS);

  if (baseChunks.length <= 1) {
    return baseChunks.map((chunk) => addLinkMetadata(chunk, linkMetadata));
  }

  // Aplicar overlap fixo entre chunks
  const chunksWithOverlap: string[] = [];

  for (let i = 0; i < baseChunks.length; i++) {
    const chunkContent = baseChunks[i];
    let overlapText = '';

    // Overlap fixo de 120 tokens do chunk anterior
    if (i > 0) {
      const previousChunk = baseChunks[i - 1];
      overlapText = generateFixedOverlap(previousChunk, TARGET_OVERLAP_TOKENS);
    }

    // Montar chunk final: overlap + conteúdo + metadados
    let finalChunk = '';
    if (overlapText) {
      finalChunk = `...${overlapText}\n\n${chunkContent}`;
    } else {
      finalChunk = chunkContent;
    }

    // Adicionar metadados (sem limitação de tamanho)
    finalChunk = addLinkMetadata(finalChunk, linkMetadata);

    // Log informativo
    const contentTokens = countTokens(chunkContent);
    const overlapTokens = overlapText ? countTokens(overlapText) : 0;
    const finalTokenCount = countTokens(finalChunk);

    console.log(
      `Chunk ${i + 1}: conteúdo=${contentTokens}, overlap=${overlapTokens}, metadados=${metadataTokens}, total=${finalTokenCount} tokens`,
    );

    chunksWithOverlap.push(finalChunk);
  }

  console.log(
    `Gerados ${chunksWithOverlap.length} chunks com metadados flexíveis (500+120+metadados-ilimitados)`,
  );
  return chunksWithOverlap;
};

// Nova função simplificada para gerar chunks de 500 tokens
const generateSimpleChunks = (text: string, targetTokens: number): string[] => {
  const chunks: string[] = [];
  const words = text.split(' ');
  let currentChunk = '';
  let currentTokens = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
    const testTokens = countTokens(testChunk);

    // Se ainda não atingiu o target, continuar adicionando
    if (testTokens < targetTokens) {
      currentChunk = testChunk;
      currentTokens = testTokens;
    }
    // Se atingiu o target, procurar melhor ponto de quebra
    else {
      const breakPoint = findBestBreakPoint(
        currentChunk,
        words,
        i,
        targetTokens,
      );

      if (breakPoint.chunk) {
        chunks.push(breakPoint.chunk);
        // Recomeçar do ponto de quebra
        i = breakPoint.nextIndex - 1; // -1 porque o loop vai incrementar
        currentChunk = '';
        currentTokens = 0;
      } else {
        // Se não encontrou bom ponto de quebra, usar o chunk atual
        chunks.push(currentChunk);
        currentChunk = word;
        currentTokens = countTokens(word);
      }
    }
  }

  // Adicionar último chunk se sobrou algo
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
};

// Função para encontrar o melhor ponto de quebra próximo ao target
const findBestBreakPoint = (
  currentChunk: string,
  allWords: string[],
  currentIndex: number,
  targetTokens: number,
):
  | { chunk: string; nextIndex: number }
  | { chunk: null; nextIndex: number } => {
  // Buscar em uma janela de ±20 palavras do ponto atual
  const searchWindow = 20;
  const startSearch = Math.max(0, currentIndex - searchWindow);
  const endSearch = Math.min(allWords.length, currentIndex + searchWindow);

  // Padrões de quebra em ordem de preferência
  const breakPatterns = [
    /\.\s*$/, // Final de sentença (.)
    /\!\s*$/, // Final de exclamação (!)
    /\?\s*$/, // Final de pergunta (?)
    /\;\s*$/, // Ponto e vírgula (;)
    /\:\s*$/, // Dois pontos (:)
    /\,\s*$/, // Vírgula (último recurso)
  ];

  let bestBreak: { chunk: string; nextIndex: number; score: number } | null =
    null;

  // Procurar por cada padrão na janela
  for (let wordIndex = startSearch; wordIndex < endSearch; wordIndex++) {
    const testChunk = allWords.slice(0, wordIndex + 1).join(' ');
    const testTokens = countTokens(testChunk);

    // Só considerar se estiver próximo do target (±50 tokens)
    if (Math.abs(testTokens - targetTokens) > 50) continue;

    const lastWord = allWords[wordIndex];

    for (
      let patternIndex = 0;
      patternIndex < breakPatterns.length;
      patternIndex++
    ) {
      const pattern = breakPatterns[patternIndex];

      if (pattern.test(lastWord)) {
        // Calcular score: proximidade do target + prioridade do padrão
        const proximityScore = 50 - Math.abs(testTokens - targetTokens); // Max 50
        const patternScore = (breakPatterns.length - patternIndex) * 10; // Max 60
        const totalScore = proximityScore + patternScore;

        if (!bestBreak || totalScore > bestBreak.score) {
          bestBreak = {
            chunk: testChunk,
            nextIndex: wordIndex + 1,
            score: totalScore,
          };
        }
        break; // Para de testar outros padrões para esta palavra
      }
    }
  }

  // Se encontrou um bom ponto de quebra, usar
  if (bestBreak) {
    return { chunk: bestBreak.chunk, nextIndex: bestBreak.nextIndex };
  }

  // Se não encontrou, retornar null para usar quebra simples
  return { chunk: null, nextIndex: currentIndex };
};

// Função para gerar overlap fixo de exatamente ~120 tokens
const generateFixedOverlap = (
  previousChunk: string,
  targetTokens: number,
): string => {
  const words = previousChunk.split(' ');

  // Estimativa inicial (aproximadamente 1.3 tokens por palavra)
  const estimatedWords = Math.floor(targetTokens / 1.3);

  // Ajuste fino para ficar próximo dos 120 tokens
  let bestOverlap = '';
  let bestTokenCount = 0;

  // Testar ±10 palavras da estimativa
  for (
    let wordCount = Math.max(10, estimatedWords - 10);
    wordCount <= Math.min(words.length, estimatedWords + 10);
    wordCount++
  ) {
    const candidate = words.slice(-wordCount).join(' ');
    const candidateTokens = countTokens(candidate);

    // Prefere o mais próximo do target
    if (
      Math.abs(candidateTokens - targetTokens) <
      Math.abs(bestTokenCount - targetTokens)
    ) {
      bestOverlap = candidate;
      bestTokenCount = candidateTokens;
    }

    // Se passou muito do target, parar
    if (candidateTokens > targetTokens + 10) {
      break;
    }
  }

  return bestOverlap;
};

// Função auxiliar para adicionar metadados de lei e contexto
const addLinkMetadata = (
  content: string,
  metadata?: { lei?: string; contexto?: string },
): string => {
  let enrichedContent = content;

  if (metadata?.lei || metadata?.contexto) {
    enrichedContent += '\n\n--- Metadados ---';

    if (metadata.lei) {
      enrichedContent += `\n**Lei:** ${metadata.lei}`;
    }

    if (metadata.contexto) {
      enrichedContent += `\n**Contexto:** ${metadata.contexto}`;
    }
  }

  return enrichedContent;
};

// Nova função para gerar chunks base menores que acomodem overlap + metadados
const generateSmallerChunksForLinks = (
  text: string,
  maxTokensPerChunk: number,
): string[] => {
  // Agora usa a estratégia simplificada - esta função não é mais necessária
  return generateSimpleChunks(text, maxTokensPerChunk);
};
