// Server Component - não precisa do 'use client'
import { ChatViewer } from './chat-view';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Componente principal da página (Server Component)
export default async function PublicChatPage({ params }: PageProps) {
  const { id: chatId } = await params;
  
  // Renderizar o componente cliente
  return <ChatViewer chatId={chatId} />;
} 