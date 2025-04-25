// app/configuracoes/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserIcon, Lock, CreditCard, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfilContent from './components/perfil';
import PrivacidadeContent from './components/privacidade';
import CobrancaContent from './components/cobranca';

export default function PerfilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [currentTab, setCurrentTab] = useState('perfil');

  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    atividade: '',
  });

  // Atualizar o estado quando a sessão estiver disponível
  useEffect(() => {
    if (session?.user) {
      setUserData({
        nome: (session.user as any)?.nome || '',
        email: session.user.email || '',
        whatsapp: (session.user as any)?.whatsapp || '',
        atividade: (session.user as any)?.atividade || '',
      });
    }
  }, [session]);

  // Obter a aba atual a partir da URL
  useEffect(() => {
    const tab = searchParams.get('tab') || 'perfil';
    setCurrentTab(tab);
  }, [searchParams]);

  // Função para navegar entre abas
  const navigateToTab = (tab: string) => {
    router.push(`/configuracoes?tab=${tab}`);
  };

  // Podemos manter o check de loading para UX
  if (session === undefined) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Renderizar o conteúdo com base na aba atual
  const renderContent = () => {
    switch (currentTab) {
      case 'privacidade':
        return <PrivacidadeContent />;
      case 'cobranca':
        return <CobrancaContent />;
      case 'perfil':
      default:
        return <PerfilContent userData={userData} />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar de navegação */}
      <div className="w-64 border-r p-6">
        {/* Botão para voltar ao chat */}
        <Button
          variant="ghost"
          className="w-full flex items-center justify-start gap-2 mb-4"
          onClick={() => router.push('/')}
        >
          <ArrowLeft size={16} />
          <span>Voltar ao chat</span>
        </Button>

        <h2 className="text-2xl font-semibold mb-6">Configurações</h2>
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => navigateToTab('perfil')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md w-full text-left ${
              currentTab === 'perfil'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            } transition-colors`}
          >
            <UserIcon size={18} />
            <span>Perfil</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToTab('privacidade')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md w-full text-left ${
              currentTab === 'privacidade'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            } transition-colors`}
          >
            <Lock size={18} />
            <span>Privacidade</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToTab('cobranca')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md w-full text-left ${
              currentTab === 'cobranca'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            } transition-colors`}
          >
            <CreditCard size={18} />
            <span>Cobrança</span>
          </button>
        </nav>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 p-8 max-w-4xl mx-auto">{renderContent()}</div>
    </div>
  );
}
