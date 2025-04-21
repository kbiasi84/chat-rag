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
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getWeather } from '@/lib/ai/tools/get-weather';
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
    console.log('Iniciando processamento da requisição de chat');

    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    console.log(`Chat ID: ${id}, Modelo selecionado: ${selectedChatModel}`);
    console.log(`Número de mensagens: ${messages.length}`);

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      console.error(
        'Erro de autenticação: sessão inválida ou usuário não autenticado',
      );
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`Usuário autenticado: ${session.user.id}`);

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      console.error('Erro: Nenhuma mensagem do usuário encontrada');
      return new Response('No user message found', { status: 400 });
    }

    console.log(
      `Última mensagem do usuário: ${JSON.stringify(userMessage.parts)}`,
    );

    const chat = await getChatById({ id });

    try {
      if (!chat) {
        console.log('Criando novo chat...');
        const title = await generateTitleFromUserMessage({
          message: userMessage,
        });

        console.log(`Título gerado para o chat: ${title}`);
        await saveChat({ id, userId: session.user.id, title });
      } else {
        console.log(`Chat existente encontrado: ${chat.id}`);
        if (chat.userId !== session.user.id) {
          console.error(
            `Erro de autorização: usuário ${session.user.id} tentando acessar chat de ${chat.userId}`,
          );
          return new Response('Unauthorized', { status: 401 });
        }
      }

      console.log('Salvando mensagem do usuário...');
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
      console.log('Mensagem do usuário salva com sucesso');
    } catch (dbError) {
      console.error('Erro ao interagir com o banco de dados:', dbError);
      throw dbError;
    }

    console.log('Iniciando stream de resposta...');
    return createDataStreamResponse({
      execute: (dataStream) => {
        try {
          console.log('Executando stream de resposta...');

          // Utilizando o prompt do sistema diretamente
          const prompt = systemPrompt();
          console.log('Prompt do sistema obtido');

          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: prompt,
            messages,
            maxSteps: 5,
            experimental_activeTools:
              selectedChatModel === 'chat-model-reasoning'
                ? []
                : [
                    'getWeather',
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
              getWeather,
              analyzeQuery,
              getKnowledgeInfo,
              addToKnowledgeBase,
            },
            onFinish: async ({ response }) => {
              console.log('Resposta do modelo completa');
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    console.error(
                      'Erro: Nenhuma mensagem do assistente encontrada na resposta',
                    );
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [userMessage],
                    responseMessages: response.messages,
                  });

                  console.log('Salvando mensagem do assistente...');
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
                  console.log('Mensagem do assistente salva com sucesso');
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

          console.log('Stream de texto iniciado');
          result.consumeStream();

          console.log('Mesclando no DataStream');
          result.mergeIntoDataStream(dataStream, {
            sendReasoning: false, // Para false para não expor o raciocínio interno
          });
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
