'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { LoginForm } from '@/components/auth/login-form';
import { SubmitButton } from '@/components/auth/submit-button';
import { AuthSidebar } from '@/components/auth/auth-sidebar';

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
    <div className="flex h-dvh w-screen">
      {/* Coluna da esquerda - Formulário de login */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-dp-black text-dp-white p-8">
        <div className="w-full max-w-sm flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-2 text-center">Bem-vindo,</h2>
          <p className="text-dp-gray mb-8 text-center">
            Entre com seu e-mail e senha para continuar
          </p>

          <LoginForm action={handleSubmit} defaultEmail={email}>
            <div className="flex justify-end w-full mb-4">
              <Link
                href="/recover-password"
                className="text-sm text-dp-gray hover:text-dp-white hover:underline transition-colors"
              >
                Esqueceu sua senha?
              </Link>
            </div>
            <SubmitButton
              isSuccessful={isSuccessful}
              className="w-full bg-dp-orange hover:bg-dp-orange/90 text-dp-white"
            >
              <span className="mx-auto">Entrar</span>
            </SubmitButton>

            <div className="flex items-center my-6 w-full">
              <div className="flex-1 h-px bg-dp-gray/30" />
              <p className="px-4 text-dp-gray text-sm">Ou</p>
              <div className="flex-1 h-px bg-dp-gray/30" />
            </div>

            <p className="text-center text-sm text-dp-gray mt-2">
              {'Ainda não tem uma conta? '}
              <Link
                href="/register"
                className="font-semibold text-dp-white hover:underline transition-colors"
              >
                Cadastre-se
              </Link>
              {' gratuitamente.'}
            </p>
          </LoginForm>
        </div>
      </div>

      {/* Coluna da direita - Branding */}
      <AuthSidebar />
    </div>
  );
}
