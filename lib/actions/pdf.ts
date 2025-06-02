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
    console.log('🔍 [PDF] Iniciando processamento do PDF:', file.name);
    console.log('🔍 [PDF] Tamanho do arquivo:', file.size, 'bytes');
    console.log('🔍 [PDF] Metadados fornecidos:', metadata);

    // Declarar variáveis no escopo da função
    let fullText = '';
    let pdfContent = '';
    const title = file.name.replace(/\.[^/.]+$/, ''); // fallback default

    const arrayBuffer = await file.arrayBuffer();
    console.log(
      '🔍 [PDF] ArrayBuffer criado com tamanho:',
      arrayBuffer.byteLength,
    );

    // Processar PDF com pdf-parse (Node.js nativo)
    try {
      console.log('🔍 [PDF] Carregando pdf-parse...');
      
      // Usar require em vez de import dinâmico para evitar problemas
      const pdfParse = eval('require')('pdf-parse');
      console.log('✅ [PDF] pdf-parse carregado com sucesso');
      
      console.log('🔍 [PDF] Processando PDF com pdf-parse...');
      
      // Converter ArrayBuffer para Buffer
      const buffer = Buffer.from(arrayBuffer);
      console.log('🔍 [PDF] Buffer criado, iniciando extração...');

      // Extrair texto e metadados do PDF
      const pdfData = await pdfParse(buffer, {
        // Opções para otimizar extração
        max: 0, // Extrair todas as páginas (0 = sem limite)
        // A biblioteca pdf-parse é mais robusta que pdfjs-dist para Node.js
      });

      console.log('✅ [PDF] PDF processado com sucesso!');
      console.log('🔍 [PDF] Informações extraídas:');
      console.log('  - Número de páginas:', pdfData.numpages);
      console.log('  - Total de caracteres extraídos:', pdfData.text.length);

      // Verificar se conseguimos extrair texto
      if (!pdfData.text || !pdfData.text.trim()) {
        console.error('❌ [PDF] Nenhum texto foi extraído do PDF');
        return {
          success: false,
          message:
            'Não foi possível extrair texto do PDF. O arquivo pode conter apenas imagens ou estar protegido.',
        };
      }

      fullText = pdfData.text.trim();

      // Extrair metadados do PDF se disponíveis
      let author = 'Não especificado';
      let creator = 'Não especificado';
      let pdfTitle = title;

      try {
        // pdf-parse pode incluir alguns metadados no objeto info
        if (pdfData.info) {
          pdfTitle = pdfData.info.Title || title;
          author = pdfData.info.Author || 'Não especificado';
          creator = pdfData.info.Creator || 'Não especificado';

          console.log('🔍 [PDF] Metadados extraídos:');
          console.log('  - Título:', pdfTitle);
          console.log('  - Autor:', author);
          console.log('  - Criador:', creator);
        } else {
          console.log('🔍 [PDF] Nenhum metadado disponível no PDF');
        }
      } catch (metadataError) {
        console.log(
          '⚠️ [PDF] Erro ao extrair metadados (continuando):',
          (metadataError as Error).message,
        );
      }

      // Construir o conteúdo formatado com o texto real extraído
      pdfContent = `# ${pdfTitle}\n\n`;
      pdfContent += `**Arquivo:** ${file.name}\n`;
      pdfContent += `**Autor:** ${author}\n`;
      pdfContent += `**Criador:** ${creator}\n`;
      pdfContent += `**Páginas:** ${pdfData.numpages}\n`;
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
      pdfContent += fullText;

      console.log(
        '🔍 [PDF] Conteúdo final preparado. Tamanho total:',
        pdfContent.length,
        'caracteres',
      );
    } catch (parseError) {
      console.error(
        '❌ [PDF] Erro ao processar PDF com pdf-parse:',
        parseError,
      );
      throw parseError;
    }

    // Gerar um ID único para o arquivo PDF
    const pdfId = `pdf-${nanoid()}`;
    console.log('🔍 [PDF] ID gerado para o recurso:', pdfId);

    // Adicionar à base de conhecimento
    try {
      console.log('🔍 [DB] Inserindo recurso no banco de dados...');
      const [mainResource] = await db
        .insert(resources)
        .values({
          content: pdfContent,
          sourceType: SourceType.PDF,
          sourceId: pdfId,
        })
        .returning();

      console.log(
        '✅ [DB] Recurso inserido com sucesso. ID do banco:',
        mainResource.id,
      );

      // Gerar embeddings usando o sistema específico para PDFs
      const pdfMetadata = {
        lei: metadata?.lei || undefined,
        contexto: metadata?.contexto || undefined,
      };

      console.log('🔍 [EMBEDDINGS] Iniciando geração de embeddings...');
      console.log('🔍 [EMBEDDINGS] Metadados para embeddings:', pdfMetadata);
      console.log(
        '🔍 [EMBEDDINGS] Tamanho do conteúdo para embeddings:',
        pdfContent.length,
      );

      const contentEmbeddings = await generateEmbeddings(
        pdfContent,
        SourceType.PDF,
        pdfMetadata,
      );

      console.log('✅ [EMBEDDINGS] Embeddings gerados com sucesso!');
      console.log(
        '🔍 [EMBEDDINGS] Número de chunks/embeddings criados:',
        contentEmbeddings.length,
      );

      // Log detalhado dos embeddings gerados
      contentEmbeddings.forEach((embedding, index) => {
        console.log(`🔍 [EMBEDDINGS] Chunk ${index + 1}:`, {
          conteudoLength: embedding.content?.length || 0,
          hasEmbedding: !!embedding.embedding,
          embeddingLength: embedding.embedding?.length || 0,
        });
      });

      // Inserir embeddings
      console.log('🔍 [DB] Inserindo embeddings no banco de dados...');
      const embeddingsToInsert = contentEmbeddings.map((embedding) => ({
        resourceId: mainResource.id,
        ...embedding,
      }));

      console.log(
        '🔍 [DB] Dados a inserir:',
        embeddingsToInsert.length,
        'embeddings',
      );

      const insertedEmbeddings = await db
        .insert(embeddingsTable)
        .values(embeddingsToInsert);

      console.log(
        '✅ [DB] Embeddings inseridos com sucesso no banco de dados!',
      );
      console.log('🔍 [DB] Resultado da inserção:', insertedEmbeddings);

      console.log(
        '🎉 [PDF] Processamento completo do PDF finalizado com sucesso!',
      );

      return {
        success: true,
        message: `PDF "${title}" processado e adicionado com sucesso com ${contentEmbeddings.length} chunks.`,
        resourceId: pdfId,
      };
    } catch (dbError) {
      console.error('❌ [DB] Erro nas operações de banco de dados:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('❌ [PDF] Erro geral ao processar o arquivo PDF:', error);

    // Determinar um erro mais específico com base no tipo de erro
    let errorMessage =
      'Erro ao processar o arquivo PDF. Verifique se o arquivo é válido.';

    if (error instanceof Error) {
      if (error.message.includes('password')) {
        errorMessage =
          'O PDF está protegido por senha e não pode ser processado.';
      } else if (
        error.message.includes('corrupt') ||
        error.message.includes('invalid') ||
        error.message.includes('damaged')
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
    console.log('🔍 [UPLOAD] Iniciando upload de PDF...');

    const file = formData.get('file') as File | null;
    const lei = formData.get('lei') as string | null;
    const contexto = formData.get('contexto') as string | null;

    console.log('🔍 [UPLOAD] Dados recebidos:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      lei: lei,
      contexto: contexto,
    });

    if (!file) {
      console.error('❌ [UPLOAD] Nenhum arquivo enviado');
      return {
        success: false,
        message: 'Nenhum arquivo enviado',
      };
    }

    // Verificar se o arquivo é um PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.error('❌ [UPLOAD] Arquivo não é PDF:', file.name);
      return {
        success: false,
        message: 'O arquivo deve ser um PDF',
      };
    }

    // Verificar tamanho do arquivo (limite de 50MB = 50 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      console.error('❌ [UPLOAD] Arquivo muito grande:', file.size, 'bytes');
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

    console.log('🔍 [UPLOAD] Metadados preparados:', metadata);
    console.log('🔍 [UPLOAD] Chamando processPdfFile...');

    // Processar o arquivo PDF
    const result = await processPdfFile(file, metadata);

    console.log('🔍 [UPLOAD] Resultado do processamento:', result);

    return result;
  } catch (error) {
    console.error('❌ [UPLOAD] Erro ao processar upload de PDF:', error);
    return {
      success: false,
      message: 'Erro ao processar o upload do arquivo',
    };
  }
}
