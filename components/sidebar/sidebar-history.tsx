'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import type { User } from 'next-auth';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { ChatItem } from '@/components/sidebar/sidebar-history-item';
import useSWRInfinite from 'swr/infinite';
import { Loader } from 'lucide-react';

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats,
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/history?limit=${PAGE_SIZE}`;

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Estados para edição de título
  const [changeTitleId, setChangeTitleId] = useState<string | null>(null);
  const [showChangeTitleDialog, setShowChangeTitleDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deletando chat...',
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return 'Chat deletado com sucesso';
      },
      error: 'Falha ao deletar chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/');
    }
  };

  // Manipulador para alteração de título
  const handleChangeTitle = async () => {
    if (!changeTitleId || !newTitle.trim()) return;

    setIsUpdatingTitle(true);

    const updatePromise = fetch(`/api/chat?id=${changeTitleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    toast.promise(updatePromise, {
      loading: 'Atualizando título...',
      success: () => {
        // Atualizar o título no array local
        mutate(
          (chatHistories) => {
            if (!chatHistories) return chatHistories;

            const updatedHistories = chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.map((chat) =>
                chat.id === changeTitleId
                  ? { ...chat, title: newTitle.trim() }
                  : chat,
              ),
            }));

            //console.log('Cache atualizado:', updatedHistories);
            return updatedHistories;
          },
          {
            revalidate: false, // Não revalide o cache
            populateCache: true, // Atualize o cache com o novo valor
          },
        );

        // Fechar o dialog e limpar estados
        setShowChangeTitleDialog(false);
        setNewTitle('');
        setChangeTitleId(null);
        setIsUpdatingTitle(false);
        return 'Título atualizado com sucesso';
      },
      error: (err) => {
        setIsUpdatingTitle(false);
        setChangeTitleId(null);
        return 'Falha ao atualizar título';
      },
    });
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Faça login para salvar e revisitar chats anteriores!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Today
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="rounded-md h-8 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Suas conversas aparecerão aqui quando você começar a conversar!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {paginatedChatHistories &&
              (() => {
                const chatsFromHistory = paginatedChatHistories.flatMap(
                  (paginatedChatHistory) => paginatedChatHistory.chats,
                );

                const groupedChats = groupChatsByDate(chatsFromHistory);

                return (
                  <div className="flex flex-col gap-6">
                    {groupedChats.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Hoje
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            key={`${chat.id}-${chat.title}`}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onChangeTitle={(chatId) => {
                              const chat = chatsFromHistory.find(
                                (c) => c.id === chatId,
                              );
                              if (chat) {
                                setNewTitle(chat.title);
                                setChangeTitleId(chatId);
                                setShowChangeTitleDialog(true);
                              }
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Ontem
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            key={`${chat.id}-${chat.title}`}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onChangeTitle={(chatId) => {
                              const chat = chatsFromHistory.find(
                                (c) => c.id === chatId,
                              );
                              if (chat) {
                                setNewTitle(chat.title);
                                setChangeTitleId(chatId);
                                setShowChangeTitleDialog(true);
                              }
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Última Semana
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            key={`${chat.id}-${chat.title}`}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onChangeTitle={(chatId) => {
                              const chat = chatsFromHistory.find(
                                (c) => c.id === chatId,
                              );
                              if (chat) {
                                setNewTitle(chat.title);
                                setChangeTitleId(chatId);
                                setShowChangeTitleDialog(true);
                              }
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Último Mês
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            key={`${chat.id}-${chat.title}`}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onChangeTitle={(chatId) => {
                              const chat = chatsFromHistory.find(
                                (c) => c.id === chatId,
                              );
                              if (chat) {
                                setNewTitle(chat.title);
                                setChangeTitleId(chatId);
                                setShowChangeTitleDialog(true);
                              }
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Mais Antigos
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            key={`${chat.id}-${chat.title}`}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onChangeTitle={(chatId) => {
                              const chat = chatsFromHistory.find(
                                (c) => c.id === chatId,
                              );
                              if (chat) {
                                setNewTitle(chat.title);
                                setChangeTitleId(chatId);
                                setShowChangeTitleDialog(true);
                              }
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {!hasReachedEnd && paginatedChatHistories && (
        <div className="flex flex-col items-center justify-center py-4">
          <button
            type="button"
            onClick={() => {
              if (!isValidating) {
                setSize((currentSize) => currentSize + 1);
              }
            }}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
            disabled={isValidating}
          >
            {isValidating ? (
              <span className="flex items-center gap-2">
                <Loader className="animate-spin" size={14} />
                Carregando...
              </span>
            ) : (
              'Carregar Mais'
            )}
          </button>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente
              este chat do nosso servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showChangeTitleDialog}
        onOpenChange={(isOpen) => {
          setShowChangeTitleDialog(isOpen);
          // Limpar estados quando o diálogo for fechado
          if (!isOpen) {
            setNewTitle('');
            setChangeTitleId(null);
            setIsUpdatingTitle(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar título</DialogTitle>
            <DialogDescription>
              Digite um novo título para este chat.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Novo título"
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim() && !isUpdatingTitle) {
                  e.preventDefault();
                  handleChangeTitle();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChangeTitleDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeTitle}
              disabled={!newTitle.trim() || isUpdatingTitle}
            >
              {isUpdatingTitle ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
