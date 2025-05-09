'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema/user';
import { eq } from 'drizzle-orm';
import { compare, hashSync, genSaltSync } from 'bcrypt-ts';
import { getUser } from '@/lib/db/queries/user';

// Schema para alteração de senha
const alterarSenhaSchema = z.object({
  userId: z.string().uuid(),
  senhaAtual: z.string().min(6),
  novaSenha: z.string().min(6),
});

export interface AlterarSenhaState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'senha_incorreta';
  message?: string;
}

/**
 * Altera a senha do usuário após verificar a senha atual
 */
export async function alterarSenha(
  formData: FormData,
): Promise<AlterarSenhaState> {
  try {
    // Validar dados do formulário
    const validatedData = alterarSenhaSchema.parse({
      userId: formData.get('userId'),
      senhaAtual: formData.get('senhaAtual'),
      novaSenha: formData.get('novaSenha'),
    });

    // Buscar usuário pelo ID
    const [usuario] = await db
      .select()
      .from(user)
      .where(eq(user.id, validatedData.userId))
      .limit(1);

    if (!usuario || !usuario.senha) {
      return {
        status: 'failed',
        message: 'Usuário não encontrado',
      };
    }

    // Verificar se a senha atual está correta
    const senhaCorreta = await compare(validatedData.senhaAtual, usuario.senha);

    if (!senhaCorreta) {
      return {
        status: 'senha_incorreta',
        message: 'A senha atual está incorreta',
      };
    }

    // Gerar hash da nova senha
    const salt = genSaltSync(10);
    const hash = hashSync(validatedData.novaSenha, salt);

    // Atualizar senha no banco de dados
    await db
      .update(user)
      .set({
        senha: hash,
        atualizadoEm: new Date(),
      })
      .where(eq(user.id, validatedData.userId));

    return {
      status: 'success',
      message: 'Senha alterada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao alterar senha:', error);

    if (error instanceof z.ZodError) {
      return {
        status: 'failed',
        message: 'Dados inválidos para alteração de senha',
      };
    }

    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
