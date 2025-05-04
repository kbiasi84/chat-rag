'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { AuthForm } from '@/components/auth/login-form';
import { SubmitButton } from '@/components/auth/submit-button';

import { login, type LoginActionState } from '../actions';

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: 'idle',
    },
  );

  useEffect(() => {
    if (state.status === 'failed') {
      toast({
        type: 'error',
        description: 'Credenciais inválidas!',
      });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Falha na validação dos dados enviados!',
      });
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      router.refresh();
    }
  }, [state.status, loginAttempts, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    setLoginAttempts((prev) => prev + 1);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Entrar</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Use seu e-mail e senha para entrar
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email}>
          <div className="flex justify-end w-full">
            <Link
              href="/recover-password"
              className="text-sm text-gray-600 hover:underline dark:text-zinc-400"
            >
              Esqueceu sua senha?
            </Link>
          </div>
          <SubmitButton isSuccessful={isSuccessful}>Entrar</SubmitButton>
          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {'Ainda não tem uma conta? '}
            <Link
              href="/register"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Cadastre-se
            </Link>
            {' gratuitamente.'}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
