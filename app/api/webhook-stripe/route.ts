// Imports usados como tipos
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
// Imports reais dos módulos
import { stripe } from '@/lib/stripe';
// Importando funções da base de dados
import {
  upsertSubscription,
  updateSubscription,
  getUserSubscription,
  getUserByStripeCustomerId,
} from '@/lib/db/queries/subscription';
import { createPayment } from '@/lib/db/queries/payment';
import { PLANOS } from '@/lib/db/schema/subscription';

/**
 * Webhook processar eventos do Stripe sem proteção de autenticação
 */
export async function POST(req: NextRequest) {
  console.log('[WEBHOOK] Requisição recebida');

  const body = await req.text();
  const headersObj = await headers();
  const signature = headersObj.get('stripe-signature');

  if (!signature) {
    console.error('[WEBHOOK] Assinatura não encontrada nos headers');
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
  }

  let event: Stripe.Event;

  // Verificar assinatura do webhook
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || '',
    );
    console.log('[WEBHOOK] Evento construído com sucesso. Tipo:', event.type);
  } catch (err) {
    const error = err as Error;
    console.error(
      '[WEBHOOK] Erro na verificação da assinatura:',
      error.message,
    );
    return NextResponse.json(
      { error: `Assinatura inválida: ${error.message}` },
      { status: 400 },
    );
  }

  try {
    console.log('[WEBHOOK] Processando evento:', event.type);

    switch (event.type) {
      // Checkout concluído - Criar ou atualizar assinatura
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== 'subscription') {
          console.log('[WEBHOOK] Ignorando: não é uma assinatura');
          break;
        }

        // Extrair dados relevantes
        const { customer, subscription } = session;

        if (!customer || !subscription) {
          console.log(
            '[WEBHOOK] Ignorando: cliente ou assinatura não encontrados',
          );
          break;
        }

        // Obter detalhes da assinatura
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription as string,
        );

        // Obter o plano da metadata
        const stripeMetadataPlano =
          stripeSubscription.metadata?.plano?.toLowerCase() || '';
        let planoKey: (typeof PLANOS)[keyof typeof PLANOS] = PLANOS.FREE;

        // Mapear o nome do plano para a chave correta do PLANOS
        if (stripeMetadataPlano === 'starter') planoKey = PLANOS.STARTER;
        else if (stripeMetadataPlano === 'standard') planoKey = PLANOS.STANDARD;
        else if (stripeMetadataPlano === 'enterprise')
          planoKey = PLANOS.ENTERPRISE;

        // Obter o ID do usuário das metadados do customer
        const stripeCustomer = await stripe.customers.retrieve(
          customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        const userId = customerData.metadata?.userId;

        if (!userId) {
          console.log(
            '[WEBHOOK] Ignorando: userId não encontrado nos metadados do cliente',
          );
          break;
        }

        // Atualizar ou criar assinatura no banco de dados
        try {
          // Verificar se current_period_end existe e é um número válido
          let periodEnd = (stripeSubscription as any).current_period_end;

          // Se não encontrar no nível principal, procurar no primeiro item da assinatura
          if (!periodEnd && stripeSubscription.items?.data?.length > 0) {
            periodEnd = (stripeSubscription.items.data[0] as any)
              .current_period_end;
          }

          let terminaEm = new Date();

          if (periodEnd && typeof periodEnd === 'number') {
            terminaEm = new Date(periodEnd * 1000);
          } else {
            terminaEm.setDate(terminaEm.getDate() + 30);
          }

          await upsertSubscription(
            userId,
            planoKey,
            customer as string,
            subscription as string,
            'active',
            terminaEm,
          );
          console.log('[WEBHOOK] Assinatura atualizada com sucesso');

          // Cancelar outras assinaturas ativas do Stripe para este cliente
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer as string,
              status: 'active',
            });
            for (const sub of subscriptions.data) {
              if (sub.id !== subscription) {
                await stripe.subscriptions.cancel(sub.id);
                console.log(`[WEBHOOK] Assinatura antiga cancelada: ${sub.id}`);
              }
            }
          } catch (cancelError) {
            console.error(
              '[WEBHOOK] Erro ao cancelar assinaturas antigas:',
              cancelError,
            );
          }
        } catch (error) {
          console.error('[WEBHOOK] Erro ao atualizar assinatura:', error);
        }

        break;
      }

      // Fatura paga - Registrar pagamento
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        if (!invoice.customer) {
          console.log('[WEBHOOK] Ignorando: cliente não encontrado na fatura');
          break;
        }

        // Obter o ID do usuário a partir dos metadados do customer
        const stripeCustomer = await stripe.customers.retrieve(
          invoice.customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        const userId = customerData.metadata?.userId;

        if (!userId) {
          // Se não encontrou userId nos metadados, tenta buscar pelo customer_id
          try {
            const userSubscription = await getUserByStripeCustomerId(
              invoice.customer as string,
            );

            if (userSubscription) {
              const foundUserId = userSubscription.userId;

              // Registrar o pagamento
              try {
                const invoiceUrl = invoice.hosted_invoice_url || undefined;
                let dataPagamento = new Date();

                // Verificar se temos o period_start nas linhas da fatura
                if (
                  invoice.lines?.data?.length > 0 &&
                  (invoice.lines.data[0] as any).period?.start
                ) {
                  const periodStart = (invoice.lines.data[0] as any).period
                    .start;
                  if (periodStart && typeof periodStart === 'number') {
                    dataPagamento = new Date(periodStart * 1000);
                  }
                }
                // Se não encontrar nas linhas, verificar no period_start da própria fatura
                else if ((invoice as any).period_start) {
                  const periodStart = (invoice as any).period_start;
                  if (typeof periodStart === 'number') {
                    dataPagamento = new Date(periodStart * 1000);
                  }
                }

                await createPayment(
                  foundUserId,
                  userSubscription.id,
                  invoice.amount_paid,
                  'paid',
                  invoice.id,
                  dataPagamento,
                  invoiceUrl,
                );
                console.log('[WEBHOOK] Pagamento registrado com sucesso');

                // Definir data de término para atualizar a assinatura
                let terminaEm = new Date();
                let dataEncontrada = false;

                // Primeiro verificar nas linhas da fatura
                if (
                  invoice.lines?.data?.length > 0 &&
                  (invoice.lines.data[0] as any).period?.end
                ) {
                  const invoicePeriodEnd = (invoice.lines.data[0] as any).period
                    .end;
                  if (
                    invoicePeriodEnd &&
                    typeof invoicePeriodEnd === 'number'
                  ) {
                    terminaEm = new Date(invoicePeriodEnd * 1000);
                    dataEncontrada = true;
                  }
                }

                // Segundo: verificar o period_end da própria fatura
                if (!dataEncontrada && (invoice as any).period_end) {
                  const invoicePeriodEnd = (invoice as any).period_end;
                  if (typeof invoicePeriodEnd === 'number') {
                    terminaEm = new Date(invoicePeriodEnd * 1000);
                    dataEncontrada = true;
                  }
                }

                // Terceiro: Se a assinatura estiver disponível na fatura, tentar buscar lá
                if (!dataEncontrada && (invoice as any).subscription) {
                  try {
                    const stripeSubscription =
                      await stripe.subscriptions.retrieve(
                        (invoice as any).subscription as string,
                      );

                    let periodEnd = (stripeSubscription as any)
                      .current_period_end;

                    if (
                      !periodEnd &&
                      stripeSubscription.items?.data?.length > 0
                    ) {
                      periodEnd = (stripeSubscription.items.data[0] as any)
                        .current_period_end;
                    }

                    if (periodEnd && typeof periodEnd === 'number') {
                      terminaEm = new Date(periodEnd * 1000);
                      dataEncontrada = true;
                    }
                  } catch (subError) {
                    console.error(
                      '[WEBHOOK] Erro ao obter detalhes da assinatura:',
                      subError,
                    );
                  }
                }

                // Por último, se nenhuma data válida foi encontrada, usar data padrão
                if (!dataEncontrada) {
                  terminaEm.setDate(terminaEm.getDate() + 30);
                }

                await updateSubscription(userSubscription.id, {
                  terminaEm: terminaEm,
                });
                console.log('[WEBHOOK] Data de término atualizada');
              } catch (error) {
                console.error('[WEBHOOK] Erro ao registrar pagamento:', error);
              }

              break;
            } else {
              console.log(
                '[WEBHOOK] Ignorando: Não foi possível encontrar o usuário pelo customer_id',
              );
              break;
            }
          } catch (error) {
            console.error(
              '[WEBHOOK] Erro ao buscar assinatura pelo customer_id:',
              error,
            );
            break;
          }
        } else {
          // Buscar a assinatura do usuário diretamente pelo userId
          const userSubscription = await getUserSubscription(userId);

          if (!userSubscription) {
            console.log(
              '[WEBHOOK] Ignorando: assinatura não encontrada no banco de dados',
            );
            break;
          }

          // Registrar o pagamento
          try {
            const invoiceUrl = invoice.hosted_invoice_url || undefined;
            let dataPagamento = new Date();

            // Verificar se temos o period_start nas linhas da fatura
            if (
              invoice.lines?.data?.length > 0 &&
              (invoice.lines.data[0] as any).period?.start
            ) {
              const periodStart = (invoice.lines.data[0] as any).period.start;
              if (periodStart && typeof periodStart === 'number') {
                dataPagamento = new Date(periodStart * 1000);
              }
            }
            // Se não encontrar nas linhas, verificar no period_start da própria fatura
            else if ((invoice as any).period_start) {
              const periodStart = (invoice as any).period_start;
              if (typeof periodStart === 'number') {
                dataPagamento = new Date(periodStart * 1000);
              }
            }

            await createPayment(
              userId,
              userSubscription.id,
              invoice.amount_paid,
              'paid',
              invoice.id,
              dataPagamento,
              invoiceUrl,
            );
            console.log('[WEBHOOK] Pagamento registrado com sucesso');

            // Definir data de término para atualizar a assinatura
            let terminaEm = new Date();
            let dataEncontrada = false;

            // Primeiro verificar nas linhas da fatura
            if (
              invoice.lines?.data?.length > 0 &&
              (invoice.lines.data[0] as any).period?.end
            ) {
              const invoicePeriodEnd = (invoice.lines.data[0] as any).period
                .end;
              if (invoicePeriodEnd && typeof invoicePeriodEnd === 'number') {
                terminaEm = new Date(invoicePeriodEnd * 1000);
                dataEncontrada = true;
              }
            }

            // Segundo: verificar o period_end da própria fatura
            if (!dataEncontrada && (invoice as any).period_end) {
              const invoicePeriodEnd = (invoice as any).period_end;
              if (typeof invoicePeriodEnd === 'number') {
                terminaEm = new Date(invoicePeriodEnd * 1000);
                dataEncontrada = true;
              }
            }

            // Terceiro: Se a assinatura estiver disponível na fatura, tentar buscar lá
            if (!dataEncontrada && (invoice as any).subscription) {
              try {
                const stripeSubscription = await stripe.subscriptions.retrieve(
                  (invoice as any).subscription as string,
                );

                let periodEnd = (stripeSubscription as any).current_period_end;

                if (!periodEnd && stripeSubscription.items?.data?.length > 0) {
                  periodEnd = (stripeSubscription.items.data[0] as any)
                    .current_period_end;
                }

                if (periodEnd && typeof periodEnd === 'number') {
                  terminaEm = new Date(periodEnd * 1000);
                  dataEncontrada = true;
                }
              } catch (subError) {
                console.error(
                  '[WEBHOOK] Erro ao obter detalhes da assinatura:',
                  subError,
                );
              }
            }

            // Por último, se nenhuma data válida foi encontrada, usar data padrão
            if (!dataEncontrada) {
              terminaEm.setDate(terminaEm.getDate() + 30);
            }

            await updateSubscription(userSubscription.id, {
              terminaEm: terminaEm,
            });
            console.log('[WEBHOOK] Data de término atualizada');
          } catch (error) {
            console.error('[WEBHOOK] Erro ao registrar pagamento:', error);
          }
        }

        break;
      }

      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        if (!subscription.customer) {
          console.log('[WEBHOOK] Ignorando: sem dados do cliente');
          break;
        }

        // Obter o ID do usuário das metadados do customer
        const stripeCustomer = await stripe.customers.retrieve(
          subscription.customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        const userId = customerData.metadata?.userId;

        if (!userId) {
          // Se não encontrou userId nos metadados, tenta buscar pelo customer_id
          try {
            const userSubscription = await getUserByStripeCustomerId(
              subscription.customer as string,
            );

            if (userSubscription) {
              // Verificar se é a assinatura atual que está sendo cancelada
              if (userSubscription.stripeSubscriptionId === subscription.id) {
                // Atualizar status
                try {
                  const subscriptionData = subscription as any;
                  let terminaEm: Date;

                  // Tentar obter a data de término do campo principal
                  if (subscriptionData.current_period_end) {
                    terminaEm = new Date(
                      subscriptionData.current_period_end * 1000,
                    );
                  }
                  // Ou do primeiro item da assinatura
                  else if (
                    subscription.items?.data?.length > 0 &&
                    (subscription.items.data[0] as any).current_period_end
                  ) {
                    terminaEm = new Date(
                      (subscription.items.data[0] as any).current_period_end *
                        1000,
                    );
                  }
                  // Data atual como último recurso
                  else {
                    terminaEm = new Date();
                  }

                  await updateSubscription(userSubscription.id, {
                    status: 'canceled',
                    terminaEm,
                  });
                  console.log(
                    '[WEBHOOK] Status atualizado para canceled com sucesso',
                  );
                } catch (error) {
                  console.error(
                    '[WEBHOOK] Erro ao atualizar status para canceled:',
                    error,
                  );
                }
              } else {
                console.log(
                  '[WEBHOOK] Ignorando: ID da assinatura cancelada não corresponde à assinatura atual no banco',
                );
              }
            } else {
              console.log(
                '[WEBHOOK] Ignorando: Não foi possível encontrar o usuário pelo customer_id',
              );
            }
          } catch (error) {
            console.error(
              '[WEBHOOK] Erro ao buscar assinatura pelo customer_id:',
              error,
            );
          }
        } else {
          // Buscar a assinatura do usuário
          const userSubscription = await getUserSubscription(userId);

          if (!userSubscription) {
            console.log(
              '[WEBHOOK] Ignorando: assinatura não encontrada no banco de dados',
            );
            break;
          }

          // Verificar se é a assinatura atual que está sendo cancelada
          if (userSubscription.stripeSubscriptionId === subscription.id) {
            // Atualizar status
            try {
              const subscriptionData = subscription as any;
              let terminaEm: Date;

              // Tentar obter a data de término do campo principal
              if (subscriptionData.current_period_end) {
                terminaEm = new Date(
                  subscriptionData.current_period_end * 1000,
                );
              }
              // Ou do primeiro item da assinatura
              else if (
                subscription.items?.data?.length > 0 &&
                (subscription.items.data[0] as any).current_period_end
              ) {
                terminaEm = new Date(
                  (subscription.items.data[0] as any).current_period_end * 1000,
                );
              }
              // Data atual como último recurso
              else {
                terminaEm = new Date();
              }

              await updateSubscription(userSubscription.id, {
                status: 'canceled',
                terminaEm,
              });
              console.log(
                '[WEBHOOK] Status atualizado para canceled com sucesso',
              );
            } catch (error) {
              console.error(
                '[WEBHOOK] Erro ao atualizar status para canceled:',
                error,
              );
            }
          } else {
            console.log(
              '[WEBHOOK] Ignorando: ID da assinatura cancelada não corresponde à assinatura atual no banco',
            );
          }
        }
        break;
      }

      // Outros eventos importantes...
      default:
        console.log('[WEBHOOK] Evento ignorado:', event.type);
    }

    console.log('[WEBHOOK] Processamento concluído com sucesso');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar evento do webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar evento do webhook' },
      { status: 500 },
    );
  }
}
