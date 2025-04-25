import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Stripe } from 'stripe';

import { stripe } from '@/lib/stripe';
import {
  upsertSubscription,
  createPayment,
  updateSubscription,
  getUserSubscription,
} from '@/lib/db/queries';
import { PLANOS } from '@/lib/db/schema/subscription';

// Assinatura da resposta
export const runtime = 'edge';

/**
 * Webhook para processar eventos do Stripe
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
  }

  let event: Stripe.Event;

  // Verificar assinatura do webhook
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const error = err as Error;
    console.error(
      'Erro na verificação da assinatura do webhook:',
      error.message,
    );
    return NextResponse.json(
      { error: `Assinatura inválida: ${error.message}` },
      { status: 400 },
    );
  }

  try {
    // Processar eventos específicos
    switch (event.type) {
      // Checkout concluído - Criar ou atualizar assinatura
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        // Extrair dados relevantes
        const { customer, subscription } = session;
        if (!customer || !subscription) break;

        // Obter detalhes da assinatura
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription as string,
        );

        // Obter o plano da metadata
        const plano = stripeSubscription.metadata.plano as keyof typeof PLANOS;
        if (!plano) break;

        // Obter o ID do usuário das metadados do customer
        const stripeCustomer = await stripe.customers.retrieve(
          customer as string,
        );

        const userId = stripeCustomer.metadata.userId;
        if (!userId) break;

        // Atualizar ou criar assinatura no banco de dados
        await upsertSubscription(
          userId,
          plano,
          customer as string,
          subscription as string,
          'active',
          new Date(stripeSubscription.current_period_end * 1000),
        );

        break;
      }

      // Fatura paga - Registrar pagamento
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription || !invoice.customer) break;

        // Obter detalhes da assinatura
        const stripeSubscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
        );

        // Obter o ID do usuário das metadados do customer
        const stripeCustomer = await stripe.customers.retrieve(
          invoice.customer as string,
        );

        const userId = stripeCustomer.metadata.userId;
        if (!userId) break;

        // Buscar a assinatura do usuário
        const userSubscription = await getUserSubscription(userId);
        if (!userSubscription) break;

        // Registrar o pagamento
        await createPayment(
          userId,
          userSubscription.id,
          invoice.amount_paid,
          'paid',
          invoice.id,
          new Date(),
        );

        // Atualizar data de término
        await updateSubscription(userSubscription.id, {
          terminaEm: new Date(stripeSubscription.current_period_end * 1000),
        });

        break;
      }

      // Assinatura atualizada
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // Verificar alteração de status
        if (
          subscription.status === 'past_due' ||
          subscription.status === 'unpaid' ||
          subscription.status === 'canceled'
        ) {
          // Obter o ID do usuário do cliente
          const customer = await stripe.customers.retrieve(
            subscription.customer as string,
          );
          const userId = customer.metadata.userId;
          if (!userId) break;

          // Buscar a assinatura do usuário
          const userSubscription = await getUserSubscription(userId);
          if (!userSubscription) break;

          // Atualizar status
          await updateSubscription(userSubscription.id, {
            status: subscription.status as any,
          });
        }
        break;
      }

      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Obter o ID do usuário do cliente
        const customer = await stripe.customers.retrieve(
          subscription.customer as string,
        );
        const userId = customer.metadata.userId;
        if (!userId) break;

        // Buscar a assinatura do usuário
        const userSubscription = await getUserSubscription(userId);
        if (!userSubscription) break;

        // Atualizar status
        await updateSubscription(userSubscription.id, {
          status: 'canceled',
          terminaEm: new Date(subscription.current_period_end * 1000),
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar evento do webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar evento do webhook' },
      { status: 500 },
    );
  }
}
