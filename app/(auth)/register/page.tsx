'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/toast';

import { FormularioRegistro } from '@/components/formulario-registro';
import { SubmitButton } from '@/components/submit-button';

import { register, type RegisterActionState } from '../actions';

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast({ type: 'error', description: 'Esta conta já existe!' });
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: 'Falha ao criar a conta!' });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Falha na validação dos dados enviados!',
      });
    } else if (state.status === 'success') {
      toast({ type: 'success', description: 'Conta criada com sucesso!' });
      setIsSuccessful(true);

      // Redirecionando após sucesso - se o login automático falhar,
      // pelo menos o usuário será direcionado para a página de login
      setTimeout(() => {
        router.push('/');
      }, 1500);
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl gap-12 flex flex-col">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Cadastre-se
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Crie uma conta para acessar a plataforma
          </p>
        </div>

        <FormularioRegistro action={handleSubmit} defaultEmail={email}>
          <SubmitButton isSuccessful={isSuccessful}>Cadastrar</SubmitButton>
          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {'Já tem uma conta? '}
            <Link
              href="/login"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Faça login
            </Link>
            {' aqui.'}
          </p>
        </FormularioRegistro>
      </div>
    </div>
  );
}
