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
};

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
  plano: keyof typeof PLANOS,
  returnUrl: string,
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
        },
      },
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
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
) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error) {
    console.error('Erro ao criar portal de cobrança:', error);
    throw new Error('Falha ao acessar portal de cobrança');
  }
}
