import { useState, useEffect } from 'react';
import { useScrollToBottom } from './use-scroll-to-bottom';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

export function useMessages({
  chatId,
  status,
  messages,
}: {
  chatId: string;
  status: UseChatHelpers['status'];
  messages?: Array<UIMessage>;
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    setUserMessageRef,
    userMessageRef,
    scrollToUserMessage,
    hasSentMessage,
  } = useScrollToBottom(status, messages);

  const [prevStatus, setPrevStatus] =
    useState<UseChatHelpers['status']>(status);

  const [prevChatId, setPrevChatId] = useState(chatId);

  // Este efeito só rola para o final quando mudamos de chat e não temos mensagens
  useEffect(() => {
    if (chatId !== prevChatId) {
      setPrevChatId(chatId);

      // Só rolamos para o final automaticamente em dois casos:
      // 1. O chat está vazio (não tem mensagens)
      // 2. Estamos carregando um chat pela primeira vez
      if (!messages || messages.length === 0) {
        // Quando mudamos para um chat vazio, rolamos instantaneamente para o final
        scrollToBottom('instant');
      }
    }
  }, [chatId, prevChatId, scrollToBottom, messages]);

  // Detectar mudança de status
  useEffect(() => {
    setPrevStatus(status);
  }, [status]);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
    setUserMessageRef,
    userMessageRef,
    scrollToUserMessage,
  };
}
