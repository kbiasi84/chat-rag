import { desc, eq } from 'drizzle-orm';

import { db } from '../connection';
import {
  subscription,
  type Subscription,
  PLANOS,
  LIMITES_CONSULTA,
} from '../../schema';

/**
 * Cria uma assinatura gratuita para um novo usuário (3 consultas)
 */
export async function createFreeSubscription(userId: string) {
  try {
    const result = await db.insert(subscription).values({
      userId,
      plano: PLANOS.FREE,
      status: 'active',
    });

    return result;
  } catch (error) {
    console.error('Falha ao criar assinatura gratuita:', error);
    throw new Error('Não foi possível criar a assinatura gratuita');
  }
}

/**
 * Obtém a assinatura atual de um usuário
 */
export async function getUserSubscription(
  userId: string,
): Promise<Subscription | null> {
  try {
    const result = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .orderBy(desc(subscription.criadoEm))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Falha ao buscar assinatura do usuário:', error);
    throw new Error('Não foi possível verificar a assinatura');
  }
}

/**
 * Atualiza uma assinatura existente
 */
export async function updateSubscription(
  subscriptionId: string,
  data: Partial<Omit<Subscription, 'id' | 'userId' | 'criadoEm'>>,
) {
  try {
    return await db
      .update(subscription)
      .set({
        ...data,
        atualizadoEm: new Date(),
      })
      .where(eq(subscription.id, subscriptionId));
  } catch (error) {
    console.error('Falha ao atualizar assinatura:', error);
    throw new Error('Não foi possível atualizar a assinatura');
  }
}

/**
 * Cria ou atualiza uma assinatura com dados do Stripe
 */
export async function upsertSubscription(
  userId: string,
  plano: (typeof PLANOS)[keyof typeof PLANOS],
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  status: Subscription['status'] = 'active',
  terminaEm?: Date,
) {
  try {
    // Verificar se já existe uma assinatura
    const existingSubscription = await getUserSubscription(userId);

    if (existingSubscription) {
      // Verificar se o plano mudou
      const planChanged = existingSubscription.plano !== plano.toLowerCase();

      // Atualizar a assinatura existente
      await db
        .update(subscription)
        .set({
          plano,
          status,
          stripeCustomerId,
          stripeSubscriptionId,
          terminaEm,
          // Zerar a contagem de consultas se o plano mudou
          ...(planChanged ? { consultasUsadas: 0 } : {}),
          atualizadoEm: new Date(),
        })
        .where(eq(subscription.id, existingSubscription.id));

      // Registrar no log se o plano mudou
      if (planChanged) {
        console.log(
          `Plano alterado de ${existingSubscription.plano} para ${plano}. Contagem de consultas zerada.`,
        );
      }

      return existingSubscription.id;
    } else {
      // Criar uma nova assinatura
      const [result] = await db
        .insert(subscription)
        .values({
          userId,
          plano,
          status,
          stripeCustomerId,
          stripeSubscriptionId,
          terminaEm,
          consultasUsadas: 0, // Sempre começa com zero consultas em uma nova assinatura
        })
        .returning({ id: subscription.id });

      return result.id;
    }
  } catch (error) {
    console.error('Falha ao atualizar assinatura com dados do Stripe:', error);
    throw new Error('Não foi possível processar a assinatura');
  }
}

/**
 * Incrementa o contador de consultas usadas
 */
export async function incrementConsultasUsadas(userId: string) {
  try {
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
      throw new Error('Assinatura não encontrada');
    }

    await db
      .update(subscription)
      .set({
        consultasUsadas: userSubscription.consultasUsadas + 1,
        atualizadoEm: new Date(),
      })
      .where(eq(subscription.id, userSubscription.id));

    return userSubscription.consultasUsadas + 1;
  } catch (error) {
    console.error('Falha ao incrementar consultas usadas:', error);
    throw new Error('Não foi possível atualizar o contador de consultas');
  }
}

/**
 * Verifica se o usuário ainda tem consultas disponíveis
 */
export async function checkConsultaDisponivel(
  userId: string,
): Promise<boolean> {
  try {
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
      // Se não tem assinatura, criar uma gratuita
      await createFreeSubscription(userId);
      return true; // Primeira consulta disponível
    }

    // Verificar se a assinatura está ativa
    if (
      userSubscription.status !== 'active' &&
      userSubscription.status !== 'trialing'
    ) {
      return false;
    }

    // Verificar se já ultrapassou o limite de consultas
    const limite =
      LIMITES_CONSULTA[userSubscription.plano as keyof typeof LIMITES_CONSULTA];
    return userSubscription.consultasUsadas < limite;
  } catch (error) {
    console.error('Falha ao verificar disponibilidade de consultas:', error);
    throw new Error('Não foi possível verificar disponibilidade de consultas');
  }
}

/**
 * Busca uma assinatura pelo ID do cliente do Stripe
 */
export async function getUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Subscription | null> {
  try {
    const result = await db
      .select()
      .from(subscription)
      .where(eq(subscription.stripeCustomerId, stripeCustomerId))
      .orderBy(desc(subscription.criadoEm))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Falha ao buscar usuário pelo ID do cliente Stripe:', error);
    throw new Error('Não foi possível encontrar o usuário');
  }
}
