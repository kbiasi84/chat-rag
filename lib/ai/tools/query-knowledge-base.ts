import { tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';
import { createResource } from '@/lib/actions/resources';
import { SourceType } from '@/lib/db/schema/resources';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';

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
    let match;
    // Usar while separado da atribuição para evitar advertência do linter
    while ((match = pattern.exec(content)) !== null) {
      if (match[0] && match[0].trim().length > 3) {
        // Evitar matches muito curtos
        references.push(match[0].trim());
      }
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
    keywords: z
      .array(z.string())
      .optional()
      .describe('Palavras-chave adicionais para melhorar a busca'),
  }),
  execute: async ({ question, keywords = [] }) => {
    console.log('--------- CONSULTA À BASE DE CONHECIMENTO ---------');
    console.log(`Pergunta: "${question}"`);
    console.log(`Palavras-chave recebidas: ${keywords.join(', ')}`);

    try {
      // Primeiro tenta com a pergunta completa
      console.log('Buscando resultados diretos para a pergunta...');
      const directResults = await findRelevantContent(question);
      console.log(`Encontrados ${directResults.length} resultados diretos`);

      // Depois tenta com cada palavra-chave, se fornecidas
      let keywordResults = [];
      if (keywords.length > 0) {
        console.log('Buscando resultados por palavras-chave...');
        try {
          keywordResults = await Promise.all(
            keywords.map(async (keyword) => {
              console.log(`Buscando por palavra-chave: "${keyword}"`);
              return await findRelevantContent(keyword);
            }),
          );
          console.log(
            `Busca por palavras-chave concluída com ${keywordResults.flat().length} resultados`,
          );
        } catch (keywordError) {
          console.error('Erro na busca por palavras-chave:', keywordError);
          // Continua com os resultados diretos mesmo se houver erro nas palavras-chave
        }
      }

      // Combina e ordena resultados
      const allResults = [...directResults, ...keywordResults.flat()];
      console.log(`Total combinado: ${allResults.length} resultados`);

      // Remove duplicatas baseado no conteúdo
      const uniqueContents = new Map();
      allResults.forEach((item) => {
        if (item?.content) {
          uniqueContents.set(item.content, item);
        }
      });

      const finalResults = Array.from(uniqueContents.values());
      console.log(
        `Após remoção de duplicatas: ${finalResults.length} resultados únicos`,
      );

      // Extrair referências legais de todos os resultados
      const allLegalReferences: string[] = [];
      finalResults.forEach((item) => {
        if (item?.content) {
          const references = extractLegalReferences(item.content);
          allLegalReferences.push(...references);
        }
      });
      console.log(`Extraídas ${allLegalReferences.length} referências legais`);

      // Ordena por similaridade (maior para menor)
      finalResults.sort((a, b) => {
        const simA = a?.similarity ?? 0;
        const simB = b?.similarity ?? 0;
        return simB - simA;
      });

      console.log(`Resultados ordenados por similaridade`);
      finalResults.slice(0, 3).forEach((item, idx) => {
        console.log(
          `Top ${idx + 1}: Similaridade ${(item?.similarity ?? 0) * 100}%`,
        );
      });

      if (finalResults.length === 0) {
        console.log('Nenhuma informação relevante encontrada');
        return 'Não foram encontradas informações relevantes na base de conhecimento.';
      }

      // Formata os resultados para apresentação
      const formattedResults = finalResults
        .slice(0, 8)
        .map((item, index) => {
          const similarity = item?.similarity ?? 0;
          const references = extractLegalReferences(item.content);
          const referencesText =
            references.length > 0
              ? `\nReferências Legais Identificadas: ${references.join(', ')}`
              : '';

          return `
---
Trecho #${index + 1} (Relevância: ${(similarity * 100).toFixed(2)}%)
Fonte: ${item.resourceId || 'Não especificada'}${referencesText}
Conteúdo:
${item.content}
---`;
        })
        .join('\n');

      // Formatação das referências legais encontradas
      const uniqueLegalReferences = [...new Set(allLegalReferences)];
      const legalReferencesText =
        uniqueLegalReferences.length > 0
          ? `\n\nReferências Legais Identificadas:\n${uniqueLegalReferences.join('\n')}`
          : '';

      console.log(
        `Retornando ${finalResults.slice(0, 8).length} fragmentos formatados`,
      );
      console.log('--------- FIM DA CONSULTA ---------');

      // Retornar os resultados em um formato que indique claramente ao modelo
      // que não deve exibir os dados brutos, mas usá-los para formular a resposta
      return `<resultados_internos>
<contexto>
${formattedResults}${legalReferencesText}
</contexto>
</resultados_internos>

Utilize os resultados internos acima para formular sua resposta. Cite os artigos e referências legais relevantes, mas NÃO exiba os trechos ou resultados brutos.`;
    } catch (error) {
      console.error('ERRO NA CONSULTA À BASE DE CONHECIMENTO:', error);
      console.error(error.stack || 'Sem stack trace');
      return `Erro ao consultar a base de conhecimento: ${error.message || 'Erro desconhecido'}`;
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
    console.log('--------- ANÁLISE DE CONSULTA ---------');
    console.log(`Consulta original: "${query}"`);

    try {
      console.log('Gerando palavras-chave com IA...');
      const { object } = await generateObject({
        model: openai.completion('gpt-3.5-turbo-instruct'),
        schema: z.object({
          keywords: z
            .array(z.string())
            .max(5)
            .describe('palavras-chave importantes extraídas da consulta'),
        }),
        prompt: `Extraia até 5 palavras-chave importantes desta consulta: "${query}". Forneça apenas palavras individuais ou termos técnicos curtos que sejam relevantes para a busca em uma base de conhecimento.`,
      });

      console.log(
        `Palavras-chave extraídas: ${object.keywords?.join(', ') || 'nenhuma'}`,
      );
      console.log('--------- FIM DA ANÁLISE ---------');

      // Retornar em formato de texto em vez de JSON
      return `<analise_interna>
<consulta>${query}</consulta>
<palavras_chave>${object.keywords?.join(', ') || 'nenhuma'}</palavras_chave>
</analise_interna>

Utilize estas palavras-chave para sua consulta à base de conhecimento.`;
    } catch (error) {
      console.error('ERRO NA ANÁLISE DE CONSULTA:', error);
      console.error(error.stack || 'Sem stack trace');
      // Em caso de erro, retornamos a consulta original sem palavras-chave
      return `<analise_interna>
<consulta>${query}</consulta>
<palavras_chave>nenhuma</palavras_chave>
<erro>Ocorreu um erro na análise</erro>
</analise_interna>

Continue com a consulta usando apenas os termos originais.`;
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
    console.log('--------- ADIÇÃO À BASE DE CONHECIMENTO ---------');
    console.log(`Título: ${title || 'Sem título'}`);
    console.log(`Tamanho do conteúdo: ${content.length} caracteres`);

    try {
      const fullContent = title ? `# ${title}\n\n${content}` : content;
      console.log('Criando recurso na base de conhecimento...');

      const result = await createResource({
        content: fullContent,
        sourceType: SourceType.TEXT,
        sourceId: `user-${Date.now()}`,
      });

      console.log('Conteúdo adicionado com sucesso');
      console.log('--------- FIM DA ADIÇÃO ---------');

      return 'Conteúdo adicionado com sucesso à base de conhecimento.';
    } catch (error) {
      console.error('ERRO AO ADICIONAR CONTEÚDO:', error);
      console.error(error.stack || 'Sem stack trace');
      return `Erro ao adicionar conteúdo à base de conhecimento: ${error.message || 'Erro desconhecido'}`;
    }
  },
});
