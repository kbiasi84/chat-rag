'use client';

import { useState, useEffect, useCallback } from 'react';
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
  cancelarAssinatura,
  reativarAssinatura,
} from '@/lib/actions/subscription';
import { PLANOS } from '@/lib/db/schema/subscription';

// Interface para informações do cartão
interface CardInfo {
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
}

export default function CobrancaContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // Função para formatar a data
  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return format(new Date(date), "dd 'de' MMM. 'de' yyyy", { locale: ptBR });
  };

  // Função para buscar informações do cartão
  const fetchCardInfo = useCallback(async () => {
    try {
      if (!session?.user?.id) return;

      setCardLoading(true);
      const response = await fetch(`/api/pagamento?userId=${session.user.id}`);

      if (response.ok) {
        const data = await response.json();
        setCardInfo(data);
      } else {
        console.log('Cartão não encontrado ou erro ao buscar dados do cartão');
      }
    } catch (err) {
      console.error('Erro ao buscar dados do cartão:', err);
    } finally {
      setCardLoading(false);
    }
  }, [session?.user?.id]);

  // Buscar dados da assinatura
  useEffect(() => {
    async function fetchSubscription() {
      try {
        setLoading(true);
        if (session?.user?.id) {
          const data = await getSubscriptionData(session.user.id);
          setSubscriptionData(data);

          // Se tem assinatura paga, buscar dados do cartão
          if (data?.plano !== PLANOS.FREE && data?.stripeCustomerId) {
            await fetchCardInfo();
          }
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
  }, [session, fetchCardInfo]);

  // Abrir o portal de gerenciamento de assinatura do Stripe
  const handleAtualizarPagamento = async () => {
    console.log('[DEBUG] Iniciando processo de atualização de pagamento');
    try {
      setPortalLoading(true);
      if (!session?.user?.id) {
        console.log('[ERROR] Usuário não autenticado');
        throw new Error('Usuário não autenticado');
      }

      console.log('[DEBUG] Chamando createStripePortal com:', {
        userId: session.user.id,
        returnUrl: `${window.location.origin}/configuracoes?tab=cobranca`,
        flow: 'payment_method_update',
      });

      const result = await createStripePortal(
        session.user.id,
        `${window.location.origin}/configuracoes?tab=cobranca`,
        'payment_method_update', // Especificando o fluxo para atualização de método de pagamento
      );

      console.log('[DEBUG] Resultado do createStripePortal:', result);

      // Verificar se temos um erro de configuração
      if (result.configError) {
        console.log('[ERROR] Erro de configuração do portal:', result);
        setError(
          'Portal de cobrança não configurado. Entre em contato com o suporte.',
        );
        return;
      }

      // Log da URL antes de redirecionar
      console.log('[DEBUG] Redirecionando para URL do portal:', result.url);

      // Redirecionar para o portal do Stripe
      window.location.href = result.url;
    } catch (error) {
      console.error('[ERROR] Erro ao abrir portal de pagamento:', error);

      // Exibir mensagem amigável
      setError(
        'Não foi possível acessar o portal de pagamento neste momento. Por favor, tente novamente mais tarde ou entre em contato com o suporte.',
      );
    } finally {
      setPortalLoading(false);
    }
  };

  // Função para cancelar assinatura
  const handleCancelarAssinatura = async () => {
    // Confirmar com o usuário
    if (
      !confirm(
        'Tem certeza que deseja cancelar sua assinatura? Sua assinatura permanecerá ativa até o final do período atual.',
      )
    ) {
      return;
    }

    try {
      setCancelLoading(true);
      if (!session?.user?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Agora o cancelamento é feito no final do período (padrão)
      const result = await cancelarAssinatura(session.user.id);

      // Atualizar dados da assinatura após cancelamento
      const data = await getSubscriptionData(session.user.id);
      setSubscriptionData(data);

      // Mostrar confirmação
      alert('Sua assinatura será cancelada ao final do período atual.');
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      setError(
        'Não foi possível cancelar sua assinatura. Por favor, tente novamente.',
      );
    } finally {
      setCancelLoading(false);
    }
  };

  // Função para reativar assinatura
  const handleReassinar = async () => {
    try {
      setReactivateLoading(true);
      if (!session?.user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const result = await reativarAssinatura(session.user.id);

      // Atualizar dados da assinatura após reativação
      const data = await getSubscriptionData(session.user.id);
      setSubscriptionData(data);

      // Mostrar confirmação
      alert('Sua assinatura foi reativada com sucesso.');
    } catch (error) {
      console.error('Erro ao reativar assinatura:', error);
      setError(
        'Não foi possível reativar sua assinatura. Por favor, tente novamente.',
      );
    } finally {
      setReactivateLoading(false);
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
          <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
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

  // Formatar nome da bandeira do cartão
  const formatBrand = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
      jcb: 'JCB',
      diners: 'Diners Club',
      unionpay: 'UnionPay',
    };

    return (
      brandMap[brand.toLowerCase()] ||
      brand.charAt(0).toUpperCase() + brand.slice(1)
    );
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
              {subscriptionData.status === 'canceled' ? (
                <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <AlertCircle size={24} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Sem plano ativo</h3>
                    <p className="text-muted-foreground">
                      Sua assinatura foi cancelada. Assine um plano para ter
                      acesso a mais recursos.
                    </p>
                  </div>
                  <Link href="/planos">
                    <Button type="button" variant="default">
                      Assinar plano
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Check size={24} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{getNomePlano()}</h3>
                    <p className="text-muted-foreground">
                      {subscriptionData.plano !== PLANOS.FREE
                        ? `Mensal • R$ ${
                            subscriptionData.plano === 'starter'
                              ? 39
                              : subscriptionData.plano === 'standard'
                                ? 69
                                : 99
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
              )}

              {subscriptionData.plano !== PLANOS.FREE && (
                <div className="flex flex-col gap-4">
                  {subscriptionData.status !== 'canceled' && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        {subscriptionData.status === 'canceled_at_period_end'
                          ? 'Plano termina em'
                          : 'Sua assinatura será renovada automaticamente em'}
                      </div>
                      <div className="font-medium">
                        {formatDate(subscriptionData.proximaCobranca)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div
                      className={`font-medium flex items-center gap-1 ${
                        subscriptionData.status === 'active'
                          ? 'text-green-600'
                          : subscriptionData.status === 'canceled' ||
                              subscriptionData.status ===
                                'canceled_at_period_end'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {subscriptionData.status === 'active' ? (
                        <Check size={16} />
                      ) : subscriptionData.status === 'canceled' ||
                        subscriptionData.status === 'canceled_at_period_end' ? (
                        <AlertCircle size={16} />
                      ) : (
                        <AlertCircle size={16} />
                      )}
                      {subscriptionData.status === 'active'
                        ? 'Ativo'
                        : subscriptionData.status === 'canceled'
                          ? 'Cancelado'
                          : subscriptionData.status === 'canceled_at_period_end'
                            ? 'Assinatura cancelada'
                            : subscriptionData.statusPagamento || 'Inativo'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações do método de pagamento */}
          {subscriptionData.plano !== PLANOS.FREE &&
            subscriptionData.status !== 'canceled' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CreditCard size={20} className="text-primary" />
                    Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    {cardLoading ? (
                      <div className="text-muted-foreground">
                        Carregando informações de pagamento...
                      </div>
                    ) : cardInfo ? (
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} />
                        <span className="font-medium">
                          {formatBrand(cardInfo.brand)} •••• {cardInfo.last4}
                        </span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Método de pagamento não disponível
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAtualizarPagamento}
                      disabled={portalLoading}
                    >
                      {portalLoading ? 'Carregando...' : 'Atualizar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Card especial para assinatura cancelada no final do período */}
          {subscriptionData.plano !== PLANOS.FREE &&
            subscriptionData.status === 'canceled_at_period_end' && (
              <Card className="mb-6 border-red-100">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-600" />
                  <div>
                    <h3 className="font-medium">Assinatura cancelada</h3>
                    <p className="text-sm text-muted-foreground">
                      Plano termina em{' '}
                      {formatDate(subscriptionData.proximaCobranca)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReassinar}
                    disabled={reactivateLoading}
                    className="ml-auto"
                  >
                    {reactivateLoading ? 'Processando...' : 'Reassinar'}
                  </Button>
                </CardContent>
              </Card>
            )}

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
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (pagamento.invoiceUrl) {
                                    window.open(pagamento.invoiceUrl, '_blank');
                                  }
                                }}
                                disabled={!pagamento.invoiceUrl}
                              >
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

          {subscriptionData.plano !== PLANOS.FREE &&
            subscriptionData.status === 'active' && (
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
                    onClick={handleCancelarAssinatura}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? 'Processando...' : 'Cancelar plano'}
                  </Button>
                </CardContent>
              </Card>
            )}
        </>
      )}
    </>
  );
}
