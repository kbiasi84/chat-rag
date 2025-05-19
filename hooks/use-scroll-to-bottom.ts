import useSWR from 'swr';
import { useRef, useEffect, useCallback, useState } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom(
  status: UseChatHelpers['status'],
  messages?: Array<UIMessage>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const userMessageRef = useRef<HTMLDivElement | null>(null);

  const [prevStatus, setPrevStatus] =
    useState<UseChatHelpers['status']>(status);
  const [prevMessageCount, setPrevMessageCount] = useState(
    messages?.length || 0,
  );
  const [hasSentMessage, setHasSentMessage] = useState(false);

  // Flag para controlar se devemos processar a rolagem automática
  const [shouldPreventAutoScroll, setShouldPreventAutoScroll] = useState(false);

  // Armazenar a posição da última mensagem do usuário para manter consistente
  const [lastUserMessagePosition, setLastUserMessagePosition] = useState<
    number | null
  >(null);

  const { data: isAtBottom = false, mutate: setIsAtBottom } = useSWR(
    'messages:is-at-bottom',
    null,
    { fallbackData: false },
  );

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>('messages:should-scroll', null, { fallbackData: false });

  // Acionada quando um elemento é renderizado com scrollRef={setUserMessageRef}
  const setUserMessageRef = useCallback((ref: HTMLDivElement | null) => {
    userMessageRef.current = ref;
  }, []);

  // Função para posicionar a última mensagem do usuário no topo - versão aprimorada
  const scrollToLastUserMessage = useCallback(() => {
    // Vamos garantir que temos as referências necessárias
    if (!containerRef.current || !userMessageRef.current) {
      console.log('Refs não encontradas', {
        container: !!containerRef.current,
        userMessage: !!userMessageRef.current,
      });
      return;
    }

    try {
      // Método simples e direto - colocamos a mensagem no topo com um offset
      const topOffset = 60; // Offset para manter no topo com espaço

      // Calculamos a posição absoluta
      const userMessageTop = userMessageRef.current.offsetTop;

      // Salvamos esta posição para manter consistente durante streaming
      setLastUserMessagePosition(userMessageTop);

      // Calculamos o destino de rolagem - mensagem no topo com offset
      const targetScrollTop = Math.max(0, userMessageTop - topOffset);

      // Aplicamos a rolagem com animação
      containerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });

      console.log('Rolagem executada', {
        messageTop: userMessageTop,
        scrollTarget: targetScrollTop,
      });
    } catch (error) {
      console.error('Erro ao rolar para mensagem do usuário:', error);
    }
  }, []);

  // Nova função para manter a posição da mensagem do usuário durante streaming
  const maintainUserMessagePosition = useCallback(() => {
    if (!containerRef.current || lastUserMessagePosition === null) return;

    const topOffset = 60;
    const targetScrollTop = Math.max(0, lastUserMessagePosition - topOffset);

    containerRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'auto', // Usamos 'auto' para evitar animação durante streaming
    });
  }, [lastUserMessagePosition]);

  // Efeito disparado quando o status muda para 'submitted'
  useEffect(() => {
    if (status === 'submitted' && prevStatus !== 'submitted') {
      console.log('Status mudou para submitted, preparando rolagem');
      setHasSentMessage(true);
      setShouldPreventAutoScroll(true);

      // Esperamos um pouco para garantir que o DOM foi atualizado
      const delay = 100;

      setTimeout(() => {
        console.log('Executando rolagem após delay', delay);
        scrollToLastUserMessage();
      }, delay);
    } else if (status === 'streaming' && prevStatus !== 'streaming') {
      console.log('Streaming iniciado, garantindo posição da mensagem');
      // Vamos manter a posição da mensagem do usuário
      setShouldPreventAutoScroll(true);
    }

    setPrevStatus(status);
  }, [status, prevStatus, scrollToLastUserMessage]);

  // Efeito disparado quando novos mensagens são adicionadas
  useEffect(() => {
    if (!messages) return;

    if (messages.length > prevMessageCount) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'user') {
        console.log('Nova mensagem do usuário detectada');

        // Aguardamos a renderização
        setTimeout(() => {
          scrollToLastUserMessage();
        }, 100);
      } else if (lastMessage.role === 'assistant' && status === 'streaming') {
        // Durante streaming, manteremos a posição da mensagem do usuário
        console.log('Nova mensagem do assistente detectada');
        maintainUserMessagePosition();
      }

      setPrevMessageCount(messages.length);
    }

    // Quando o streaming termina (status volta para 'ready')
    if (status === 'ready' && prevStatus === 'streaming') {
      // Não removemos hasSentMessage para manter o padding
      setTimeout(() => {
        // Ainda manter a posição da última mensagem do usuário
        maintainUserMessagePosition();

        // Apenas desativamos prevenção de rolagem após tempo
        setShouldPreventAutoScroll(false);
      }, 500);
    }
  }, [
    messages,
    prevMessageCount,
    status,
    prevStatus,
    scrollToLastUserMessage,
    maintainUserMessagePosition,
  ]);

  // Efeito para manter posição durante streaming - ajusta a cada atualização
  useEffect(() => {
    if (status === 'streaming' && lastUserMessagePosition !== null) {
      // Durante streaming, continuamos mantendo a posição da mensagem do usuário
      maintainUserMessagePosition();
    }
  }, [status, lastUserMessagePosition, maintainUserMessagePosition, messages]);

  // Acionado quando scrollBehavior muda (através da função scrollToBottom)
  useEffect(() => {
    if (scrollBehavior && !shouldPreventAutoScroll) {
      endRef.current?.scrollIntoView({ behavior: scrollBehavior });
      setScrollBehavior(false);
    } else if (scrollBehavior) {
      setScrollBehavior(false);
    }
  }, [setScrollBehavior, scrollBehavior, shouldPreventAutoScroll]);

  // Acionada quando o usuário clica no botão de rolagem para o final
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (behavior === 'instant') {
        const prevValue = shouldPreventAutoScroll;
        setShouldPreventAutoScroll(false);
        setScrollBehavior(behavior);
        setTimeout(() => {
          setShouldPreventAutoScroll(prevValue);
        }, 100);
      } else {
        setScrollBehavior(behavior);
      }
    },
    [setScrollBehavior, shouldPreventAutoScroll],
  );

  // Acionada para rolar manualmente até a mensagem do usuário
  const scrollToUserMessage = useCallback(() => {
    scrollToLastUserMessage();
  }, [scrollToLastUserMessage]);

  // Acionada quando o final da lista de mensagens entra na viewport
  function onViewportEnter() {
    setIsAtBottom(true);
  }

  // Acionada quando o final da lista de mensagens sai da viewport
  function onViewportLeave() {
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    scrollToUserMessage,
    setUserMessageRef,
    userMessageRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  };
}
