'use server';

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  links,
  type NewLinkParams,
  insertLinkSchema,
} from '@/lib/db/schema/links';
import { getResourcesBySourceId, deleteResourcesBySourceId } from './resources';
import type { Response as FetchResponse } from 'node-fetch';
import iconv from 'iconv-lite';
import { SourceType, resources } from '@/lib/db/schema/resources';
import { generateEmbeddings } from '@/lib/ai/embedding';
import { embeddings as embeddingsTable } from '@/lib/db/schema/embeddings';

export const createLink = async (input: NewLinkParams) => {
  try {
    const { url, title, description, lei, contexto } =
      insertLinkSchema.parse(input);

    // Verifica se o link já existe
    const existingLink = await db
      .select()
      .from(links)
      .where(eq(links.url, url))
      .limit(1);

    if (existingLink.length > 0) {
      return `Link já existe com ID: ${existingLink[0].id}`;
    }

    const [link] = await db
      .insert(links)
      .values({ url, title, description }) // Não salvamos lei e contexto
      .returning();

    // Processa o conteúdo da URL imediatamente, passando os metadados temporários
    const processingResult = await processLinkContent(link.id, {
      lei,
      contexto,
    });

    return 'Link adicionado com sucesso e conteúdo processado.';
  } catch (error) {
    console.error('Erro ao criar link:', error);
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Erro ao adicionar o link. Tente novamente.';
  }
};

export const getAllLinks = async () => {
  try {
    const allLinks = await db.select().from(links).orderBy(links.createdAt);
    return allLinks;
  } catch (error) {
    console.error('Erro ao buscar links:', error);
    return [];
  }
};

export const deleteLink = async (id: string) => {
  try {
    // Primeiro, excluir os resources associados a este link
    await deleteResourcesBySourceId(id);

    // Depois, excluir o link
    await db.delete(links).where(eq(links.id, id));

    return 'Link e conteúdo associado excluídos com sucesso.';
  } catch (error) {
    console.error('Erro ao excluir link:', error);
    return 'Erro ao excluir o link.';
  }
};

export const refreshLink = async (id: string) => {
  try {
    // Primeiro, verificar se já existem recursos para este link
    const existingResources = await getResourcesBySourceId(id);

    if (existingResources.length > 0) {
      await deleteResourcesBySourceId(id);
    }

    // Para refresh, não temos os metadados temporários, então passamos vazios
    return await processLinkContent(id, {});
  } catch (error) {
    console.error('Erro ao atualizar conteúdo do link:', error);
    return 'Erro ao atualizar o conteúdo do link.';
  }
};

async function processLinkContent(
  linkId: string,
  metadata: { lei?: string; contexto?: string },
) {
  try {
    // Busca o link pelo ID
    const [link] = await db.select().from(links).where(eq(links.id, linkId));

    if (!link) {
      console.error('Link não encontrado com ID:', linkId);
      return 'Link não encontrado.';
    }

    // Busca o conteúdo da URL
    try {
      // Configuração do fetch com headers adequados para simular navegador
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      ];

      // Seleciona um User-Agent aleatório
      const userAgent =
        userAgents[Math.floor(Math.random() * userAgents.length)];

      // Opções para o fetch com timeout e headers
      const fetchOptions = {
        headers: {
          'User-Agent': userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          DNT: '1',
        },
        timeout: 30000, // 30 segundos de timeout
      };

      // Implementação de retry
      let response: FetchResponse | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | unknown;

      while (retryCount < maxRetries) {
        try {
          response = await fetch(link.url, fetchOptions);

          if (response?.ok) {
            break; // Fetch bem-sucedido, sair do loop
          }

          throw new Error(
            `Status da resposta: ${response ? `${response.status} ${response.statusText}` : 'Desconhecido'}`,
          );
        } catch (err) {
          lastError = err;
          console.error(`Erro na tentativa #${retryCount + 1}:`, err);
          retryCount++;

          if (retryCount < maxRetries) {
            // Pausa entre tentativas com backoff exponencial
            const delay = 2 ** retryCount * 1000; // 2s, 4s, 8s...
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // Se todas as tentativas falharem
      if (!response || !response.ok) {
        throw lastError || new Error('Falha em todas as tentativas de fetch');
      }

      // Verificar se é um site do governo brasileiro
      const isGovernmentalSite = link.url.includes('.gov.br');
      let html: string;

      if (isGovernmentalSite) {
        // Para sites do governo, assumir ISO-8859-1 (comum em sites legados do governo brasileiro)
        const buffer = await response.buffer();
        html = iconv.decode(buffer, 'iso-8859-1');
      } else {
        // Para outros sites, usar UTF-8 padrão
        html = await response.text();
      }

      // Carregar HTML com o Cheerio
      const $ = cheerio.load(html, {
        // @ts-ignore - O tipo não está atualizado, mas a opção é válida
        decodeEntities: false,
      });

      // Remove elementos desnecessários
      $(
        'script, style, nav, header, footer, iframe, .ads, .banner, .cookie, [class*="cookie"], [id*="cookie"]',
      ).remove();

      // Extrai o texto principal
      const bodyText = $('body').text().trim();

      // --- Processamento de tabelas como parte do texto ---
      // Extrair tabelas como markdown e reintegrá-las no texto em posições apropriadas
      const tablesMarkdown: Array<{
        markdown: string;
        index: number; // posição aproximada no documento
      }> = [];

      // Extrair as tabelas primeiro
      $('table').each((i, table) => {
        // Converter tabela para markdown
        const rows: string[] = [];
        $(table)
          .find('tr')
          .each((_, row) => {
            const cells: string[] = [];
            $(row)
              .find('th,td')
              .each((_, cell) => {
                cells.push($(cell).text().trim().replace(/\|/g, ' '));
              });
            rows.push(`| ${cells.join(' | ')} |`);
          });

        // Adiciona separador de cabeçalho se houver cabeçalho
        if (rows.length > 1) {
          const headerSep = `| ${rows[0]
            .split('|')
            .slice(1, -1)
            .map(() => '---')
            .join(' | ')} |`;
          rows.splice(1, 0, headerSep);
        }

        const markdownTable = rows.join('\n');

        // Encontrar a posição da tabela no documento para manter a ordem relativa
        const prevAll = $('*').toArray();
        const tableIndex = prevAll.findIndex((el) => el === table);

        tablesMarkdown.push({
          markdown: markdownTable,
          index: tableIndex,
        });
      });

      // Normalizar caracteres especiais do texto principal
      const cleanText = bodyText
        .replace(/\s+/g, ' ') // Remove espaços extras
        .replace(/\n+/g, '\n') // Remove quebras de linha extras
        .normalize('NFC') // Normaliza caracteres compostos
        .trim();

      // Formatar o conteúdo principal com as tabelas incorporadas
      let enhancedContent = `# ${link.title}\n\nURL: ${link.url}\n\n${cleanText}`;

      // Adicionar tabelas como apêndices com referências claras
      if (tablesMarkdown.length > 0) {
        enhancedContent += '\n\n## Tabelas Relacionadas\n\n';

        tablesMarkdown.forEach((table, index) => {
          enhancedContent += `### Tabela ${index + 1}\n\n${table.markdown}\n\n`;
        });
      }

      // Adiciona à base de conhecimento com tipo e ID de origem
      const [mainResource] = await db
        .insert(resources)
        .values({
          content: enhancedContent,
          sourceType: SourceType.LINK,
          sourceId: linkId,
        })
        .returning();

      // Gerar embeddings para o conteúdo completo
      const linkMetadata = {
        lei: metadata.lei || undefined,
        contexto: metadata.contexto || undefined,
      };
      const contentEmbeddings = await generateEmbeddings(
        enhancedContent,
        SourceType.LINK,
        linkMetadata,
      );

      // Inserir embeddings do conteúdo
      await db.insert(embeddingsTable).values(
        contentEmbeddings.map((embedding) => ({
          resourceId: mainResource.id,
          ...embedding,
        })),
      );

      // Atualiza o timestamp de processamento
      await db
        .update(links)
        .set({ lastProcessed: sql`now()` })
        .where(eq(links.id, linkId));

      return 'Conteúdo do link atualizado com sucesso.';
    } catch (fetchError) {
      console.error('Erro ao fazer fetch da URL:', link.url);
      console.error(fetchError);
      throw new Error(
        `Erro ao buscar conteúdo da URL: ${fetchError instanceof Error ? fetchError.message : 'Erro desconhecido'}`,
      );
    }
  } catch (error) {
    console.error('Erro geral ao processar conteúdo do link:', error);
    throw error;
  }
}
