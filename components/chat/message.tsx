'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Vote } from '@/lib/db/schema';
import { Markdown } from '../editor/markdown';
import { MessageActions } from './message-actions';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import Image from 'next/image';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  status,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  status?: UseChatHelpers['status'];
}) => {
  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'group-data-[role=user]/message:w-fit': true,
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-10 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background overflow-hidden">
              <Image
                src="/char/consultora.png"
                alt="Consultora"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {/* Se for uma mensagem de assistente em carregamento, mostrar o texto de carregamento apropriado */}
            {message.role === 'assistant' &&
              isLoading &&
              (!message.content || message.content.trim() === '') && (
                <div className="flex flex-col gap-4 text-muted-foreground">
                  {status === 'submitted'
                    ? 'Pensando...'
                    : 'Organizando meus pensamentos...'}
                </div>
              )}

            {/* Renderizar o conteúdo normal da mensagem */}
            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'text') {
                return (
                  <div key={key} className="flex flex-row gap-2 items-start">
                    <div
                      data-testid="message-content"
                      className={cn('flex flex-col gap-4', {
                        'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                          message.role === 'user',
                      })}
                    >
                      <Markdown>{part.text}</Markdown>
                    </div>
                  </div>
                );
              }

              // Outros tipos de partes são ignorados silenciosamente
              return null;
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-10 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border overflow-hidden">
          <Image
            src="/char/consultora.png"
            alt="Consultora"
            width={40}
            height={40}
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Pensando...
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ProcessingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-processing"
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-10 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border overflow-hidden">
          <Image
            src="/char/consultora.png"
            alt="Consultora"
            width={40}
            height={40}
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Organizando meus pensamentos...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
