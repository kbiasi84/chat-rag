'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { MoreHorizontalIcon, MessageSquareIcon } from 'lucide-react';
import { forwardRef } from 'react';
import { ChatConfig } from '@/lib/chat/types';
import { Tooltip } from '@/components/ui/tooltip';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/redux';
import { chatActions } from '@/lib/redux/slices/chat-slice';
import { ChatThoughtsToggle } from '@/components/chat/chat-thoughts-toggle';
import { DeleteAllMessagesDialog } from '@/components/chat/delete-all-messages-dialog';
import { ExportDialog } from '@/components/chat/export-dialog';
import { UserAvatar } from '@/components/user-avatar';
import { ShareChatDialog } from '@/components/share-chat-dialog';
import { VisibilitySelector } from './visibility-selector';

import { ModelSelector } from '@/components/chat/model-selector';
import { SidebarToggle } from '@/components/sidebar/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon, VercelIcon } from '../common/icons';
import { useSidebar } from '../ui/sidebar';
import { memo } from 'react';
import { TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { type VisibilityType } from '../visibility-selector';

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
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
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
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});
