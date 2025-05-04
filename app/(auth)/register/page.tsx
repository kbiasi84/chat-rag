'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { FormularioRegistro } from '@/components/auth/register-form';
import { SubmitButton } from '@/components/auth/submit-button';
import { AuthSidebar } from '@/components/auth/auth-sidebar';

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
      toast({ type: 'error', description: 'Esta conta de email já existe!' });
    } else if (state.status === 'failed') {
      toast({
        type: 'error',
        description:
          'Falha ao criar a conta. Por favor, verifique suas informações e tente novamente.',
      });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description:
          'Preencha todos os campos corretamente. A senha deve ter pelo menos 6 caracteres.',
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
    <div className="flex h-dvh w-screen">
      {/* Coluna da esquerda - Formulário de registro */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-dp-black text-dp-white p-8">
        <div className="w-full max-w-sm flex flex-col items-center">
          <h3 className="text-2xl font-bold mb-2 text-center">
            Cadastre-se e teste grátis!
          </h3>
          <p className="text-dp-gray mb-8 text-center">
            Crie uma conta para acessar a plataforma
          </p>

          <FormularioRegistro action={handleSubmit} defaultEmail={email}>
            <SubmitButton
              isSuccessful={isSuccessful}
              className="w-full bg-dp-orange hover:bg-dp-orange/90 text-dp-white"
            >
              Cadastrar
            </SubmitButton>
            <p className="text-center text-sm text-dp-gray mt-6">
              {'Já tem uma conta? '}
              <Link
                href="/login"
                className="font-semibold text-dp-white hover:underline"
              >
                Faça login
              </Link>
              {' aqui.'}
            </p>
          </FormularioRegistro>
        </div>
      </div>

      {/* Coluna da direita - Branding */}
      <AuthSidebar />
    </div>
  );
}
