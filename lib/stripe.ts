import Stripe from 'stripe';
import { PRECOS_PLANOS, PLANOS } from './db/schema/subscription';

// Inicializar a instância do Stripe com a chave secreta
// biome-ignore lint: Forbidden non-null assertion.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// IDs dos produtos e preços no Stripe
// Esses IDs devem ser configurados no dashboard do Stripe
export const PRODUTOS_STRIPE = {
  [PLANOS.STARTER]: process.env.STRIPE_STARTER_PRICE_ID || '',
  [PLANOS.STANDARD]: process.env.STRIPE_STANDARD_PRICE_ID || '',
  [PLANOS.ENTERPRISE]: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
} as const;

/**
 * Cria um cliente no Stripe se ainda não existir
 */
export async function getOrCreateStripeCustomer(userId: string, email: string) {
  try {
    // Buscar o cliente pelo ID de referência (metadata)
    const existingCustomers = await stripe.customers.list({
      email,
    });

    // Se já existir um cliente com este e-mail, retornar
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0].id;
    }

    // Caso não exista, criar um novo cliente
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId, // Associar o ID do usuário ao cliente do Stripe
      },
    });

    return customer.id;
  } catch (error) {
    console.error('Erro ao criar cliente no Stripe:', error);
    throw new Error('Falha ao criar cliente no Stripe');
  }
}

/**
 * Cria uma sessão de checkout do Stripe
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  plano: (typeof PLANOS)[keyof typeof PLANOS],
  returnUrl: string,
  userId: string,
) {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          plano,
          userId,
        },
      },
      success_url: `${returnUrl.split('?')[0]}?tab=cobranca&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
    });

    return session;
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw new Error('Falha ao criar sessão de checkout');
  }
}

/**
 * Cria um portal de gerenciamento de assinatura
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
  options?: any,
) {
  console.log('[DEBUG - STRIPE] Iniciando createBillingPortalSession:', {
    customerId,
    returnUrl,
  });
  try {
    // Configurações básicas do portal
    const sessionConfig: any = {
      customer: customerId,
      return_url: returnUrl,
    };

    // Adicionar quaisquer opções personalizadas, se fornecidas
    if (options?.flow_data) {
      sessionConfig.flow_data = options.flow_data;
    }

    console.log(
      '[DEBUG - STRIPE] Configuração da sessão:',
      JSON.stringify(sessionConfig, null, 2),
    );

    try {
      console.log(
        '[DEBUG - STRIPE] Chamando stripe.billingPortal.sessions.create',
      );
      const session = await stripe.billingPortal.sessions.create(sessionConfig);
      console.log('[DEBUG - STRIPE] Portal criado com sucesso:', {
        url: session.url,
        id: session.id,
        object: session.object,
        created: session.created,
      });
      return session;
    } catch (error: any) {
      // Capturar e propagar o erro com mais detalhes
      console.error(
        '[ERROR - STRIPE] Erro específico do Stripe ao criar portal:',
        {
          message: error.message,
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
          requestId: error.requestId,
          headers: error.headers,
          rawType: error.rawType,
          param: error.param,
        },
      );

      // Tentar extrair mais detalhes do erro
      if (error.raw) {
        console.error(
          '[ERROR - STRIPE] Detalhes adicionais do erro:',
          error.raw,
        );
      }

      // Se for um erro de configuração do portal, propagar com detalhes para tratamento
      if (
        error.message?.includes('No configuration provided') ||
        error.message?.includes('customer portal settings')
      ) {
        console.log(
          '[DEBUG - STRIPE] Erro de configuração do portal detectado',
        );
        error.configError = true;
        error.configUrl =
          'https://dashboard.stripe.com/test/settings/billing/portal';
      }

      throw error;
    }
  } catch (error) {
    console.error(
      '[ERROR - STRIPE] Erro geral ao criar portal de cobrança:',
      error,
    );
    throw error; // Propagar o erro para tratamento na camada de serviço
  }
}

/**
 * Cancela uma assinatura do Stripe
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd = false,
) {
  try {
    let canceledSubscription: any;

    if (cancelAtPeriodEnd) {
      // Cancelar no final do período atual
      canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      // Cancelar imediatamente
      canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    }

    return {
      success: true,
      status: canceledSubscription.status,
      cancelAtPeriodEnd,
      canceledAt:
        cancelAtPeriodEnd && canceledSubscription.cancel_at
          ? new Date(canceledSubscription.cancel_at * 1000)
          : canceledSubscription.canceled_at
            ? new Date(canceledSubscription.canceled_at * 1000)
            : new Date(),
    };
  } catch (error) {
    console.error('Erro ao cancelar assinatura no Stripe:', error);
    throw new Error('Falha ao cancelar assinatura');
  }
}

/**
 * Reativa uma assinatura do Stripe cancelada no final do período
 */
export async function reactivateStripeSubscription(subscriptionId: string) {
  try {
    const reactivatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      },
    );

    return {
      success: true,
      status: reactivatedSubscription.status,
    };
  } catch (error) {
    console.error('Erro ao reativar assinatura no Stripe:', error);
    throw new Error('Falha ao reativar assinatura');
  }
}
