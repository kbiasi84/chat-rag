'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { useQueryLimit } from '../providers/query-limit-provider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ArrowUpIcon, StopIcon } from '../common/icons';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const router = useRouter();
  const {
    ultimaConsulta,
    planoAtingido,
    assinaturaCancelada,
    consultasRestantes,
    verificarConsulta,
  } = useQueryLimit();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  // Monitorar mudanças no status para atualizar o limite de consultas após enviar mensagem
  useEffect(() => {
    // Quando o status mudar de 'submitting' para 'submitted', significa que a mensagem foi enviada
    if (status === 'submitted') {
      // Aguardar um pouco para dar tempo da API processar antes de verificar novamente
      const timer = setTimeout(() => {
        // Verificar se tinha apenas 1 consulta restante (última consulta)
        if (ultimaConsulta) {
          // Verificar imediatamente para atualizar os estados (especialmente planoAtingido)
          verificarConsulta().then(() => {
            // Se era a última consulta, interromper o processamento após verificação
            if (status === 'submitted') {
              stop();
            }
          });
        } else {
          verificarConsulta();
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status, verificarConsulta, ultimaConsulta, stop]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Se for a última consulta disponível, verificar logo após o envio
    const isLastQuery = ultimaConsulta;

    handleSubmit(undefined);
    setLocalStorageInput('');
    resetHeight();

    // Se for a última consulta, verificar imediatamente para atualizar o estado
    if (isLastQuery) {
      // Pequeno timeout para dar tempo do servidor processar
      setTimeout(() => {
        verificarConsulta();
      }, 500);
    }

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    handleSubmit,
    setLocalStorageInput,
    width,
    chatId,
    ultimaConsulta,
    verificarConsulta,
  ]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 && (
        <SuggestedActions append={append} chatId={chatId} />
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Pergunte o que você precisa..."
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700',
          className,
        )}
        rows={2}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            // Se a assinatura está cancelada, mostrar mensagem adequada
            if (assinaturaCancelada) {
              toast.error(
                'Sua assinatura foi cancelada. Assine um plano para continuar usando o serviço.',
              );
              return;
            }

            // Se o plano já atingiu o limite, mostrar mensagem adequada
            if (planoAtingido) {
              toast.error(
                'Limite de consultas atingido. Considere atualizar seu plano para continuar.',
              );
              return;
            }

            if (status !== 'ready') {
              toast.error(
                'Por favor, aguarde o modelo finalizar sua resposta!',
              );
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute bottom-0 right-0 p-2 w-full flex flex-row justify-between items-center">
        {(ultimaConsulta || planoAtingido || assinaturaCancelada) && (
          <div
            className={`ml-2 flex-1 ${
              assinaturaCancelada
                ? 'text-red-500'
                : planoAtingido
                  ? 'text-red-500'
                  : 'text-amber-500'
            } text-sm font-medium flex items-center`}
          >
            {assinaturaCancelada ? (
              <span className="flex-1">
                Sua assinatura foi cancelada. Assine um plano para continuar.
              </span>
            ) : planoAtingido ? (
              <span className="flex-1">
                Você atingiu o limite de consultas do seu plano
              </span>
            ) : (
              <span className="flex-1">
                Falta apenas 1 consulta no seu plano
              </span>
            )}
            <Link
              href={assinaturaCancelada ? '/planos' : '/planos?limite=atingido'}
              passHref
              legacyBehavior={false}
            >
              <Button
                variant="outline"
                size="sm"
                className={`ml-2 ${
                  assinaturaCancelada || planoAtingido
                    ? 'border-red-500 hover:bg-red-50 text-red-500'
                    : 'border-amber-500 hover:bg-amber-50 text-amber-500'
                }`}
                type="button"
              >
                {assinaturaCancelada ? 'Assinar plano' : 'Ajustar plano'}
              </Button>
            </Link>
          </div>
        )}

        <div className="ml-auto">
          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              submitForm={submitForm}
              status={status}
              planoAtingido={planoAtingido}
              assinaturaCancelada={assinaturaCancelada}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    return true;
  },
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  status,
  planoAtingido,
  assinaturaCancelada,
}: {
  submitForm: () => void;
  input: string;
  status: UseChatHelpers['status'];
  planoAtingido?: boolean;
  assinaturaCancelada?: boolean;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();

        // Se a assinatura está cancelada, mostrar mensagem adequada
        if (assinaturaCancelada) {
          toast.error(
            'Sua assinatura foi cancelada. Assine um plano para continuar usando o serviço.',
          );
          return;
        }

        // Se o plano já atingiu o limite, mostrar mensagem adequada
        if (planoAtingido) {
          toast.error(
            'Limite de consultas atingido. Considere atualizar seu plano para continuar.',
          );
          return;
        }

        submitForm();
      }}
      disabled={
        input.length === 0 ||
        status !== 'ready' ||
        planoAtingido ||
        assinaturaCancelada
      }
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.planoAtingido !== nextProps.planoAtingido) return false;
  if (prevProps.assinaturaCancelada !== nextProps.assinaturaCancelada)
    return false;
  return true;
});
