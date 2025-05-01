import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  incrementConsultasUsadas,
  updateChatTitle,
} from '@/lib/db/queries';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import {
  getKnowledgeInfo,
  analyzeQuery,
  addToKnowledgeBase,
} from '@/lib/ai/tools/query-knowledge-base';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return Response.json({ error: 'No user message found' }, { status: 400 });
    }

    const resultado = await verificarLimiteConsulta(session.user.id);
    if (!resultado.permitido) {
      return Response.json(
        {
          error: 'Limite de consultas atingido',
          mensagem: resultado.mensagem,
          redirecionarParaPlanos: false,
          consultasRestantes: resultado.consultasRestantes,
          plano: resultado.plano,
        },
        { status: 403 },
      );
    }

    await incrementConsultasUsadas(session.user.id);

    const chat = await getChatById({ id });

    try {
      if (!chat) {
        const title = await generateTitleFromUserMessage({
          message: userMessage,
        });

        await saveChat({ id, userId: session.user.id, title });
      } else {
        if (chat.userId !== session.user.id) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      await saveMessages({
        messages: [
          {
            chatId: id,
            id: userMessage.id,
            role: 'user',
            parts: userMessage.parts,
            attachments: userMessage.experimental_attachments ?? [],
            createdAt: new Date(),
          },
        ],
      });
    } catch (dbError) {
      console.error('Erro ao interagir com o banco de dados:', dbError);
      throw dbError;
    }

    return createDataStreamResponse({
      execute: (dataStream) => {
        try {
          const prompt = systemPrompt();

          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: prompt,
            messages,
            maxSteps: 5,
            experimental_activeTools: [
              'analyzeQuery',
              'getKnowledgeInfo',
              'addToKnowledgeBase',
            ],
            experimental_transform: smoothStream({
              chunking: 'word',
              delayInMs: 15,
            }),
            experimental_generateMessageId: generateUUID,
            tools: {
              analyzeQuery,
              getKnowledgeInfo,
              addToKnowledgeBase,
            },
            onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [userMessage],
                    responseMessages: response.messages,
                  });

                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId: id,
                        role: assistantMessage.role,
                        parts: assistantMessage.parts,
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                      },
                    ],
                  });
                } catch (saveError) {
                  console.error('Falha ao salvar o chat:', saveError);
                }
              }
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          result.consumeStream();
          result.mergeIntoDataStream(dataStream);
        } catch (streamError) {
          console.error('Erro durante o streaming da resposta:', streamError);
          throw streamError;
        }
      },
      onError: (error) => {
        console.error('Erro no DataStream:', error);
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    console.error('Erro geral na rota de API do chat:', error);
    return new Response('An error occurred while processing your request!', {
      status: 404,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('ID é obrigatório', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (!chat) {
      return new Response('Chat não encontrado', { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return new Response('Não autorizado', { status: 401 });
    }

    const body = await request.json();

    if (
      !body.title ||
      typeof body.title !== 'string' ||
      body.title.trim() === ''
    ) {
      return new Response('Título inválido', { status: 400 });
    }

    await updateChatTitle({ id, title: body.title.trim() });

    return new Response('Título atualizado com sucesso', { status: 200 });
  } catch (error) {
    console.error('Erro ao atualizar título do chat:', error);
    return new Response('Ocorreu um erro ao processar sua solicitação', {
      status: 500,
    });
  }
}
