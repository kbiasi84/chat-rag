'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { SubmitButton } from '@/components/auth/submit-button';
import Form from 'next/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword, type ResetPasswordActionState } from '../actions';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [resetAttempts, setResetAttempts] = useState(0);
  const [buttonText, setButtonText] = useState('Redefinir Senha');

  const [state, formAction] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPassword, {
    status: 'idle',
  });

  useEffect(() => {
    if (!token) {
      toast({
        type: 'error',
        description: 'Token de recuperação inválido ou ausente.',
      });
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  }, [token, router]);

  useEffect(() => {
    if (state.status === 'failed') {
      toast({
        type: 'error',
        description: 'Ocorreu um erro ao redefinir sua senha.',
      });
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description:
          'Dados inválidos. Verifique se as senhas correspondem e têm pelo menos 6 caracteres.',
      });
    } else if (state.status === 'invalid_token') {
      toast({
        type: 'error',
        description: 'Token inválido ou expirado.',
      });
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } else if (state.status === 'success') {
      setIsSuccessful(true);
      setButtonText('Redirecionando para login...');
      toast({
        type: 'success',
        description: 'Senha redefinida com sucesso!',
      });
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
  }, [state.status, resetAttempts, router]);

  const handleFormAction = (formData: FormData) => {
    setResetAttempts((prev) => prev + 1);
    formAction(formData);
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Redefinir Senha
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Digite sua nova senha abaixo
          </p>
        </div>

        <Form
          action={handleFormAction}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <input type="hidden" name="token" value={token || ''} />

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="senha"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Nova Senha
            </Label>
            <Input
              id="senha"
              name="senha"
              className="bg-muted text-md md:text-sm"
              type="password"
              placeholder="Digite sua nova senha"
              autoComplete="new-password"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="confirmarSenha"
              className="text-zinc-600 font-normal dark:text-zinc-400"
            >
              Confirmar Senha
            </Label>
            <Input
              id="confirmarSenha"
              name="confirmarSenha"
              className="bg-muted text-md md:text-sm"
              type="password"
              placeholder="Confirme sua nova senha"
              autoComplete="new-password"
              required
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>{buttonText}</SubmitButton>

          <p className="text-center text-sm text-gray-600 mt-4 dark:text-zinc-400">
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
