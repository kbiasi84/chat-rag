import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../connection';
import { vote } from '../../schema';

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

export async function deleteVotesByChatId(chatId: string) {
  try {
    return await db.delete(vote).where(eq(vote.chatId, chatId));
  } catch (error) {
    console.error('Failed to delete votes by chat id from database', error);
    throw error;
  }
}

export async function deleteVotesByMessageIds({
  chatId,
  messageIds,
}: {
  chatId: string;
  messageIds: string[];
}) {
  try {
    if (messageIds.length > 0) {
      return await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );
    }
  } catch (error) {
    console.error('Failed to delete votes by message ids from database', error);
    throw error;
  }
}
