'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { SubmitButton } from '@/components/auth/submit-button';
import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { AuthSidebar } from '@/components/auth/auth-sidebar';
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
    <div className="flex h-dvh w-screen">
      {/* Coluna da esquerda - Formulário de redefinição de senha */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-dp-black text-dp-white p-8">
        <div className="w-full max-w-sm flex flex-col items-center">
          <h3 className="text-2xl font-bold mb-2 text-center">
            Redefinir Senha
          </h3>
          <p className="text-dp-gray mb-8 text-center">
            Digite sua nova senha abaixo
          </p>

          <PasswordResetForm action={handleFormAction} token={token}>
            <SubmitButton
              isSuccessful={isSuccessful}
              className="w-full bg-dp-orange hover:bg-dp-orange/90 text-dp-white"
            >
              {buttonText}
            </SubmitButton>

            <p className="text-center text-sm text-dp-gray mt-6">
              <Link
                href="/login"
                className="font-semibold text-dp-white hover:underline"
              >
                Voltar para o login
              </Link>
            </p>
          </PasswordResetForm>
        </div>
      </div>

      {/* Coluna da direita - Branding */}
      <AuthSidebar />
    </div>
  );
}
