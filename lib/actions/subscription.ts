'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  getUserSubscription,
  getUserPayments,
  checkConsultaDisponivel,
  updateSubscription,
} from '@/lib/db/queries';
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  cancelStripeSubscription,
  PRODUTOS_STRIPE,
} from '@/lib/stripe';
import { PLANOS, LIMITES_CONSULTA } from '@/lib/db/schema/subscription';

/**
 * Obtém a assinatura atual do usuário
 */
export async function getSubscriptionData(userId: string) {
  try {
    const subscription = await getUserSubscription(userId);
    const payments = await getUserPayments(userId);

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
        data: p.criadoEm,
        valor: p.valor / 100, // Converter de centavos para reais
        status: p.status,
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
    if (!Object.values(PLANOS).includes(plano)) {
      throw new Error('Plano inválido');
    }

    // Obter o preço do Stripe correspondente ao plano
    const priceId = PRODUTOS_STRIPE[plano];
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
export async function createStripePortal(userId: string, returnUrl: string) {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripeCustomerId) {
      throw new Error('Usuário não possui assinatura ativa no Stripe');
    }

    try {
      const portalSession = await createBillingPortalSession(
        subscription.stripeCustomerId,
        returnUrl,
      );
      return { url: portalSession.url };
    } catch (stripeError: any) {
      // Verificar se é o erro de configuração do portal
      if (
        stripeError?.message?.includes('No configuration provided') ||
        stripeError?.message?.includes('customer portal settings')
      ) {
        console.error(
          'Portal de cobrança do Stripe não configurado:',
          stripeError,
        );

        // Para ambiente de desenvolvimento, oferecer uma solução alternativa
        return {
          configError: true,
          message:
            'O portal de cobrança ainda não está configurado. Por favor, configure-o no dashboard do Stripe.',
          url: 'https://dashboard.stripe.com/test/settings/billing/portal',
        };
      }

      // Outros erros do Stripe
      throw stripeError;
    }
  } catch (error) {
    console.error('Erro ao criar portal de cobrança:', error);
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
export async function cancelarAssinatura(userId: string) {
  try {
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error('Usuário não possui assinatura');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('Assinatura não possui ID do Stripe');
    }

    // Cancelar no Stripe
    const result = await cancelStripeSubscription(
      subscription.stripeSubscriptionId,
    );

    // Atualizar no banco de dados
    await updateSubscription(subscription.id, {
      status: 'canceled',
      terminaEm: result.canceledAt,
    });

    return { success: true, message: 'Assinatura cancelada com sucesso' };
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw new Error('Não foi possível cancelar a assinatura');
  }
}
