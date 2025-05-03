// Server Component - não precisa do 'use client'
import { ChatViewer } from './chat-view';

// Componente principal da página (Server Component)
export default async function PublicChatPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  // Explicitamente aguardar a resolução do objeto params
  const resolvedParams = await Promise.resolve(params);
  const chatId = resolvedParams.id;
  
  // Renderizar o componente cliente
  return <ChatViewer chatId={chatId} />;
} 