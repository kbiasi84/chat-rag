'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { Plus, Share2, Check } from 'lucide-react';
import { memo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ModelSelector } from '@/components/chat/model-selector';
import { SidebarToggle } from '@/components/sidebar/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { useSidebar } from '../ui/sidebar';
import { VisibilitySelector } from './visibility-selector';
import type { VisibilityType } from './visibility-selector';
import { toast } from 'sonner';
import { useChatVisibility } from '@/hooks/use-chat-visibility';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const [copied, setCopied] = useState(false);

  // Usar o hook useChatVisibility para obter o estado atual de visibilidade
  const { visibilityType } = useChatVisibility({
    chatId,
    initialVisibility: selectedVisibilityType,
  });

  // Função para compartilhar o chat
  const handleShareChat = async () => {
    // Só permite compartilhar se o chat for público
    if (visibilityType !== 'public') {
      toast.error('Altere a visibilidade para público antes de compartilhar');
      return;
    }

    // URL de compartilhamento público
    const shareUrl = `${window.location.origin}/chat/${chatId}/public`;

    try {
      // Tentar usar a API de compartilhamento nativa, se disponível
      if (navigator.share) {
        await navigator.share({
          title: 'Chat compartilhado',
          text: 'Confira este chat!',
          url: shareUrl,
        });
        return;
      }

      // Copiar para a área de transferência se a API de compartilhamento não estiver disponível
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');

      // Resetar o estado após 2 segundos
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast.error('Não foi possível compartilhar o link');
    }
  };

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <Plus size={16} />
              <span className="md:sr-only">Novo Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Novo Chat</TooltipContent>
        </Tooltip>
      )}

      {!isReadonly && (
        <ModelSelector
          selectedModelId={selectedModelId}
          className="order-1 md:order-2"
        />
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-3"
        />
      )}

      {/* Botão de compartilhamento */}
      {!isReadonly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-1 md:order-4 md:px-2 px-2 md:h-[34px]"
              onClick={handleShareChat}
              disabled={visibilityType !== 'public'}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              <span className="md:sr-only">
                {copied ? 'Copiado!' : 'Compartilhar'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {visibilityType === 'public'
              ? 'Compartilhar link do chat'
              : 'Altere a visibilidade para público para compartilhar'}
          </TooltipContent>
        </Tooltip>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType
  );
});
