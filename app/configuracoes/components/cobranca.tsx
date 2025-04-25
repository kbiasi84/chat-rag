'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, Check, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

import {
  getSubscriptionData,
  createStripePortal,
} from '@/lib/actions/subscription';
import { PLANOS, LIMITES_CONSULTA } from '@/lib/db/schema/subscription';

export default function CobrancaContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Função para formatar a data
  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return format(new Date(date), "dd 'de' MMM. 'de' yyyy", { locale: ptBR });
  };

  // Buscar dados da assinatura
  useEffect(() => {
    async function fetchSubscription() {
      try {
        setLoading(true);
        if (session?.user?.id) {
          const data = await getSubscriptionData(session.user.id);
          setSubscriptionData(data);
        }
      } catch (error) {
        console.error('Erro ao buscar assinatura:', error);
        setError('Não foi possível carregar os dados da sua assinatura');
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchSubscription();
    }
  }, [session]);

  // Abrir o portal de gerenciamento de assinatura do Stripe
  const handleAtualizarPagamento = async () => {
    try {
      setPortalLoading(true);
      if (!session?.user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { url } = await createStripePortal(
        session.user.id,
        `${window.location.origin}/configuracoes?tab=cobranca`,
      );

      // Redirecionar para o portal do Stripe
      window.location.href = url;
    } catch (error) {
      console.error('Erro ao abrir portal de pagamento:', error);
      setError('Não foi possível acessar o gerenciamento de pagamento');
    } finally {
      setPortalLoading(false);
    }
  };

  // Exibir mensagem de carregamento
  if (loading) {
    return (
      <div className="flex flex-col space-y-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Cobrança</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu plano de assinatura e informações de pagamento
          </p>
        </div>

        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Exibir mensagem de erro
  if (error) {
    return (
      <div className="flex flex-col space-y-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Cobrança</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu plano de assinatura e informações de pagamento
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determinar nome do plano para exibição
  const getNomePlano = () => {
    switch (subscriptionData?.plano) {
      case PLANOS.FREE:
        return 'Gratuito';
      case PLANOS.STARTER:
        return 'Starter';
      case PLANOS.STANDARD:
        return 'Standard';
      case PLANOS.ENTERPRISE:
        return 'Enterprise';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cobrança</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu plano de assinatura e informações de pagamento
        </p>
      </div>

      {subscriptionData && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Calendar size={20} className="text-primary" />
                Plano atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Check size={24} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{getNomePlano()}</h3>
                  <p className="text-muted-foreground">
                    {subscriptionData.plano !== PLANOS.FREE
                      ? `Mensal • R$ ${
                          LIMITES_CONSULTA[subscriptionData.plano] === 30
                            ? 59
                            : LIMITES_CONSULTA[subscriptionData.plano] === 60
                              ? 99
                              : 149
                        },00`
                      : 'Gratuito'}
                  </p>
                  <p className="text-muted-foreground">
                    {subscriptionData.consultasRestantes} de{' '}
                    {subscriptionData.limiteConsultas} consultas disponíveis
                  </p>
                </div>
                <Link href="/planos">
                  <Button type="button" variant="outline">
                    Ajustar plano
                  </Button>
                </Link>
              </div>

              {subscriptionData.plano !== PLANOS.FREE && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Próxima cobrança
                    </div>
                    <div className="font-medium">
                      {formatDate(subscriptionData.proximaCobranca)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Método de pagamento
                    </div>
                    <div className="font-medium flex items-center gap-2">
                      <CreditCard size={16} /> Cartão de crédito
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div
                      className={`font-medium flex items-center gap-1 ${
                        subscriptionData.status === 'active'
                          ? 'text-green-600'
                          : 'text-amber-600'
                      }`}
                    >
                      <Check size={16} /> {subscriptionData.statusPagamento}
                    </div>
                  </div>
                </div>
              )}

              {subscriptionData.plano !== PLANOS.FREE &&
                subscriptionData.stripeCustomerId && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAtualizarPagamento}
                      disabled={portalLoading}
                    >
                      {portalLoading ? 'Carregando...' : 'Atualizar pagamento'}
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>

          {subscriptionData.plano !== PLANOS.FREE &&
            subscriptionData.pagamentos &&
            subscriptionData.pagamentos.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-xl">
                    Histórico de faturas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left font-medium p-2">Data</th>
                          <th className="text-left font-medium p-2">Total</th>
                          <th className="text-left font-medium p-2">Status</th>
                          <th className="text-left font-medium p-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptionData.pagamentos.map((pagamento: any) => (
                          <tr
                            key={pagamento.id}
                            className="border-b hover:bg-accent/5"
                          >
                            <td className="p-2">
                              {formatDate(pagamento.data)}
                            </td>
                            <td className="p-2">
                              R$ {pagamento.valor.toFixed(2)}
                            </td>
                            <td className="p-2">
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  pagamento.status === 'paid'
                                    ? 'text-green-600'
                                    : pagamento.status === 'pending'
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                }`}
                              >
                                <Check size={14} />
                                {pagamento.status === 'paid'
                                  ? 'Pago'
                                  : pagamento.status === 'pending'
                                    ? 'Pendente'
                                    : 'Falhou'}
                              </span>
                            </td>
                            <td className="p-2">
                              <Button type="button" variant="ghost" size="sm">
                                Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

          {subscriptionData.plano !== PLANOS.FREE && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-destructive">
                  <AlertCircle size={20} />
                  Cancelamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Cancele seu plano a qualquer momento. Você pode continuar
                  usando o serviço até o final do período de cobrança atual.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleAtualizarPagamento}
                  disabled={portalLoading}
                >
                  Cancelar plano
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
