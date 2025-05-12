import { and, desc, eq, gt, lt } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { db } from '../connection';
import { deleteVotesByChatId } from '../vote';
import { chat, message, type Chat } from '../../schema';

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
    // Usar transação para garantir que tudo seja deletado ou nada
    await db.transaction(async (tx) => {
      try {
        // 1. Deletar votos relacionados ao chat
        // Se não houver votos, isso deve completar sem erro
        await deleteVotesByChatId(id);
      } catch (voteError) {
        // Log do erro, mas continue com a exclusão
        console.warn(`Aviso ao deletar votos para o chat ${id}:`, voteError);
        // Não lançar o erro para não interromper a transação
      }

      // 2. Deletar mensagens do chat - continua mesmo se não houver mensagens
      await tx.delete(message).where(eq(message.chatId, id));

      // 3. Deletar o chat
      await tx.delete(chat).where(eq(chat.id, id));
    });

    console.log(`Chat ${id} e suas dependências foram deletados com sucesso.`);
    return true;
  } catch (error) {
    console.error('Failed to delete chat by id from database', error);
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

export async function updateChatTitle({
  id,
  title,
}: { id: string; title: string }) {
  try {
    await db
      .update(chat)
      .set({
        title,
        // Opcional: atualizar também a data de atualização se você tiver esse campo
        // updatedAt: new Date()
      })
      .where(eq(chat.id, id));

    console.log(`Título do chat ${id} atualizado para: ${title}`);
    return true;
  } catch (error) {
    console.error(
      'Falha ao atualizar título do chat no banco de dados:',
      error,
    );
    throw error;
  }
}
