import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, eq, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '../connection';
import { user, type User } from '../../schema';

export async function getUser(email: string): Promise<Array<User>> {
  try {
    // Selecionando campos explicitamente para garantir que todos sejam retornados
    const result = await db
      .select({
        id: user.id,
        email: user.email,
        nome: user.nome,
        senha: user.senha,
        whatsapp: user.whatsapp,
        atividade: user.atividade,
        perfil: user.perfil,
        resetToken: user.resetToken,
        resetTokenExpires: user.resetTokenExpires,
        criadoEm: user.criadoEm,
        atualizadoEm: user.atualizadoEm,
      })
      .from(user)
      .where(eq(user.email, email));

    console.log(
      'getUser - Resultado completo:',
      JSON.stringify(result, null, 2),
    );
    return result;
  } catch (error) {
    console.error('Falha ao buscar usuário no banco de dados:', error);
    throw new Error('Falha ao buscar usuário no banco de dados');
  }
}

export async function createUser(
  nome: string,
  email: string,
  whatsapp: string,
  atividade: string,
  senha: string,
  perfil = 'usuario', // Valor padrão, se não for fornecido
): Promise<string> {
  const salt = genSaltSync(10);
  const hash = hashSync(senha, salt);

  try {
    console.log('createUser - Criando usuário com os dados:', {
      nome,
      email,
      whatsapp,
      atividade,
      perfil,
    });

    const [result] = await db
      .insert(user)
      .values({
        nome,
        email,
        whatsapp,
        atividade,
        senha: hash,
        perfil, // Definindo explicitamente o perfil
      })
      .returning({ id: user.id });

    // Buscar o usuário recém-criado para confirmar todos os campos
    const novoUsuario = await getUser(email);
    console.log(
      'createUser - Usuário criado:',
      JSON.stringify(novoUsuario, null, 2),
    );

    return result.id;
  } catch (error) {
    console.error('Falha ao gravar usuário no banco de dados:', error);

    // Verificar se é um erro de restrição única (usuário já existe)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('duplicate key')
    ) {
      throw new Error('Este email já está sendo utilizado por outro usuário');
    }

    throw new Error(
      'Não foi possível criar o usuário. Por favor, tente novamente.',
    );
  }
}

export async function updateUserProfile(
  userId: string,
  data: {
    nome?: string;
    whatsapp?: string;
    atividade?: string;
  },
) {
  try {
    console.log('Atualizando perfil do usuário:', userId);
    console.log('Dados para atualização:', data);

    // Filtrar campos nulos ou indefinidos
    const filteredData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        filteredData[key] = value;
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return { success: false, message: 'Nenhum dado válido para atualização' };
    }

    // Adicionar timestamp de atualização
    filteredData.atualizadoEm = new Date();

    await db.update(user).set(filteredData).where(eq(user.id, userId));

    return { success: true, message: 'Perfil atualizado com sucesso' };
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Erro ao atualizar perfil' };
  }
}

/**
 * Cria um token de recuperação de senha para um usuário
 * @param userId ID do usuário
 * @returns O token de recuperação gerado
 */
export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  try {
    // Gerar um token único
    const token = uuidv4();

    // Definir data de expiração (1 hora)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Atualizar o usuário com o token
    await db
      .update(user)
      .set({
        resetToken: token,
        resetTokenExpires: expiresAt,
      })
      .where(eq(user.id, userId));

    console.log(`Token de recuperação criado para usuário ${userId}`);
    return token;
  } catch (error) {
    console.error('Falha ao criar token de recuperação:', error);
    throw new Error('Não foi possível criar o token de recuperação');
  }
}

/**
 * Valida um token de recuperação de senha
 * @param token Token a ser validado
 * @returns O usuário associado ao token se válido, null caso contrário
 */
export async function validatePasswordResetToken(
  token: string,
): Promise<User | null> {
  try {
    const now = new Date();

    // Buscar usuário com o token fornecido que ainda não expirou
    const result = await db
      .select()
      .from(user)
      .where(and(eq(user.resetToken, token), gt(user.resetTokenExpires, now)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Falha ao validar token de recuperação:', error);
    throw new Error('Não foi possível validar o token de recuperação');
  }
}

/**
 * Atualiza a senha de um usuário e limpa o token de recuperação
 * @param userId ID do usuário
 * @param newPassword Nova senha (não criptografada)
 */
export async function updateUserPasswordAndClearToken(
  userId: string,
  newPassword: string,
): Promise<void> {
  try {
    // Criptografar a nova senha
    const salt = genSaltSync(10);
    const hashedPassword = hashSync(newPassword, salt);

    // Atualizar usuário com nova senha e limpar token
    await db
      .update(user)
      .set({
        senha: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      })
      .where(eq(user.id, userId));

    console.log(`Senha atualizada para usuário ${userId}`);
  } catch (error) {
    console.error('Falha ao atualizar senha do usuário:', error);
    throw new Error('Não foi possível atualizar a senha');
  }
}
