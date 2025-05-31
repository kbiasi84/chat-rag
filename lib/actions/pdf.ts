'use server';

import { SourceType, resources } from '@/lib/db/schema/resources';
import { nanoid } from '@/lib/utils';
import { generateEmbeddings } from '@/lib/ai/embedding';
import { db } from '@/lib/db';
import { embeddings as embeddingsTable } from '@/lib/db/schema/embeddings';

// Função para processar o arquivo PDF e extrair seu texto com metadados
export async function processPdfFile(
  file: File,
  metadata?: { lei?: string; contexto?: string },
): Promise<{ success: boolean; message: string; resourceId?: string }> {
  try {
    // Declarar variáveis no escopo da função
    let fullText = '';
    let pageCount = 0;
    let errorCount = 0;
    let pdfDocument: any;
    let pdfContent = '';
    let title = file.name.replace(/\.[^/.]+$/, ''); // fallback default

    const arrayBuffer = await file.arrayBuffer();

    // Importação dinâmica para evitar problemas com Turbopack
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

      // Configurar worker seguindo o exemplo oficial do repositório
      try {
        // Baseado no exemplo oficial: https://github.com/mozilla/pdfjs-dist/tree/master
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'pdfjs-dist/legacy/build/pdf.worker.mjs';
      } catch (workerError) {
        // Se falhar, tentar definir como string vazia
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
        } catch (e) {
          // Ignorar erro do worker
        }
      }

      // Usar a abordagem oficial da documentação
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0, // Minimizar logs internos
      });

      pdfDocument = await loadingTask.promise;

      // Extrair texto de cada página
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Combinar todos os itens de texto da página
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

          if (pageText.trim()) {
            fullText += `\n\n--- Página ${pageNum} ---\n\n${pageText.trim()}`;
            pageCount++;
          }
        } catch (pageError) {
          errorCount++;
          console.error(`Erro ao processar página ${pageNum}:`, pageError);
          // Continua com as outras páginas
        }
      }
    } catch (importError) {
      console.error('Erro ao importar ou usar pdfjs-dist:', importError);
      throw importError;
    }

    // Verificar se conseguimos extrair texto
    if (!fullText.trim()) {
      console.error('Nenhum texto foi extraído do PDF');
      return {
        success: false,
        message:
          'Não foi possível extrair texto do PDF. O arquivo pode conter apenas imagens ou estar protegido.',
      };
    }

    // Extrair metadados do PDF
    try {
      const metadata_info = await pdfDocument.getMetadata();
      title = (metadata_info.info as any)?.Title || title;
      const author = (metadata_info.info as any)?.Author || 'Não especificado';
      const creator =
        (metadata_info.info as any)?.Creator || 'Não especificado';

      // Construir o conteúdo formatado com o texto real extraído
      pdfContent = `# ${title}\n\n`;
      pdfContent += `**Arquivo:** ${file.name}\n`;
      pdfContent += `**Autor:** ${author}\n`;
      pdfContent += `**Criador:** ${creator}\n`;
      pdfContent += `**Páginas:** ${pdfDocument.numPages}\n`;
      pdfContent += `**Caracteres extraídos:** ${fullText.length}\n\n`;

      // Adicionar metadados opcionais se fornecidos
      if (metadata?.lei) {
        pdfContent += `**Lei:** ${metadata.lei}\n`;
      }
      if (metadata?.contexto) {
        pdfContent += `**Contexto:** ${metadata.contexto}\n`;
      }

      pdfContent += '\n## Conteúdo Extraído\n\n';

      // Adicionar o texto real extraído do PDF
      pdfContent += fullText.trim();
    } catch (metadataError) {
      console.error('Erro ao extrair metadados:', metadataError);

      // Fallback sem metadados
      const author = 'Não especificado';
      const creator = 'Não especificado';

      pdfContent = `# ${title}\n\n`;
      pdfContent += `**Arquivo:** ${file.name}\n`;
      pdfContent += `**Autor:** ${author}\n`;
      pdfContent += `**Criador:** ${creator}\n`;
      pdfContent += `**Páginas:** ${pdfDocument.numPages}\n`;
      pdfContent += `**Caracteres extraídos:** ${fullText.length}\n\n`;

      if (metadata?.lei) {
        pdfContent += `**Lei:** ${metadata.lei}\n`;
      }
      if (metadata?.contexto) {
        pdfContent += `**Contexto:** ${metadata.contexto}\n`;
      }

      pdfContent += '\n## Conteúdo Extraído\n\n';
      pdfContent += fullText.trim();
    }

    // Gerar um ID único para o arquivo PDF
    const pdfId = `pdf-${nanoid()}`;

    // Adicionar à base de conhecimento
    try {
      const [mainResource] = await db
        .insert(resources)
        .values({
          content: pdfContent,
          sourceType: SourceType.PDF,
          sourceId: pdfId,
        })
        .returning();

      // Gerar embeddings usando o sistema específico para PDFs
      const pdfMetadata = {
        lei: metadata?.lei || undefined,
        contexto: metadata?.contexto || undefined,
      };

      const contentEmbeddings = await generateEmbeddings(
        pdfContent,
        SourceType.PDF,
        pdfMetadata,
      );

      // Inserir embeddings
      await db.insert(embeddingsTable).values(
        contentEmbeddings.map((embedding) => ({
          resourceId: mainResource.id,
          ...embedding,
        })),
      );

      return {
        success: true,
        message: `PDF "${title}" processado e adicionado com sucesso com ${contentEmbeddings.length} chunks.`,
        resourceId: pdfId,
      };
    } catch (dbError) {
      console.error('Erro nas operações de banco de dados:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Erro ao processar o arquivo PDF:', error);

    // Determinar um erro mais específico com base no tipo de erro
    let errorMessage =
      'Erro ao processar o arquivo PDF. Verifique se o arquivo é válido.';

    if (error instanceof Error) {
      if (error.message.includes('password')) {
        errorMessage =
          'O PDF está protegido por senha e não pode ser processado.';
      } else if (
        error.message.includes('corrupt') ||
        error.message.includes('invalid')
      ) {
        errorMessage = 'O arquivo PDF parece estar corrompido ou inválido.';
      } else if (error.message.includes('memory')) {
        errorMessage =
          'O PDF é muito grande para ser processado. Tente um arquivo menor.';
      }
    }

    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Server Action para processar upload de PDF diretamente do frontend
export async function uploadPdf(formData: FormData) {
  try {
    const file = formData.get('file') as File | null;
    const lei = formData.get('lei') as string | null;
    const contexto = formData.get('contexto') as string | null;

    if (!file) {
      return {
        success: false,
        message: 'Nenhum arquivo enviado',
      };
    }

    // Verificar se o arquivo é um PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return {
        success: false,
        message: 'O arquivo deve ser um PDF',
      };
    }

    // Verificar tamanho do arquivo (limite de 50MB = 50 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        message: `Arquivo muito grande. O tamanho máximo permitido é 50MB. Seu arquivo tem ${Math.round(file.size / (1024 * 1024))}MB.`,
      };
    }

    // Preparar metadados
    const metadata: { lei?: string; contexto?: string } = {};
    if (lei?.trim()) {
      metadata.lei = lei.trim();
    }
    if (contexto?.trim()) {
      metadata.contexto = contexto.trim();
    }

    // Processar o arquivo PDF
    return await processPdfFile(file, metadata);
  } catch (error) {
    console.error('Erro ao processar upload de PDF:', error);
    return {
      success: false,
      message: 'Erro ao processar o upload do arquivo',
    };
  }
}
