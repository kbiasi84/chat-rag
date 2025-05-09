import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/db/queries/subscription';

export async function GET(req: Request) {
  try {
    // Em produção, você deve validar a autenticação aqui
    // Essa é uma implementação simplificada apenas para teste

    // Extrair userID da query - apenas para teste
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não fornecido' },
        { status: 400 },
      );
    }

    // Buscar assinatura do usuário
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Nenhum método de pagamento encontrado' },
        { status: 404 },
      );
    }

    // Buscar informações de pagamento no Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card',
    });

    // Se não houver método de pagamento, retornar erro
    if (paymentMethods.data.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum método de pagamento encontrado' },
        { status: 404 },
      );
    }

    // Obter o primeiro método de pagamento (geralmente o padrão)
    const card = paymentMethods.data[0].card;

    return NextResponse.json({
      brand: card?.brand || 'Desconhecido',
      last4: card?.last4 || '****',
      exp_month: card?.exp_month,
      exp_year: card?.exp_year,
    });
  } catch (error) {
    console.error('Erro ao buscar informações de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar informações de pagamento' },
      { status: 500 },
    );
  }
}
