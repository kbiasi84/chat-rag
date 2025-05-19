'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages, useMessagesScroll } from './messages';
import type { VisibilityType } from './visibility-selector';
import { toast } from 'sonner';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from '@/components/sidebar/sidebar-history';
import { useQueryLimit } from '../providers/query-limit-provider';
import { ScrollToBottomButton } from './scroll-to-bottom-button';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { verificarConsulta } = useQueryLimit();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      // Verificar se é um erro de limite de consultas
      if (error.message && typeof error.message === 'string') {
        // Se contiver informação sobre limite, atualizar o estado do provider
        if (
          error.message.includes('Limite de consultas atingido') ||
          error.message.includes('limite de consultas')
        ) {
          // Chamar verificarConsulta para atualizar o estado no provider
          verificarConsulta();

          // Não exibir toast aqui, pois já está sendo exibido no QueryLimitProvider
          return;
        }
      }

      // Para outros erros, manter o comportamento padrão, quando vai dar erro de rate limit
      toast.error(
        'Alta demanda de consultas no momento! Aguarde alguns instantes.',
      );
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments] = useState<Array<Attachment>>([]);

  // Obter o estado de rolagem das mensagens
  const { isAtBottom, scrollToBottom } = useMessagesScroll(id, status);

  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background">
      <ChatHeader
        chatId={id}
        selectedModelId={selectedChatModel}
        selectedVisibilityType={selectedVisibilityType}
        isReadonly={isReadonly}
      />

      <div className="flex-1 overflow-y-auto">
        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={false}
        />
      </div>

      <div className="relative">
        {/* Botão de rolagem centralizado com o MultimodalInput */}
        <ScrollToBottomButton
          isAtBottom={isAtBottom}
          scrollToBottom={scrollToBottom}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>
    </div>
  );
}
