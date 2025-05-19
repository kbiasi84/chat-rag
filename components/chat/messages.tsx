import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { Greeting } from './greeting';
import { memo, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { useMessages } from '@/hooks/use-messages';
import useSWR from 'swr';
import type { RefObject } from 'react';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  isArtifactVisible,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    setUserMessageRef,
    hasSentMessage,
    isAtBottom,
    scrollToBottom,
    scrollToUserMessage,
  } = useMessages({
    chatId,
    status,
    messages,
  });

  // Gatilho adicional para tentar rolar para a mensagem do usuário
  // quando a última mensagem for do usuário
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      // Esperamos um pouco para garantir que o DOM foi renderizado
      const timer = setTimeout(() => {
        scrollToUserMessage();
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [messages, scrollToUserMessage]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-4 h-full overflow-y-auto py-6 px-4 relative"
    >
      <div
        className="flex flex-col min-w-0 gap-4 grow"
        style={{
          paddingBottom: messages.length > 3 ? 'calc(100vh - 350px)' : '0',
        }}
      >
        {messages.length === 0 && <Greeting />}

        {messages.map((message, index) => {
          const isLastUserMessage =
            message.role === 'user' && index === messages.length - 1;

          return (
            <PreviewMessage
              key={message.id}
              chatId={chatId}
              message={message}
              isLoading={
                status === 'streaming' && messages.length - 1 === index
              }
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              requiresScrollPadding={hasSentMessage && isLastUserMessage}
              scrollRef={isLastUserMessage ? setUserMessageRef : undefined}
            />
          );
        })}

        {/* Lógica refinada para o ThinkingMessage - mais explícita */}
        {(() => {
          // Só mostrar o ThinkingMessage se tivermos mensagens e a última for do usuário
          if (messages.length === 0) return null;
          const lastMessage = messages[messages.length - 1];
          if (status === 'submitted' && lastMessage.role === 'user') {
            return (
              <div className="mt-[-8px]">
                <ThinkingMessage />
              </div>
            );
          }
          return null;
        })()}
      </div>

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[4px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});

// Adicionamos esta exportação para poder acessar o status de isAtBottom e scrollToBottom do componente Chat
export function useMessagesScroll(
  chatId: string,
  status: UseChatHelpers['status'],
  messages?: Array<UIMessage>,
) {
  return useMessages({ chatId, status, messages });
}
