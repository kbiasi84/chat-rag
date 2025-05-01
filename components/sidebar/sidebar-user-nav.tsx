'use client';
import {
  ChevronUp,
  User as UserIcon,
  Settings,
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
} from 'lucide-react';
import type { User } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function SidebarUserNav({ user }: { user: User }) {
  const { setTheme, theme } = useTheme();
  const router = useRouter();

  // Extrair o nome e perfil do usuário
  const nome = user?.nome;
  const perfil = user?.perfil;
  const email = user?.email || '';

  // Como fallback, usar parte do email antes do @ se nome não estiver disponível
  const emailUsername = email.split('@')[0];
  const displayName = nome || emailUsername;

  // Verificar se o usuário é admin
  const isAdmin = perfil === 'admin';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10">
              <UserIcon className="size-6 rounded-full" />
              <span className="truncate capitalize">{displayName}</span>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'light' ? (
                <Moon className="mr-2 size-4" />
              ) : (
                <Sun className="mr-2 size-4" />
              )}
              {`Modo ${theme === 'light' ? 'Escuro' : 'Claro'}`}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="w-full cursor-pointer">
                <Settings className="mr-2 size-4" />
                Configurações
              </Link>
            </DropdownMenuItem>

            {/* Menu de Administrador - apenas para admins */}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="w-full cursor-pointer">
                    <LayoutDashboard className="mr-2 size-4" />
                    Painel de Administração
                  </Link>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <button
                type="button"
                className="w-full cursor-pointer flex items-center"
                onClick={() => {
                  signOut({
                    redirectTo: '/',
                  });
                }}
              >
                <LogOut className="mr-2 size-4" />
                Sair
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
