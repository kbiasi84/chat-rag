'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from '@/components/common/toast';

import { SubmitButton } from '@/components/auth/submit-button';
import { PasswordRecoverForm } from '@/components/auth/password-recover-form';
import { AuthSidebar } from '@/components/auth/auth-sidebar';
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
    <div className="flex h-dvh w-screen">
      {/* Coluna da esquerda - Formulário de recuperação de senha */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-dp-black text-dp-white p-8">
        <div className="w-full max-w-sm flex flex-col items-center">
          <h3 className="text-2xl font-bold mb-2 text-center">
            Recuperar Senha
          </h3>
          <p className="text-dp-gray mb-8 text-center">
            Digite seu email para receber instruções de recuperação
          </p>

          <PasswordRecoverForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton
              isSuccessful={isSuccessful}
              className="w-full bg-dp-orange hover:bg-dp-orange/90 text-dp-white"
            >
              {buttonText}
            </SubmitButton>

            <p className="text-center text-sm text-dp-gray mt-6">
              {'Lembrou sua senha? '}
              <Link
                href="/login"
                className="font-semibold text-dp-white hover:underline"
              >
                Voltar para o login
              </Link>
            </p>
          </PasswordRecoverForm>
        </div>
      </div>

      {/* Coluna da direita - Branding */}
      <AuthSidebar />
    </div>
  );
}
