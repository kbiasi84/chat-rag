'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { SubmitButton } from '@/components/auth/submit-button';
import Form from 'next/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { recoverPassword, type PasswordRecoveryActionState } from '../actions';

export default function RecoverPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [buttonText, setButtonText] = useState('Enviar instruções');

  const [state, formAction] = useActionState<
    PasswordRecoveryActionState,
    FormData
  >(recoverPassword, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'failed') {
      toast({
        type: 'error',
        description: 'Erro ao processar sua solicitação.',
      });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Email inválido!',
      });
    } else if (state.status === 'user_not_found') {
      toast({
        type: 'error',
        description: 'Email não cadastrado.',
      });
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      setButtonText('Redirecionando para login...');
      toast({
        type: 'success',
        description:
          'Instruções de recuperação enviadas para seu email. Verifique a caixa de SPAM também',
      });

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  }, [state.status, recoveryAttempts, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    setRecoveryAttempts((prev) => prev + 1);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Recuperar Senha
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Digite seu email para receber instruções de recuperação
          </p>
        </div>

        <Form
          action={handleSubmit}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Email
            </Label>

            <Input
              id="email"
              name="email"
              className="bg-muted text-md md:text-sm"
              type="email"
              placeholder="usuario@email.com.br"
              autoComplete="email"
              required
              autoFocus
              defaultValue={email}
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>{buttonText}</SubmitButton>

          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
            {'Lembrou sua senha? '}
            <Link
              href="/login"
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
            >
              Voltar para o login
            </Link>
          </p>
        </Form>
      </div>
    </div>
  );
}
