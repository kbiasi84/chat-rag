import { desc, eq } from 'drizzle-orm';

import { db } from '../connection';
import { payment, type Payment } from '../../schema';

/**
 * Registra um pagamento
 */
export async function createPayment(
  userId: string,
  subscriptionId: string,
  valor: number,
  status: Payment['status'],
  stripeInvoiceId?: string,
  dataPagamento?: Date,
  invoiceUrl?: string,
) {
  try {
    await db.insert(payment).values({
      userId,
      subscriptionId,
      valor,
      status,
      stripeInvoiceId,
      dataPagamento,
      invoiceUrl,
    });
  } catch (error) {
    console.error('Falha ao registrar pagamento:', error);
    throw new Error('Não foi possível registrar o pagamento');
  }
}

/**
 * Obtém o histórico de pagamentos de um usuário
 */
export async function getUserPayments(
  userId: string,
  limite = 5,
): Promise<Payment[]> {
  try {
    return await db
      .select()
      .from(payment)
      .where(eq(payment.userId, userId))
      .orderBy(desc(payment.criadoEm))
      .limit(limite);
  } catch (error) {
    console.error('Falha ao buscar histórico de pagamentos:', error);
    throw new Error('Não foi possível buscar o histórico de pagamentos');
  }
}
