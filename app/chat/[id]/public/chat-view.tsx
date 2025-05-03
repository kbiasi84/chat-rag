'use client';

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PublicMarkdown } from './markdown-public';
import Link from 'next/link';

// Tipos para as mensagens do chat
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

// Tipo para os dados do chat
interface ChatData {
  id: string;
  title: string;
  messages: ChatMessage[];
}

// Componente de Logo com fallback
function LogoWithFallback() {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="size-20 bg-gray-200 flex items-center justify-center rounded">
        <span className="text-sm font-semibold">ChatDP</span>
      </div>
    );
  }

  return (
    <div className="size-20 relative">
      <Image 
        src="/logos/logo-ChatDP-preta.png" 
        alt="Logo ChatDP" 
        fill
        className="object-contain"
        onError={() => setImageError(true)}
        priority
      />
    </div>
  );
}

// Componente para exibir o Avatar da consultora
function ConsultoraAvatar() {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="size-10 bg-gray-200 flex items-center justify-center rounded-full">
        <span className="text-xs font-semibold">DP</span>
      </div>
    );
  }

  return (
    <div className="size-10 relative">
      <Image 
        src="/char/consultora.png" 
        alt="Consultora DP" 
        fill
        className="rounded-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

// Interface para receber o ID do chat como prop
interface ChatViewerProps {
  chatId: string;
}

// Componente cliente para exibição do chat
export function ChatViewer({ chatId }: ChatViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [chatNotAvailable, setChatNotAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchChatData() {
      try {
        const response = await fetch(`/api/public-chat/${chatId}`);
        
        if (!isMounted) return;
        
        if (!response.ok) {
          if (response.status === 404) {
            setChatNotAvailable(true);
            setLoading(false);
            return;
          }
          throw new Error('Erro ao carregar o chat');
        }

        const data = await response.json();
        setChatData(data);
      } catch (err) {
        console.error('Erro:', err);
        if (isMounted) {
          setError('Não foi possível carregar este chat');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchChatData();
    
    return () => {
      isMounted = false;
    };
  }, [chatId]);

  if (chatNotAvailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="max-w-md">
          <div className="flex justify-center mb-6">
            <LogoWithFallback />
          </div>
          <h2 className="text-2xl font-semibold mb-4">Chat não disponível</h2>
          <p className="text-muted-foreground mb-8">
            Esse chat não está mais disponível ou foi excluído, entre em contato com seu Consultor.
          </p>
          <Link 
            href="https://chatdp.com.br" 
            className="bg-black text-white px-4 py-2 rounded-md inline-block hover:bg-gray-800 transition"
          >
            Ir para página do ChatDP
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-6">
            <LogoWithFallback />
          </div>
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            <h2 className="font-semibold mb-2">Erro</h2>
            <p>{error}</p>
            <Link 
              href="https://chatdp.com.br" 
              className="bg-black text-white px-4 py-2 rounded-md inline-block mt-4 hover:bg-gray-800 transition"
            >
              Ir para página do ChatDP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <LogoWithFallback />
          </div>
          <div className="animate-spin rounded-full size-12 border-y-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Mensagens do chat */}
      <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
        {chatData?.messages.map((message) => (
          <div 
            key={message.id} 
            className={`mb-8 ${
              message.role === 'user' 
                ? 'flex justify-end' 
                : 'flex'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="mr-3 shrink-0 self-start">
                <ConsultoraAvatar />
              </div>
            )}
            
            <div
              className={`p-4 ${
                message.role === 'user' 
                  ? 'bg-black text-white max-w-[75%] rounded-2xl rounded-tr-sm shadow-sm' 
                  : 'max-w-[75%] rounded-2xl rounded-tl-sm bg-transparent'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-blue-600">
                  <PublicMarkdown>{message.content}</PublicMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 