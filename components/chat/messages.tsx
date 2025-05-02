import type { UIMessage } from 'ai';
import { PreviewMessage } from './message';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { Greeting } from './greeting';
import { memo } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  // Verificar se há alguma mensagem do assistente com conteúdo
  const hasAssistantMessageWithContent = messages.some(
    (msg) =>
      msg.role === 'assistant' && msg.content && msg.content.trim() !== '',
  );

  // Mostrar indicador de carregamento apenas se:
  // 1. O status for 'submitted' ou 'streaming'
  // 2. E não houver nenhuma mensagem do assistente com conteúdo
  const showLoadingIndicator =
    (status === 'submitted' || status === 'streaming') &&
    !hasAssistantMessageWithContent;

  // Criar uma mensagem de carregamento quando necessário
  const messagesWithLoading = [...messages];

  // Adicionar uma mensagem de carregamento temporária se necessário
  if (showLoadingIndicator && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    // Só adicionar se a última mensagem for do usuário
    if (lastMessage.role === 'user') {
      messagesWithLoading.push({
        id: 'loading-message',
        role: 'assistant',
        content: '',
        parts: [],
      });
    }
  }

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {messages.length === 0 && <Greeting />}

      {messagesWithLoading.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' || message.id === 'loading-message'}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          status={status}
        />
      ))}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});
