import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { NextResponse } from 'next/server';
import type { DBMessage } from '@/lib/db/schema';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    // Extrair o ID do chat diretamente, como é uma função assíncrona, podemos acessar o parâmetro
    const chatId = params.id;

    // Verificar se o chat existe
    const chat = await getChatById({ id: chatId });

    // Se o chat não existir ou não for público, retornar 404
    if (!chat || chat.visibility !== 'public') {
      return NextResponse.json(
        { error: 'Chat não encontrado ou não é público' },
        { status: 404 },
      );
    }

    // Buscar as mensagens do chat
    const messagesFromDb = await getMessagesByChatId({ id: chatId });

    // Processar as mensagens para o formato mais simples
    const processedMessages = messagesFromDb.map((message: DBMessage) => {
      // Extrair o conteúdo das parts
      let content = '';
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (typeof part === 'string') {
            content += part;
          } else if (part && typeof part === 'object' && 'text' in part) {
            content += part.text;
          }
        }
      }

      return {
        id: message.id,
        role: message.role,
        content,
        createdAt: message.createdAt,
      };
    });

    // Retornar os dados do chat e as mensagens
    return NextResponse.json({
      id: chat.id,
      title: chat.title,
      messages: processedMessages,
    });
  } catch (error) {
    console.error('Erro ao buscar chat público:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do chat' },
      { status: 500 },
    );
  }
}
