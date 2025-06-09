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
  updateChatTitle,
} from '@/lib/db/queries/chat';
import { saveMessages } from '@/lib/db/queries/message';
import {
  incrementConsultasUsadas,
  decrementConsultasUsadas,
} from '@/lib/db/queries/subscription';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getKnowledgeInfo } from '@/lib/ai/tools/query-knowledge-base';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import {
  sendKnowledgeInclusionRequest,
  createKnowledgeRequest,
} from '@/lib/email-incluir-base';

export const maxDuration = 60;

// Função auxiliar para extrair texto das parts de forma segura
function extractTextFromParts(parts: UIMessage['parts']): string {
  if (!parts) return '';

  return parts
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      // Verificar se a part tem propriedade text (TextUIPart)
      if ('text' in part && typeof part.text === 'string') {
        return part.text;
      }
      // Para outros tipos de parts, retornar string vazia
      return '';
    })
    .join(' ');
}

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

    // 🎯 ESTRATÉGIA DE COBRANÇA JUSTA:
    // Incrementamos imediatamente para evitar abuso (múltiplas chamadas simultâneas)
    // Mas decrementamos no onFinish se a resposta não foi útil (sem contexto da base)
    await incrementConsultasUsadas(session.user.id);

    const chat = await getChatById({ id });

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

    return createDataStreamResponse({
      execute: (dataStream) => {
        const prompt = systemPrompt();

        const fallbackOrder = [
          { key: 'chat-dp', name: 'o4-mini' },
          { key: 'gpt-4.1-mini', name: 'gpt-4.1-mini' },
        ];

        const doStreamCascade = async (options: any) => {
          let lastError = null;
          console.log(
            '🔄 [FALLBACK] Iniciando cascade de modelos:',
            fallbackOrder.map((m) => m.name),
          );

          for (const model of fallbackOrder) {
            try {
              console.log(
                `🤖 [FALLBACK] Tentando modelo: ${model.name} (${model.key})`,
              );

              if (model.key === 'chat-dp') {
                const result = await myProvider
                  .languageModel('chat-dp')
                  .doStream(options);
                console.log(`✅ [FALLBACK] Sucesso com modelo: ${model.name}`);
                return result;
              } else {
                const { openai } = await import('@ai-sdk/openai');
                const result = await openai(model.name).doStream(options);
                console.log(`✅ [FALLBACK] Sucesso com modelo: ${model.name}`);
                return result;
              }
            } catch (err: any) {
              console.error(`❌ [FALLBACK] Erro no modelo ${model.name}:`, {
                message: err?.message,
                status: err?.status,
                code: err?.code,
                type: err?.type,
                stack: err?.stack?.split('\n')[0],
              });

              lastError = err;
              if (
                err?.message?.toLowerCase().includes('rate limit') ||
                err?.message?.toLowerCase().includes('quota exceeded') ||
                err?.message?.toLowerCase().includes('too many requests') ||
                err?.status === 429 ||
                err?.status === 503
              ) {
                console.log(
                  `🔄 [FALLBACK] Rate limit detectado em ${model.name}, tentando próximo modelo...`,
                );
                continue;
              } else {
                console.error(
                  `🚨 [FALLBACK] Erro não relacionado a rate limit em ${model.name}, interrompendo cascade`,
                );
                throw err;
              }
            }
          }
          console.error(
            '🚨 [FALLBACK][STREAM] Todos os modelos falharam. Último erro:',
            lastError,
          );
          throw new Error(
            'Todos os modelos estão em alta demanda. Por favor, aguarde alguns minutos e tente novamente.',
          );
        };

        const originalModel = {
          ...myProvider.languageModel('chat-dp'),
          doStream: doStreamCascade,
        };

        // Enviar apenas a mensagem atual do usuário, sem histórico
        const userContent = extractTextFromParts(userMessage.parts || []);
        const currentMessages = [
          {
            role: 'user' as const,
            content: userContent,
          },
        ];

        console.log('📝 [CHAT] Pergunta do usuário:', userContent);
        console.log('💭 [CHAT] Iniciando streamText com modelo principal...');

        const result = streamText({
          model: originalModel,
          system: prompt,
          messages: currentMessages,
          maxSteps: 2,
          experimental_activeTools: ['getKnowledgeInfo'],
          experimental_transform: smoothStream({
            chunking: 'word',
            delayInMs: 15,
          }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getKnowledgeInfo,
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

                // Verificar se a resposta indica que não foi encontrada informação na base de conhecimento
                const assistantContent = extractTextFromParts(
                  assistantMessage.parts || [],
                );

                const isKnowledgeNotFound = assistantContent.includes(
                  'Ainda não fui treinada com esse conhecimento específico para suporte',
                );

                // 🎯 NOVA LÓGICA: Se não encontrou conhecimento, DECREMENTAR contador e enviar email
                if (isKnowledgeNotFound) {
                  try {
                    // Decrementar o contador - devolver a consulta ao usuário
                    await decrementConsultasUsadas(session.user.id);

                    console.log(
                      `📉 Consulta decrementada para usuário ${session.user.id} - resposta sem contexto da base de conhecimento`,
                    );

                    const userQuestion = extractTextFromParts(
                      userMessage.parts || [],
                    );

                    const knowledgeRequest = createKnowledgeRequest(
                      userQuestion,
                      {
                        userEmail: session.user.email || undefined,
                        userId: session.user.id,
                        sessionId: id, // usando o chatId como sessionId
                      },
                    );

                    // Enviar email de forma assíncrona para não bloquear a resposta
                    sendKnowledgeInclusionRequest(knowledgeRequest).catch(
                      (emailError) => {
                        console.error(
                          'Erro ao enviar email de solicitação de conhecimento:',
                          emailError,
                        );
                      },
                    );

                    console.log(
                      `📧 Email de solicitação de conhecimento enviado para pergunta: ${userQuestion.substring(0, 100)}...`,
                    );
                  } catch (emailError) {
                    console.error(
                      'Erro ao processar envio de email de conhecimento:',
                      emailError,
                    );
                  }
                } else {
                  // ✅ Resposta útil - manter o incremento do contador
                  console.log(
                    `📈 Consulta válida contabilizada para usuário ${session.user.id} - resposta com contexto da base de conhecimento`,
                  );
                }

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
      },
      onError: (error: unknown) => {
        console.error('🚨 [STREAM] Erro durante o streaming:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : 'N/A',
          type: typeof error,
          timestamp: new Date().toISOString(),
        });
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    console.error('🚨 [CHAT] Erro geral no processamento:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : 'N/A',
      type: typeof error,
      timestamp: new Date().toISOString(),
    });

    return new Response('An error occurred while processing your request!', {
      status: 500,
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
    return new Response('Ocorreu um erro ao processar sua solicitação', {
      status: 500,
    });
  }
}
