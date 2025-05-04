import { db } from '../connection';
import { deleteVotesByChatId } from '../vote';
import { eq } from 'drizzle-orm';
import { chat, message } from '../../schema';

/**
 * Deleta um chat e todas as suas dependências (mensagens e votos) em uma única transação
 */
export async function deleteChatAndDependencies(chatId: string): Promise<void> {
  try {
    // Usar transação para garantir que tudo seja deletado ou nada
    await db.transaction(async (tx) => {
      // 1. Deletar votos relacionados ao chat
      await deleteVotesByChatId(chatId);

      // 2. Deletar mensagens do chat
      await tx.delete(message).where(eq(message.chatId, chatId));

      // 3. Deletar o chat
      await tx.delete(chat).where(eq(chat.id, chatId));
    });

    console.log(
      `Chat ${chatId} e suas dependências foram deletados com sucesso.`,
    );
  } catch (error) {
    console.error(`Erro ao deletar chat ${chatId} e suas dependências:`, error);
    throw new Error('Não foi possível deletar o chat e suas dependências');
  }
}
