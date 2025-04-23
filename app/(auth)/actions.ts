'use server';

import { z } from 'zod';

import { createUser, getUser, updateUserProfile } from '@/lib/db/queries';

import { signIn } from './auth';

// Schema separado para login
const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
});

// Schema completo para registro
const registerSchema = z.object({
  nome: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  whatsapp: z
    .string()
    .min(14, { message: 'WhatsApp deve estar no formato (99) 99999-9999' }),
  atividade: z.string().min(2, { message: 'Atividade é obrigatória' }),
  senha: z
    .string()
    .min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = loginSchema.parse({
      email: formData.get('email'),
      senha: formData.get('senha'),
    });

    await signIn('credentials', {
      email: validatedData.email,
      senha: validatedData.senha,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    console.error('Erro no login:', error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = registerSchema.parse({
      nome: formData.get('nome'),
      email: formData.get('email'),
      whatsapp: formData.get('whatsapp'),
      atividade: formData.get('atividade'),
      senha: formData.get('senha'),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: 'user_exists' };
    }

    try {
      await createUser(
        validatedData.nome,
        validatedData.email,
        validatedData.whatsapp,
        validatedData.atividade,
        validatedData.senha,
      );

      try {
        await signIn('credentials', {
          email: validatedData.email,
          senha: validatedData.senha,
          redirect: false,
        });

        return { status: 'success' };
      } catch (signInError) {
        console.error('Erro ao fazer login após registro:', signInError);
        // Mesmo com erro no signIn, retornamos sucesso pois o usuário foi criado
        return { status: 'success' };
      }
    } catch (dbError) {
      console.error('Erro ao criar usuário no banco de dados:', dbError);
      return { status: 'failed' };
    }
  } catch (error) {
    console.error('Erro no registro:', error);
    if (error instanceof z.ZodError) {
      console.error('Erros de validação:', error.errors);
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface UpdateProfileActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed';
  message?: string;
}

export const updateProfile = async (
  _: UpdateProfileActionState,
  formData: FormData,
): Promise<UpdateProfileActionState> => {
  try {
    const userId = formData.get('userId') as string;

    if (!userId) {
      return {
        status: 'failed',
        message: 'ID do usuário não encontrado',
      };
    }

    const data = {
      nome: (formData.get('nome') as string) || undefined,
      whatsapp: (formData.get('whatsapp') as string) || undefined,
      atividade: (formData.get('atividade') as string) || undefined,
    };

    const result = await updateUserProfile(userId, data);

    if (result.success) {
      return {
        status: 'success',
        message: result.message,
      };
    } else {
      return {
        status: 'failed',
        message: result.message,
      };
    }
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};
