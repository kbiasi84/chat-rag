'use server';

import { db } from '@/lib/db';
import { user } from '@/lib/db/schema/user';
import { desc, eq } from 'drizzle-orm';

export interface UserWithCreatedAt {
  id: string;
  email: string;
  nome?: string | null;
  perfil?: string | null;
  whatsapp?: string | null;
  atividade?: string | null;
  criadoEm: Date;
}

/**
 * Busca todos os usuários no banco de dados
 * @returns Lista de usuários ordenados por data de criação (mais recentes primeiro)
 */
export async function getAllUsers(): Promise<UserWithCreatedAt[]> {
  try {
    const users = await db
      .select({
        id: user.id,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil,
        whatsapp: user.whatsapp,
        atividade: user.atividade,
        criadoEm: user.criadoEm,
      })
      .from(user)
      .orderBy(desc(user.criadoEm));

    return users;
  } catch (error) {
    console.error('Falha ao buscar usuários:', error);
    throw new Error('Não foi possível obter a lista de usuários');
  }
}

/**
 * Atualiza o perfil de um usuário (promover a admin ou rebaixar para usuário comum)
 */
export async function updateUserRole(
  userId: string,
  newRole: 'admin' | 'usuario',
) {
  try {
    await db
      .update(user)
      .set({
        perfil: newRole,
        atualizadoEm: new Date(),
      })
      .where(eq(user.id, userId));

    return { success: true, message: 'Perfil atualizado com sucesso' };
  } catch (error) {
    console.error('Falha ao atualizar perfil do usuário:', error);
    return {
      success: false,
      message: 'Não foi possível atualizar o perfil do usuário',
    };
  }
}
