'use server';

import { z } from 'zod';

import { createUser, getUser } from '@/lib/db/queries';

import { signIn } from './auth';

const authFormSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  whatsapp: z.string().min(14), // considerando máscara com (99) 99999-9999
  atividade: z.string().min(2),
  senha: z.string().min(6),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
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
    const validatedData = authFormSchema.parse({
      nome: formData.get('nome'),
      email: formData.get('email'),
      whatsapp: formData.get('whatsapp'),
      atividade: formData.get('atividade'),
      senha: formData.get('senha'),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: 'user_exists' } as RegisterActionState;
    }

    await createUser(
      validatedData.nome,
      validatedData.email,
      validatedData.whatsapp,
      validatedData.atividade,
      validatedData.senha,
    );

    await signIn('credentials', {
      email: validatedData.email,
      senha: validatedData.senha,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};
