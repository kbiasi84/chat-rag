'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { PLANOS, LIMITES_CONSULTA } from '@/lib/db/schema/subscription';
import {
  getSubscriptionData,
  createStripeCheckout,
} from '@/lib/actions/subscription';

export default function PlanosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [planoAtual, setPlanoAtual] = useState<string | null>(null);
  const [buttonLoading, setButtonLoading] = useState<string | null>(null);

  // Buscar plano atual do usuário
  useEffect(() => {
    async function fetchSubscription() {
      try {
        if (session?.user?.id) {
          setLoading(true);
          const data = await getSubscriptionData(session.user.id);
          setPlanoAtual(data.status === 'canceled' ? null : data.plano);
        }
      } catch (error) {
        console.error('Erro ao buscar assinatura:', error);
        toast.error('Não foi possível carregar seu plano atual');
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchSubscription();
    }
  }, [session]);

  // Lidar com a seleção de plano
  const handleSelectPlan = async (
    plano: (typeof PLANOS)[keyof typeof PLANOS],
  ) => {
    try {
      // Remover esta verificação para permitir renovar o mesmo plano
      // if (plano === planoAtual) {
      //   router.push('/configuracoes?tab=cobranca');
      //   return;
      // }

      if (!session?.user?.id || !session.user.email) {
        toast.error('Você precisa estar logado para assinar um plano');
        return;
      }

      setButtonLoading(plano);

      // Criar checkout para o plano selecionado
      const { url } = await createStripeCheckout(
        session.user.id,
        session.user.email,
        plano,
        `${window.location.origin}/configuracoes?tab=cobranca`,
      );

      // Redirecionar para o checkout
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Não foi possível iniciar o checkout');
      }
    } catch (error) {
      console.error('Erro ao selecionar plano:', error);
      toast.error('Não foi possível processar sua solicitação');
    } finally {
      setButtonLoading(null);
    }
  };

  // Verificar se é plano atual
  const isCurrentPlan = (plano: string) => planoAtual === plano;

  // Texto do botão com base no plano atual
  const getButtonText = (plano: string) => {
    if (loading || !session?.user) return 'Carregando...';
    if (isCurrentPlan(plano)) return 'Renovar Plano';
    if (planoAtual === null || planoAtual === PLANOS.FREE)
      return 'Assinar Agora';
    if (plano === PLANOS.FREE) return 'Fazer Downgrade';
    return planoAtual === PLANOS.ENTERPRISE
      ? 'Fazer Downgrade'
      : plano === PLANOS.ENTERPRISE
        ? 'Fazer Upgrade'
        : planoAtual === PLANOS.STANDARD && plano === PLANOS.STARTER
          ? 'Fazer Downgrade'
          : 'Fazer Upgrade';
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Planos que crescem com você
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Plano Starter */}
        <Card
          className={`flex flex-col border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
            isCurrentPlan(PLANOS.STARTER) ? 'ring-2 ring-primary' : ''
          }`}
        >
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Starter</h2>
            <p className="text-muted-foreground mt-2">
              Para profissional individual
            </p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 39</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 grow">
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>{LIMITES_CONSULTA[PLANOS.STARTER]} consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Button
                className={`w-full ${
                  isCurrentPlan(PLANOS.STARTER)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
                variant={
                  isCurrentPlan(PLANOS.STARTER) ? 'default' : 'secondary'
                }
                disabled={loading || buttonLoading !== null}
                onClick={() => handleSelectPlan(PLANOS.STARTER)}
              >
                {buttonLoading === PLANOS.STARTER
                  ? 'Processando...'
                  : getButtonText(PLANOS.STARTER)}
              </Button>
            </div>
          </div>
        </Card>

        {/* Plano Standard */}
        <Card
          className={`flex flex-col border ${
            isCurrentPlan(PLANOS.STANDARD)
              ? 'ring-2 ring-primary border-orange-500'
              : 'border-orange-500'
          } rounded-lg overflow-hidden hover:shadow-md transition-shadow relative`}
        >
          <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 rounded-bl-lg">
            Popular
          </div>
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Standard</h2>
            <p className="text-muted-foreground mt-2">
              Para escritórios e empresas médias
            </p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 69</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 grow">
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>{LIMITES_CONSULTA[PLANOS.STANDARD]} consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Button
                className={`w-full ${
                  isCurrentPlan(PLANOS.STANDARD)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
                variant={isCurrentPlan(PLANOS.STANDARD) ? 'default' : 'default'}
                disabled={loading || buttonLoading !== null}
                onClick={() => handleSelectPlan(PLANOS.STANDARD)}
              >
                {buttonLoading === PLANOS.STANDARD
                  ? 'Processando...'
                  : getButtonText(PLANOS.STANDARD)}
              </Button>
            </div>
          </div>
        </Card>

        {/* Plano Enterprise */}
        <Card
          className={`flex flex-col border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
            isCurrentPlan(PLANOS.ENTERPRISE) ? 'ring-2 ring-primary' : ''
          }`}
        >
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Enterprise</h2>
            <p className="text-muted-foreground mt-2">Para grandes empresas</p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 99</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 grow">
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>{LIMITES_CONSULTA[PLANOS.ENTERPRISE]} consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Button
                className={`w-full ${
                  isCurrentPlan(PLANOS.ENTERPRISE)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-black hover:bg-gray-800 text-white'
                }`}
                variant={
                  isCurrentPlan(PLANOS.ENTERPRISE) ? 'default' : 'default'
                }
                disabled={loading || buttonLoading !== null}
                onClick={() => handleSelectPlan(PLANOS.ENTERPRISE)}
              >
                {buttonLoading === PLANOS.ENTERPRISE
                  ? 'Processando...'
                  : getButtonText(PLANOS.ENTERPRISE)}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
