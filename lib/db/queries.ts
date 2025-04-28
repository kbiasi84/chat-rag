import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm'; // Corrigido para importar SQL como tipo
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  document,
  suggestion,
  message,
  vote,
  subscription,
  payment,
  // Importação dos tipos correta
  type User,
  type Chat,
  type Suggestion,
  type DBMessage,
  type Subscription,
  type Payment,
  PLANOS,
  LIMITES_CONSULTA,
} from './schema';

// Definindo o tipo ArtifactKind localmente
type ArtifactKind = 'text' | 'code' | 'image' | 'sheet';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    // Selecionando campos explicitamente para garantir que todos sejam retornados
    const result = await db
      .select({
        id: user.id,
        email: user.email,
        nome: user.nome,
        senha: user.senha,
        whatsapp: user.whatsapp,
        atividade: user.atividade,
        perfil: user.perfil,
        criadoEm: user.criadoEm,
        atualizadoEm: user.atualizadoEm,
      })
      .from(user)
      .where(eq(user.email, email));

    console.log(
      'getUser - Resultado completo:',
      JSON.stringify(result, null, 2),
    );
    return result;
  } catch (error) {
    console.error('Falha ao buscar usuário no banco de dados:', error);
    throw new Error('Falha ao buscar usuário no banco de dados');
  }
}

export async function createUser(
  nome: string,
  email: string,
  whatsapp: string,
  atividade: string,
  senha: string,
  perfil = 'usuario', // Valor padrão, se não for fornecido
): Promise<string> {
  const salt = genSaltSync(10);
  const hash = hashSync(senha, salt);

  try {
    console.log('createUser - Criando usuário com os dados:', {
      nome,
      email,
      whatsapp,
      atividade,
      perfil,
    });

    const [result] = await db
      .insert(user)
      .values({
        nome,
        email,
        whatsapp,
        atividade,
        senha: hash,
        perfil, // Definindo explicitamente o perfil
      })
      .returning({ id: user.id });

    // Buscar o usuário recém-criado para confirmar todos os campos
    const novoUsuario = await getUser(email);
    console.log(
      'createUser - Usuário criado:',
      JSON.stringify(novoUsuario, null, 2),
    );

    return result.id;
  } catch (error) {
    console.error('Falha ao gravar usuário no banco de dados:', error);

    // Verificar se é um erro de restrição única (usuário já existe)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('duplicate key')
    ) {
      throw new Error('Este email já está sendo utilizado por outro usuário');
    }

    throw new Error(
      'Não foi possível criar o usuário. Por favor, tente novamente.',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function updateUserProfile(
  userId: string,
  data: {
    nome?: string;
    whatsapp?: string;
    atividade?: string;
  },
) {
  try {
    console.log('Atualizando perfil do usuário:', userId);
    console.log('Dados para atualização:', data);

    // Filtrar campos nulos ou indefinidos
    const filteredData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        filteredData[key] = value;
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return { success: false, message: 'Nenhum dado válido para atualização' };
    }

    // Adicionar timestamp de atualização
    filteredData.atualizadoEm = new Date();

    await db.update(user).set(filteredData).where(eq(user.id, userId));

    return { success: true, message: 'Perfil atualizado com sucesso' };
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Erro ao atualizar perfil' };
  }
}

// Assinaturas e pagamentos

/**
 * Cria uma assinatura gratuita para um novo usuário (3 consultas)
 */
export async function createFreeSubscription(userId: string) {
  try {
    const result = await db.insert(subscription).values({
      userId,
      plano: PLANOS.FREE,
      status: 'active',
    });

    return result;
  } catch (error) {
    console.error('Falha ao criar assinatura gratuita:', error);
    throw new Error('Não foi possível criar a assinatura gratuita');
  }
}

/**
 * Obtém a assinatura atual de um usuário
 */
export async function getUserSubscription(
  userId: string,
): Promise<Subscription | null> {
  try {
    const result = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .orderBy(desc(subscription.criadoEm))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Falha ao buscar assinatura do usuário:', error);
    throw new Error('Não foi possível verificar a assinatura');
  }
}

/**
 * Atualiza uma assinatura existente
 */
export async function updateSubscription(
  subscriptionId: string,
  data: Partial<Omit<Subscription, 'id' | 'userId' | 'criadoEm'>>,
) {
  try {
    return await db
      .update(subscription)
      .set({
        ...data,
        atualizadoEm: new Date(),
      })
      .where(eq(subscription.id, subscriptionId));
  } catch (error) {
    console.error('Falha ao atualizar assinatura:', error);
    throw new Error('Não foi possível atualizar a assinatura');
  }
}

/**
 * Cria ou atualiza uma assinatura com dados do Stripe
 */
export async function upsertSubscription(
  userId: string,
  plano: (typeof PLANOS)[keyof typeof PLANOS],
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  status: Subscription['status'] = 'active',
  terminaEm?: Date,
) {
  try {
    // Verificar se já existe uma assinatura
    const existingSubscription = await getUserSubscription(userId);

    if (existingSubscription) {
      // Verificar se o plano mudou
      const planChanged = existingSubscription.plano !== plano.toLowerCase();

      // Atualizar a assinatura existente
      await db
        .update(subscription)
        .set({
          plano,
          status,
          stripeCustomerId,
          stripeSubscriptionId,
          terminaEm,
          // Zerar a contagem de consultas se o plano mudou
          ...(planChanged ? { consultasUsadas: 0 } : {}),
          atualizadoEm: new Date(),
        })
        .where(eq(subscription.id, existingSubscription.id));

      // Registrar no log se o plano mudou
      if (planChanged) {
        console.log(
          `Plano alterado de ${existingSubscription.plano} para ${plano}. Contagem de consultas zerada.`,
        );
      }

      return existingSubscription.id;
    } else {
      // Criar uma nova assinatura
      const [result] = await db
        .insert(subscription)
        .values({
          userId,
          plano,
          status,
          stripeCustomerId,
          stripeSubscriptionId,
          terminaEm,
          consultasUsadas: 0, // Sempre começa com zero consultas em uma nova assinatura
        })
        .returning({ id: subscription.id });

      return result.id;
    }
  } catch (error) {
    console.error('Falha ao atualizar assinatura com dados do Stripe:', error);
    throw new Error('Não foi possível processar a assinatura');
  }
}

/**
 * Incrementa o contador de consultas usadas
 */
export async function incrementConsultasUsadas(userId: string) {
  try {
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
      throw new Error('Assinatura não encontrada');
    }

    await db
      .update(subscription)
      .set({
        consultasUsadas: userSubscription.consultasUsadas + 1,
        atualizadoEm: new Date(),
      })
      .where(eq(subscription.id, userSubscription.id));

    return userSubscription.consultasUsadas + 1;
  } catch (error) {
    console.error('Falha ao incrementar consultas usadas:', error);
    throw new Error('Não foi possível atualizar o contador de consultas');
  }
}

/**
 * Verifica se o usuário ainda tem consultas disponíveis
 */
export async function checkConsultaDisponivel(
  userId: string,
): Promise<boolean> {
  try {
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
      // Se não tem assinatura, criar uma gratuita
      await createFreeSubscription(userId);
      return true; // Primeira consulta disponível
    }

    // Verificar se a assinatura está ativa
    if (
      userSubscription.status !== 'active' &&
      userSubscription.status !== 'trialing'
    ) {
      return false;
    }

    // Verificar se já ultrapassou o limite de consultas
    const limite =
      LIMITES_CONSULTA[userSubscription.plano as keyof typeof LIMITES_CONSULTA];
    return userSubscription.consultasUsadas < limite;
  } catch (error) {
    console.error('Falha ao verificar disponibilidade de consultas:', error);
    throw new Error('Não foi possível verificar disponibilidade de consultas');
  }
}

/**
 * Registra um pagamento
 */
export async function createPayment(
  userId: string,
  subscriptionId: string,
  valor: number,
  status: Payment['status'],
  stripeInvoiceId?: string,
  dataPagamento?: Date,
  invoiceUrl?: string,
) {
  try {
    await db.insert(payment).values({
      userId,
      subscriptionId,
      valor,
      status,
      stripeInvoiceId,
      dataPagamento,
      invoiceUrl,
    });
  } catch (error) {
    console.error('Falha ao registrar pagamento:', error);
    throw new Error('Não foi possível registrar o pagamento');
  }
}

/**
 * Obtém o histórico de pagamentos de um usuário
 */
export async function getUserPayments(
  userId: string,
  limite = 5,
): Promise<Payment[]> {
  try {
    return await db
      .select()
      .from(payment)
      .where(eq(payment.userId, userId))
      .orderBy(desc(payment.criadoEm))
      .limit(limite);
  } catch (error) {
    console.error('Falha ao buscar histórico de pagamentos:', error);
    throw new Error('Não foi possível buscar o histórico de pagamentos');
  }
}

/**
 * Busca uma assinatura pelo ID do cliente do Stripe
 */
export async function getUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Subscription | null> {
  try {
    const result = await db
      .select()
      .from(subscription)
      .where(eq(subscription.stripeCustomerId, stripeCustomerId))
      .orderBy(desc(subscription.criadoEm))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Falha ao buscar usuário pelo ID do cliente Stripe:', error);
    throw new Error('Não foi possível encontrar o usuário');
  }
}
