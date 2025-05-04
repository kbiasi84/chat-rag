'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  getUserSubscription,
  checkConsultaDisponivel,
  updateSubscription,
} from '@/lib/db/queries/subscription';
import { getUserPayments } from '@/lib/db/queries/payment';
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  cancelStripeSubscription,
  reactivateStripeSubscription,
  PRODUTOS_STRIPE,
} from '@/lib/stripe';
import { PLANOS, LIMITES_CONSULTA } from '@/lib/db/schema/subscription';

/**
 * Obtém a assinatura atual do usuário
 */
export async function getSubscriptionData(userId: string) {
  try {
    const subscription = await getUserSubscription(userId);
    const payments = await getUserPayments(userId, 5); // Limitando a 5 faturas

    // Se não tem assinatura, está no plano gratuito
    if (!subscription) {
      return {
        plano: PLANOS.FREE,
        status: 'active',
        limiteConsultas: LIMITES_CONSULTA[PLANOS.FREE],
        consultasUsadas: 0,
        consultasRestantes: LIMITES_CONSULTA[PLANOS.FREE],
        statusPagamento: 'Grátis',
        proximaCobranca: null,
        pagamentos: [],
      };
    }

    // Determinar o número de consultas restantes
    const limite =
      LIMITES_CONSULTA[subscription.plano as keyof typeof LIMITES_CONSULTA];
    const restantes = Math.max(0, limite - subscription.consultasUsadas);

    // Formatar os dados para exibição
    return {
      plano: subscription.plano,
      status: subscription.status,
      limiteConsultas: limite,
      consultasUsadas: subscription.consultasUsadas,
      consultasRestantes: restantes,
      statusPagamento: subscription.status === 'active' ? 'Ativo' : 'Inativo',
      proximaCobranca: subscription.terminaEm,
      pagamentos: payments.map((p) => ({
        id: p.id,
        data: p.dataPagamento || p.criadoEm,
        valor: p.valor / 100, // Converter de centavos para reais
        status: p.status,
        invoiceUrl: p.invoiceUrl || null,
      })),
      stripeCustomerId: subscription.stripeCustomerId,
    };
  } catch (error) {
    console.error('Erro ao buscar dados da assinatura:', error);
    throw new Error('Não foi possível obter os dados da assinatura');
  }
}

/**
 * Cria uma sessão de checkout do Stripe
 */
export async function createStripeCheckout(
  userId: string,
  email: string,
  plano: keyof typeof PLANOS,
  returnUrl: string,
) {
  try {
    // Verificar se o plano selecionado é válido
    if (!Object.keys(PLANOS).includes(plano)) {
      throw new Error('Plano inválido');
    }

    // Obter o preço do Stripe correspondente ao plano
    // Converter o tipo para funcionar com o PRODUTOS_STRIPE
    const planoLowerCase = plano.toLowerCase() as
      | 'starter'
      | 'standard'
      | 'enterprise';
    const priceId = PRODUTOS_STRIPE[planoLowerCase];

    if (!priceId) {
      throw new Error('Preço não configurado para este plano');
    }

    // Obter ou criar cliente no Stripe
    const customerId = await getOrCreateStripeCustomer(userId, email);

    // Criar sessão de checkout
    const checkoutSession = await createCheckoutSession(
      customerId,
      priceId,
      plano,
      returnUrl,
      userId,
    );

    // Retornar URL de checkout
    return { url: checkoutSession.url };
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw new Error('Não foi possível criar sessão de checkout');
  }
}

/**
 * Cria uma sessão de portal de cobrança do Stripe
 */
export async function createStripePortal(
  userId: string,
  returnUrl: string,
  flow?:
    | 'payment_method_update'
    | 'subscription_cancel'
    | 'subscription_update',
) {
  console.log('[DEBUG - SERVER] createStripePortal iniciado com:', {
    userId,
    returnUrl,
    flow,
  });
  try {
    const subscription = await getUserSubscription(userId);
    console.log(
      '[DEBUG - SERVER] Assinatura encontrada:',
      subscription
        ? {
            id: subscription.id,
            plano: subscription.plano,
            status: subscription.status,
            temStripeCustomerId: !!subscription.stripeCustomerId,
          }
        : 'Não encontrada',
    );

    if (!subscription?.stripeCustomerId) {
      console.log('[ERROR - SERVER] Usuário não possui stripeCustomerId');
      throw new Error('Usuário não possui assinatura ativa no Stripe');
    }

    try {
      // Configurações para o portal
      const portalConfig: any = {
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      };

      // Adicionar configurações específicas de fluxo, se fornecidas
      if (flow) {
        portalConfig.flow_data = {
          type: flow,
        };
      }

      console.log(
        '[DEBUG - SERVER] Chamando stripe.billingPortal com config:',
        portalConfig,
      );

      const portalSession = await createBillingPortalSession(
        subscription.stripeCustomerId,
        returnUrl,
        portalConfig,
      );

      console.log(
        '[DEBUG - SERVER] Portal criado com sucesso, URL:',
        portalSession.url,
      );
      return { url: portalSession.url };
    } catch (stripeError: any) {
      // Verificar se é o erro de configuração do portal
      const errorMessage = stripeError?.message || '';
      console.log('[ERROR - SERVER] Erro do Stripe:', {
        message: errorMessage,
        code: stripeError?.code,
        type: stripeError?.type,
        param: stripeError?.param,
        raw: stripeError?.raw,
      });

      // Erros específicos de configuração do Portal
      if (
        errorMessage.includes('No configuration provided') ||
        errorMessage.includes('customer portal settings') ||
        errorMessage.includes('not been created')
      ) {
        console.error(
          '[ERROR - SERVER] Portal de cobrança do Stripe não configurado:',
          stripeError,
        );

        // Detalhes do erro para o frontend
        return {
          configError: true,
          message:
            'O portal de cobrança ainda não está configurado. Configure-o no dashboard do Stripe.',
          url: 'https://dashboard.stripe.com/test/settings/billing/portal',
          error: errorMessage,
        };
      }

      // Outros erros do Stripe
      throw stripeError;
    }
  } catch (error) {
    console.error(
      '[ERROR - SERVER] Erro geral ao criar portal de cobrança:',
      error,
    );
    throw new Error('Não foi possível acessar o portal de cobrança');
  }
}

/**
 * Verificar se o usuário pode fazer uma consulta
 */
export async function verificarLimiteConsulta(userId: string) {
  try {
    // Obter dados detalhados da assinatura
    const subscriptionData = await getSubscriptionData(userId);

    // Verificar se a assinatura está cancelada
    if (subscriptionData.status === 'canceled') {
      return {
        permitido: false,
        mensagem:
          'Sua assinatura foi cancelada. Assine um plano para continuar usando o serviço.',
        redirecionarParaPlanos: true,
        consultasRestantes: 0,
        plano: subscriptionData.plano,
        limiteConsultas: subscriptionData.limiteConsultas,
        statusAssinatura: 'canceled',
      };
    }

    // Verificar se pode consultar
    const podeConsultar = subscriptionData.consultasRestantes > 0;

    if (!podeConsultar) {
      return {
        permitido: false,
        mensagem: 'Você atingiu o limite de consultas do seu plano atual',
        redirecionarParaPlanos: false,
        consultasRestantes: 0,
        plano: subscriptionData.plano,
        limiteConsultas: subscriptionData.limiteConsultas,
      };
    }

    return {
      permitido: true,
      consultasRestantes: subscriptionData.consultasRestantes,
      consultasUsadas: subscriptionData.consultasUsadas,
      plano: subscriptionData.plano,
      limiteConsultas: subscriptionData.limiteConsultas,
    };
  } catch (error) {
    console.error('Erro ao verificar limite de consultas:', error);
    throw new Error('Não foi possível verificar seu limite de consultas');
  }
}

/**
 * Cancela a assinatura de um usuário
 */
export async function cancelarAssinatura(
  userId: string,
  cancelAtPeriodEnd = true, // Por padrão, cancela no final do período
) {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error('Usuário não possui assinatura');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('Assinatura não possui ID do Stripe');
    }

    // Cancelar no Stripe (agora com a opção de cancelar no final do período)
    const result = await cancelStripeSubscription(
      subscription.stripeSubscriptionId,
      cancelAtPeriodEnd,
    );

    // O status da assinatura no banco de dados depende de como foi cancelada
    const newStatus = cancelAtPeriodEnd ? 'canceled_at_period_end' : 'canceled';

    // Atualizar no banco de dados
    await updateSubscription(subscription.id, {
      status: newStatus,
      terminaEm: result.canceledAt,
    });

    return {
      success: true,
      message: cancelAtPeriodEnd
        ? 'Sua assinatura será cancelada ao final do período atual'
        : 'Assinatura cancelada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw new Error('Não foi possível cancelar a assinatura');
  }
}

/**
 * Reativa uma assinatura que foi cancelada no final do período
 */
export async function reativarAssinatura(userId: string) {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error('Usuário não possui assinatura');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('Assinatura não possui ID do Stripe');
    }

    // Verificar se a assinatura está em estado de cancelamento no final do período
    if (subscription.status !== 'canceled_at_period_end') {
      throw new Error('Esta assinatura não pode ser reativada');
    }

    // Reativar no Stripe
    const result = await reactivateStripeSubscription(
      subscription.stripeSubscriptionId,
    );

    // Atualizar no banco de dados
    await updateSubscription(subscription.id, {
      status: 'active',
    });

    return { success: true, message: 'Assinatura reativada com sucesso' };
  } catch (error) {
    console.error('Erro ao reativar assinatura:', error);
    throw new Error('Não foi possível reativar a assinatura');
  }
}
