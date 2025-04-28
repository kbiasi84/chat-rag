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
  createPayment,
  updateSubscription,
  getUserSubscription,
  getUserByStripeCustomerId,
} from '@/lib/db/queries';
import { PLANOS } from '@/lib/db/schema/subscription';

/**
 * Webhook alternativo para processar eventos do Stripe sem proteção de autenticação
 */
export async function POST(req: NextRequest) {
  console.log('[WEBHOOK-ALT] Requisição recebida');

  const body = await req.text();
  const headersObj = await headers();
  const signature = headersObj.get('stripe-signature');

  if (!signature) {
    console.error('[WEBHOOK-ALT] Assinatura não encontrada nos headers');
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 });
  }

  console.log('[WEBHOOK-ALT] Assinatura encontrada');
  console.log(
    '[WEBHOOK-ALT] Secret configurado:',
    process.env.STRIPE_WEBHOOK_SECRET ? 'Sim' : 'Não',
  );

  let event: Stripe.Event;

  // Verificar assinatura do webhook
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || '',
    );
    console.log(
      '[WEBHOOK-ALT] Evento construído com sucesso. Tipo:',
      event.type,
    );
  } catch (err) {
    const error = err as Error;
    console.error(
      '[WEBHOOK-ALT] Erro na verificação da assinatura:',
      error.message,
    );
    return NextResponse.json(
      { error: `Assinatura inválida: ${error.message}` },
      { status: 400 },
    );
  }

  try {
    // Processar eventos específicos
    console.log(
      '[WEBHOOK-ALT] Processando evento:',
      event.type,
      'ID:',
      event.id,
    );

    switch (event.type) {
      // Checkout concluído - Criar ou atualizar assinatura
      case 'checkout.session.completed': {
        console.log('[WEBHOOK-ALT] Processando checkout.session.completed');
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[WEBHOOK-ALT] Checkout session mode:', session.mode);

        if (session.mode !== 'subscription') {
          console.log('[WEBHOOK-ALT] Ignorando: não é uma assinatura');
          break;
        }

        // Extrair dados relevantes
        const { customer, subscription } = session;
        console.log(
          '[WEBHOOK-ALT] Customer ID:',
          customer,
          'Subscription ID:',
          subscription,
        );

        if (!customer || !subscription) {
          console.log(
            '[WEBHOOK-ALT] Ignorando: cliente ou assinatura não encontrados',
          );
          break;
        }

        // Obter detalhes da assinatura
        console.log('[WEBHOOK-ALT] Obtendo detalhes da assinatura');
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription as string,
        );
        console.log(
          '[WEBHOOK-ALT] Metadados da assinatura:',
          JSON.stringify(stripeSubscription.metadata || {}),
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

        console.log('[WEBHOOK-ALT] Plano original:', stripeMetadataPlano);
        console.log('[WEBHOOK-ALT] Plano mapeado para chave:', planoKey);

        // Obter o ID do usuário das metadados do customer
        console.log('[WEBHOOK-ALT] Obtendo dados do cliente Stripe');
        const stripeCustomer = await stripe.customers.retrieve(
          customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        console.log(
          '[WEBHOOK-ALT] Metadados do cliente:',
          JSON.stringify(customerData.metadata || {}),
        );

        const userId = customerData.metadata?.userId;
        console.log('[WEBHOOK-ALT] User ID encontrado:', userId);

        if (!userId) {
          console.log(
            '[WEBHOOK-ALT] Ignorando: userId não encontrado nos metadados do cliente',
          );
          break;
        }

        // Atualizar ou criar assinatura no banco de dados
        console.log(
          '[WEBHOOK-ALT] Atualizando/criando assinatura no banco de dados',
        );
        try {
          // Verificar se current_period_end existe e é um número válido
          const periodEnd = (stripeSubscription as any).current_period_end;
          let terminaEm = new Date();

          if (periodEnd && typeof periodEnd === 'number') {
            // Multiplicar por 1000 para converter de segundos para milissegundos
            terminaEm = new Date(periodEnd * 1000);
            console.log(
              '[WEBHOOK-ALT] Data de término calculada:',
              terminaEm.toISOString(),
            );
          } else {
            // Se não houver data válida, definir para 30 dias no futuro
            terminaEm.setDate(terminaEm.getDate() + 30);
            console.log(
              '[WEBHOOK-ALT] Data de término padrão calculada:',
              terminaEm.toISOString(),
            );
          }

          await upsertSubscription(
            userId,
            planoKey,
            customer as string,
            subscription as string,
            'active',
            terminaEm,
          );
          console.log('[WEBHOOK-ALT] Assinatura atualizada com sucesso');

          // Cancelar outras assinaturas ativas do Stripe para este cliente
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer as string,
              status: 'active',
            });
            for (const sub of subscriptions.data) {
              if (sub.id !== subscription) {
                await stripe.subscriptions.cancel(sub.id);
                console.log(
                  `[WEBHOOK-ALT] Assinatura antiga cancelada: ${sub.id}`,
                );
              }
            }
            console.log(
              '[WEBHOOK-ALT] Assinaturas antigas do Stripe canceladas com sucesso',
            );
          } catch (cancelError) {
            console.error(
              '[WEBHOOK-ALT] Erro ao cancelar assinaturas antigas no Stripe:',
              cancelError,
            );
          }
        } catch (error) {
          console.error('[WEBHOOK-ALT] Erro ao atualizar assinatura:', error);
        }

        break;
      }

      // Fatura paga - Registrar pagamento
      case 'invoice.paid': {
        console.log('[WEBHOOK-ALT] Processando invoice.paid');
        const invoice = event.data.object as Stripe.Invoice;
        console.log(
          '[WEBHOOK-ALT] Invoice ID:',
          invoice.id,
          'Customer:',
          invoice.customer,
        );

        // Verificar apenas se há customer ID
        if (!invoice.customer) {
          console.log(
            '[WEBHOOK-ALT] Ignorando: cliente não encontrado na fatura',
          );
          break;
        }

        // Obter o ID do usuário a partir dos metadados do customer
        console.log('[WEBHOOK-ALT] Obtendo dados do cliente');
        const stripeCustomer = await stripe.customers.retrieve(
          invoice.customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        console.log(
          '[WEBHOOK-ALT] Metadados do cliente:',
          JSON.stringify(customerData.metadata || {}),
        );

        const userId = customerData.metadata?.userId;
        console.log('[WEBHOOK-ALT] User ID encontrado:', userId);

        if (!userId) {
          // Se não encontrou userId nos metadados, tenta buscar pelo customer_id
          console.log(
            '[WEBHOOK-ALT] Tentando buscar assinatura pelo customer_id:',
            invoice.customer,
          );

          try {
            const userSubscription = await getUserByStripeCustomerId(
              invoice.customer as string,
            );

            if (userSubscription) {
              console.log(
                '[WEBHOOK-ALT] Assinatura encontrada pelo customer_id:',
                userSubscription.id,
              );
              console.log(
                '[WEBHOOK-ALT] User ID encontrado pela assinatura:',
                userSubscription.userId,
              );

              // Continuar o processamento com o userId encontrado
              const foundUserId = userSubscription.userId;

              // Registrar o pagamento
              console.log('[WEBHOOK-ALT] Registrando pagamento');
              try {
                // Verificar se a fatura tem URL pública
                const invoiceUrl = invoice.hosted_invoice_url || undefined;
                console.log('[WEBHOOK-ALT] URL da fatura:', invoiceUrl);

                await createPayment(
                  foundUserId,
                  userSubscription.id,
                  invoice.amount_paid,
                  'paid',
                  invoice.id,
                  new Date(),
                  invoiceUrl,
                );
                console.log('[WEBHOOK-ALT] Pagamento registrado com sucesso');

                // Tentar obter detalhes da assinatura se existir
                let terminaEm = new Date();

                // Se a assinatura estiver disponível na fatura, usamos ela
                if ((invoice as any).subscription) {
                  console.log(
                    '[WEBHOOK-ALT] Subscription ID encontrado na fatura:',
                    (invoice as any).subscription,
                  );
                  try {
                    const stripeSubscription =
                      await stripe.subscriptions.retrieve(
                        (invoice as any).subscription as string,
                      );

                    const periodEnd = (stripeSubscription as any)
                      .current_period_end;
                    if (periodEnd && typeof periodEnd === 'number') {
                      // Multiplicar por 1000 para converter de segundos para milissegundos
                      terminaEm = new Date(periodEnd * 1000);
                      console.log(
                        '[WEBHOOK-ALT] Data de término calculada da API:',
                        terminaEm.toISOString(),
                      );
                    }
                  } catch (subError) {
                    console.error(
                      '[WEBHOOK-ALT] Erro ao obter detalhes da assinatura:',
                      subError,
                    );
                    // Continuar com a data padrão
                  }
                } else {
                  // Se não houver subscription ID, usar data padrão
                  terminaEm.setDate(terminaEm.getDate() + 30);
                  console.log(
                    '[WEBHOOK-ALT] Data de término padrão calculada:',
                    terminaEm.toISOString(),
                  );
                }

                await updateSubscription(userSubscription.id, {
                  terminaEm: terminaEm,
                });
                console.log('[WEBHOOK-ALT] Data de término atualizada');
              } catch (error) {
                console.error(
                  '[WEBHOOK-ALT] Erro ao registrar pagamento:',
                  error,
                );
              }

              break;
            } else {
              console.log(
                '[WEBHOOK-ALT] Ignorando: Não foi possível encontrar o usuário pelo customer_id',
              );
              break;
            }
          } catch (error) {
            console.error(
              '[WEBHOOK-ALT] Erro ao buscar assinatura pelo customer_id:',
              error,
            );
            break;
          }
        } else {
          // Buscar a assinatura do usuário diretamente pelo userId
          // em vez de depender do invoice.subscription
          console.log(
            '[WEBHOOK-ALT] Buscando assinatura do usuário no banco de dados',
          );
          const userSubscription = await getUserSubscription(userId);

          if (!userSubscription) {
            console.log(
              '[WEBHOOK-ALT] Ignorando: assinatura não encontrada no banco de dados',
            );
            break;
          }
          console.log(
            '[WEBHOOK-ALT] Assinatura encontrada no banco:',
            userSubscription.id,
          );

          // Se chegou aqui, é uma assinatura antiga e pode ser cancelada
          console.log(
            '[WEBHOOK-ALT] Esta é uma assinatura antiga, prosseguindo com cancelamento',
          );

          // Registrar o pagamento
          console.log('[WEBHOOK-ALT] Registrando pagamento');
          try {
            // Verificar se a fatura tem URL pública
            const invoiceUrl = invoice.hosted_invoice_url || undefined;
            console.log('[WEBHOOK-ALT] URL da fatura:', invoiceUrl);

            await createPayment(
              userId,
              userSubscription.id,
              invoice.amount_paid,
              'paid',
              invoice.id,
              new Date(),
              invoiceUrl,
            );
            console.log('[WEBHOOK-ALT] Pagamento registrado com sucesso');

            // Tentar obter detalhes da assinatura se existir
            let terminaEm = new Date();

            // Se a assinatura estiver disponível na fatura, usamos ela
            if ((invoice as any).subscription) {
              console.log(
                '[WEBHOOK-ALT] Subscription ID encontrado na fatura:',
                (invoice as any).subscription,
              );
              try {
                const stripeSubscription = await stripe.subscriptions.retrieve(
                  (invoice as any).subscription as string,
                );

                const periodEnd = (stripeSubscription as any)
                  .current_period_end;
                if (periodEnd && typeof periodEnd === 'number') {
                  // Multiplicar por 1000 para converter de segundos para milissegundos
                  terminaEm = new Date(periodEnd * 1000);
                  console.log(
                    '[WEBHOOK-ALT] Data de término calculada da API:',
                    terminaEm.toISOString(),
                  );
                }
              } catch (subError) {
                console.error(
                  '[WEBHOOK-ALT] Erro ao obter detalhes da assinatura:',
                  subError,
                );
                // Continuar com a data padrão
              }
            } else {
              // Se não houver subscription ID, usar data padrão
              terminaEm.setDate(terminaEm.getDate() + 30);
              console.log(
                '[WEBHOOK-ALT] Data de término padrão calculada:',
                terminaEm.toISOString(),
              );
            }

            await updateSubscription(userSubscription.id, {
              terminaEm: terminaEm,
            });
            console.log('[WEBHOOK-ALT] Data de término atualizada');
          } catch (error) {
            console.error('[WEBHOOK-ALT] Erro ao registrar pagamento:', error);
          }
        }

        break;
      }

      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        console.log('[WEBHOOK-ALT] Processando customer.subscription.deleted');
        const subscription = event.data.object as Stripe.Subscription;
        console.log(
          '[WEBHOOK-ALT] ID da assinatura cancelada:',
          subscription.id,
        );

        // Verificar se temos dados do cliente
        if (!subscription.customer) {
          console.log('[WEBHOOK-ALT] Ignorando: sem dados do cliente');
          break;
        }

        // Obter o ID do usuário das metadados do customer
        console.log('[WEBHOOK-ALT] Obtendo dados do cliente');
        const stripeCustomer = await stripe.customers.retrieve(
          subscription.customer as string,
        );

        // Acesso seguro aos metadados
        const customerData = stripeCustomer as Stripe.Customer;
        console.log(
          '[WEBHOOK-ALT] Metadados do cliente:',
          JSON.stringify(customerData.metadata || {}),
        );

        const userId = customerData.metadata?.userId;
        console.log('[WEBHOOK-ALT] User ID encontrado:', userId);

        if (!userId) {
          // Se não encontrou userId nos metadados, tenta buscar pelo customer_id
          console.log(
            '[WEBHOOK-ALT] Tentando buscar assinatura pelo customer_id:',
            subscription.customer,
          );

          try {
            const userSubscription = await getUserByStripeCustomerId(
              subscription.customer as string,
            );

            if (userSubscription) {
              console.log(
                '[WEBHOOK-ALT] Assinatura encontrada pelo customer_id:',
                userSubscription.id,
              );

              // Verificar se é a assinatura atual que está sendo cancelada
              if (userSubscription.stripeSubscriptionId === subscription.id) {
                console.log(
                  '[WEBHOOK-ALT] Esta é a assinatura atual, prosseguindo com cancelamento',
                );

                // Atualizar status
                try {
                  const subscriptionData = subscription as any;
                  const terminaEm = subscriptionData.current_period_end
                    ? new Date(subscriptionData.current_period_end * 1000)
                    : new Date();

                  console.log(
                    '[WEBHOOK-ALT] Atualizando status para canceled, termina em:',
                    terminaEm,
                  );

                  await updateSubscription(userSubscription.id, {
                    status: 'canceled',
                    terminaEm,
                  });
                  console.log(
                    '[WEBHOOK-ALT] Status atualizado para canceled com sucesso',
                  );
                } catch (error) {
                  console.error(
                    '[WEBHOOK-ALT] Erro ao atualizar status para canceled:',
                    error,
                  );
                }
              } else {
                console.log(
                  '[WEBHOOK-ALT] Ignorando: ID da assinatura cancelada não corresponde à assinatura atual no banco',
                );
                console.log('[WEBHOOK-ALT] ID cancelado:', subscription.id);
                console.log(
                  '[WEBHOOK-ALT] ID no banco:',
                  userSubscription.stripeSubscriptionId,
                );
              }
            } else {
              console.log(
                '[WEBHOOK-ALT] Ignorando: Não foi possível encontrar o usuário pelo customer_id',
              );
            }
          } catch (error) {
            console.error(
              '[WEBHOOK-ALT] Erro ao buscar assinatura pelo customer_id:',
              error,
            );
          }
        } else {
          // Buscar a assinatura do usuário
          console.log(
            '[WEBHOOK-ALT] Buscando assinatura do usuário no banco de dados',
          );
          const userSubscription = await getUserSubscription(userId);

          if (!userSubscription) {
            console.log(
              '[WEBHOOK-ALT] Ignorando: assinatura não encontrada no banco de dados',
            );
            break;
          }

          // Verificar se é a assinatura atual que está sendo cancelada
          if (userSubscription.stripeSubscriptionId === subscription.id) {
            console.log(
              '[WEBHOOK-ALT] Esta é a assinatura atual, prosseguindo com cancelamento',
            );

            // Atualizar status
            try {
              const subscriptionData = subscription as any;
              const terminaEm = subscriptionData.current_period_end
                ? new Date(subscriptionData.current_period_end * 1000)
                : new Date();

              console.log(
                '[WEBHOOK-ALT] Atualizando status para canceled, termina em:',
                terminaEm,
              );

              await updateSubscription(userSubscription.id, {
                status: 'canceled',
                terminaEm,
              });
              console.log(
                '[WEBHOOK-ALT] Status atualizado para canceled com sucesso',
              );
            } catch (error) {
              console.error(
                '[WEBHOOK-ALT] Erro ao atualizar status para canceled:',
                error,
              );
            }
          } else {
            console.log(
              '[WEBHOOK-ALT] Ignorando: ID da assinatura cancelada não corresponde à assinatura atual no banco',
            );
            console.log('[WEBHOOK-ALT] ID cancelado:', subscription.id);
            console.log(
              '[WEBHOOK-ALT] ID no banco:',
              userSubscription.stripeSubscriptionId,
            );
          }
        }
        break;
      }

      // Outros eventos importantes...
      default:
        console.log('[WEBHOOK-ALT] Evento ignorado:', event.type);
    }

    console.log('[WEBHOOK-ALT] Processamento concluído com sucesso');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK-ALT] Erro ao processar evento do webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao processar evento do webhook' },
      { status: 500 },
    );
  }
}
