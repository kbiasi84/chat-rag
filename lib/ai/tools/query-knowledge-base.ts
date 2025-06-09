import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';
import { createResource } from '@/lib/actions/resources';
import { SourceType } from '@/lib/db/schema/resources';
import { generateObject, tool } from 'ai';
import { myProvider } from '@/lib/ai/providers';

/**
 * Extrai possíveis referências a artigos de leis e documentos jurídicos do conteúdo
 */
function extractLegalReferences(content: string): string[] {
  // Padrões comuns de referências legais
  const patterns = [
    /art(?:igo)?\s*\.?\s*(\d+[^\.]*)(?:[^\d\n]*(?:da|do)\s+([^\n\.,;]+))?/gi,
    /(?:lei|decreto|portaria|súmula|instrução normativa)\s+(?:n[°\.]?\s*)?([^\n\.,;]+)/gi,
    /(?:CLT|Consolidação das Leis do Trabalho|Constituição Federal|CF)[\s\.,](?:[^\n]*art(?:igo)?\s*\.?\s*(\d+[^\.]*))?/gi,
  ];

  const references: string[] = [];

  // Extrair correspondências de cada padrão
  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null = pattern.exec(content);
    while (match !== null) {
      if (match[0] && match[0].trim().length > 3) {
        // Evitar matches muito curtos
        references.push(match[0].trim());
      }
      match = pattern.exec(content);
    }
  });

  // Remover duplicatas
  return [...new Set(references)];
}

/**
 * Ferramenta para consultar informações na base de conhecimento
 */
export const getKnowledgeInfo = tool({
  description:
    'Consultar a base de conhecimento para encontrar informações relevantes sobre a pergunta do usuário.',
  parameters: z.object({
    question: z.string().describe('A pergunta do usuário'),
  }),
  execute: async ({ question }) => {
    try {
      const directResults = await findRelevantContent(question);
      const allResults = [...directResults];
      const uniqueContents = new Map();
      allResults.forEach((item) => {
        if (item?.content) {
          uniqueContents.set(item.content, item);
        }
      });
      const finalResults = Array.from(uniqueContents.values());
      const allLegalReferences: string[] = [];
      finalResults.forEach((item) => {
        if (item?.content) {
          const references = extractLegalReferences(item.content);
          allLegalReferences.push(...references);
        }
      });
      finalResults.sort((a, b) => {
        const simA = a?.similarity ?? 0;
        const simB = b?.similarity ?? 0;
        return simB - simA;
      });
      if (finalResults.length === 0) {
        return {
          found: false,
          message:
            'Não foram encontradas informações relevantes na base de conhecimento.',
          fragments: [],
          references: [],
        };
      }
      const formattedFragments = finalResults.slice(0, 8).map((item, index) => {
        const similarity = item?.similarity ?? 0;
        return {
          id: index + 1,
          content: item.content,
          relevance: (similarity * 100).toFixed(2),
          source: item.resourceId || 'Não especificada',
        };
      });
      const uniqueLegalReferences = [...new Set(allLegalReferences)];
      return {
        found: true,
        fragments: formattedFragments,
        references: uniqueLegalReferences,
      };
    } catch (error: unknown) {
      console.error('ERRO NA CONSULTA À BASE DE CONHECIMENTO:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      const stackTrace =
        error instanceof Error ? error.stack : 'Sem stack trace';
      console.error(stackTrace || 'Sem stack trace');
      return {
        found: false,
        message: `Erro ao consultar a base de conhecimento: ${errorMessage}`,
        fragments: [],
        references: [],
      };
    }
  },
});

/**
 * Ferramenta para analisar a consulta do usuário e extrair palavras-chave relevantes
 */
export const analyzeQuery = tool({
  description:
    'Analisar a consulta do usuário para extrair palavras-chave importantes para melhorar a pesquisa.',
  parameters: z.object({
    query: z.string().describe('A consulta do usuário'),
  }),
  execute: async ({ query }) => {
    try {
      const { object } = await generateObject({
        model: myProvider.languageModel('analyze-query-model'),
        schema: z.object({
          keywords: z
            .array(z.string())
            .max(5)
            .describe('palavras-chave importantes extraídas da consulta'),
        }),
        prompt: `Extraia até 5 palavras-chave importantes desta consulta: "${query}". Forneça apenas palavras individuais ou termos técnicos curtos que sejam relevantes para a busca em uma base de conhecimento.`,
      });
      return {
        query,
        success: true,
        keywords: object.keywords || [],
      };
    } catch (error: unknown) {
      console.error('ERRO NA ANÁLISE DE CONSULTA:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      const stackTrace =
        error instanceof Error ? error.stack : 'Sem stack trace';
      console.error(stackTrace || 'Sem stack trace');
      return {
        query,
        success: false,
        message: `Não foi possível extrair palavras-chave da consulta: "${query}". ${errorMessage}`,
        keywords: [],
      };
    }
  },
});

/**
 * Ferramenta para adicionar conteúdo do usuário à base de conhecimento
 */
export const addToKnowledgeBase = tool({
  description: 'Adicionar conteúdo à base de conhecimento.',
  parameters: z.object({
    content: z
      .string()
      .describe('O conteúdo a ser adicionado à base de conhecimento'),
    title: z.string().optional().describe('Título opcional para o conteúdo'),
  }),
  execute: async ({ content, title }) => {
    try {
      const fullContent = title ? `# ${title}\n\n${content}` : content;
      const result = await createResource({
        content: fullContent,
        sourceType: SourceType.TEXT,
      });
      if (typeof result === 'string' && result.includes('successfully')) {
        return {
          success: true,
          message: 'Conteúdo adicionado com sucesso à base de conhecimento.',
          resourceId: null,
        };
      }
      return {
        success: false,
        message:
          typeof result === 'string' ? result : 'Erro ao adicionar conteúdo.',
        resourceId: null,
      };
    } catch (error: unknown) {
      console.error('ERRO AO ADICIONAR CONTEÚDO:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      const stackTrace =
        error instanceof Error ? error.stack : 'Sem stack trace';
      console.error(stackTrace || 'Sem stack trace');
      return {
        success: false,
        message: `Erro ao adicionar conteúdo: ${errorMessage}`,
        resourceId: null,
      };
    }
  },
});
