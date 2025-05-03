'use client';

import { Chat } from '@/components/chat/chat';
import { DataStreamHandler } from '@/components/chat/data-stream-handler';
import { MockQueryLimitProvider } from '@/components/providers/mock-query-limit-provider';
import type { UIMessage } from 'ai';

export function PublicChatViewer({
  id,
  initialMessages,
  selectedChatModel,
}: {
  id: string;
  initialMessages: UIMessage[];
  selectedChatModel: string;
}) {
  return (
    <MockQueryLimitProvider>
      <div className="flex flex-col min-h-screen">
        <div className="bg-muted py-2 px-4 text-center">
          <p className="text-sm">
            Você está visualizando um chat compartilhado publicamente.
          </p>
        </div>

        <Chat
          id={id}
          initialMessages={initialMessages}
          selectedChatModel={selectedChatModel}
          selectedVisibilityType="public"
          isReadonly={true} // Sempre readonly para visualização pública
        />
        <DataStreamHandler id={id} />
      </div>
    </MockQueryLimitProvider>
  );
}
