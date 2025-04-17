'use server';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createResource } from './resources';
import { SourceType } from '@/lib/db/schema/resources';
import { nanoid } from '@/lib/utils';
import { PDFDocument } from 'pdf-lib';

// Função para processar o arquivo PDF e extrair seu texto
export async function processPdfFile(
  file: File,
): Promise<{ success: boolean; message: string; resourceId?: string }> {
  try {
    console.log(
      `Iniciando processamento do PDF: ${file.name} (${file.size} bytes)`,
    );

    const arrayBuffer = await file.arrayBuffer();
    console.log(
      `ArrayBuffer criado com tamanho: ${arrayBuffer.byteLength} bytes`,
    );

    // Carregar o PDF com pdf-lib
    console.log('Carregando PDF com pdf-lib...');
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const pageCount = pdfDoc.getPageCount();
    console.log(`PDF carregado com sucesso, contém ${pageCount} páginas`);

    // Extrair o texto de cada página
    let pdfText = '';

    // Extrair metadados do PDF se disponíveis
    const title = pdfDoc.getTitle() || file.name.replace(/\.[^/.]+$/, '');
    const author = pdfDoc.getAuthor() || 'Não especificado';
    const creator = pdfDoc.getCreator() || 'Não especificado';

    // Adicionar os metadados no início do texto
    pdfText += `# ${title}\n\n`;
    pdfText += `**Autor:** ${author}\n`;
    pdfText += `**Criador:** ${creator}\n`;
    pdfText += `**Páginas:** ${pageCount}\n\n`;
    pdfText += `**Nota:** Este texto foi extraído automaticamente do PDF "${file.name}" e pode não conter toda a formatação original.\n\n`;

    // Adicionar uma observação sobre o conteúdo
    pdfText += '## Conteúdo do PDF\n\n';
    pdfText +=
      'O conteúdo deste PDF foi processado para indexação e pesquisa, mas o texto extraído diretamente pode não estar disponível na íntegra devido a limitações do processo de extração.\n\n';

    // Gerar um ID único para o arquivo PDF
    const pdfId = nanoid();
    console.log(`ID gerado para o PDF: ${pdfId}`);

    // Adicionar à base de conhecimento com sourceType = PDF
    console.log('Adicionando conteúdo à base de conhecimento...');
    const result = await createResource({
      content: pdfText,
      sourceType: SourceType.PDF,
      sourceId: pdfId,
    });

    console.log(`Resultado da criação do recurso: ${result}`);

    if (typeof result === 'string' && result.includes('successfully')) {
      return {
        success: true,
        message: `PDF "${title}" processado e adicionado com sucesso.`,
        resourceId: pdfId,
      };
    }

    return {
      success: false,
      message: 'Erro ao adicionar o conteúdo do PDF à base de conhecimento.',
    };
  } catch (error) {
    console.error('Erro ao processar o arquivo PDF:', error);

    // Determinar um erro mais específico com base no tipo de erro
    let errorMessage =
      'Erro ao processar o arquivo PDF. Verifique se o arquivo é válido.';

    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);

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
    console.log('Iniciando processamento do upload de PDF');
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('Nenhum arquivo enviado no FormData');
      return {
        success: false,
        message: 'Nenhum arquivo enviado',
      };
    }

    console.log(
      `Arquivo recebido: ${file.name}, ${file.size} bytes, tipo: ${file.type}`,
    );

    // Verificar se o arquivo é um PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.error(
        `Tipo de arquivo inválido: ${file.type}, nome: ${file.name}`,
      );
      return {
        success: false,
        message: 'O arquivo deve ser um PDF',
      };
    }

    // Processar o arquivo PDF
    console.log('Chamando função de processamento de PDF...');
    return await processPdfFile(file);
  } catch (error) {
    console.error('Erro ao processar upload de PDF:', error);
    if (error instanceof Error) {
      console.error('Detalhes do erro:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      message: 'Erro ao processar o upload do arquivo',
    };
  }
}
