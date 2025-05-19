'use client';

import { useChat } from '@ai-sdk/react';

// Este componente simplificado gerencia o stream de dados para o chat
export function DataStreamHandler({ id }: { id: string }) {
  // useChat é necessário para inicializar o stream de dados
  const { data: dataStream } = useChat({ id });

  // Este componente não renderiza nada na UI
  // Serve apenas para inicializar a conexão de chat
  return null;
}
