'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { alterarSenha } from '@/lib/actions/user';

interface PerfilContentProps {
  userData: {
    nome: string;
    email: string;
    whatsapp: string;
    atividade: string;
  };
}

export default function PerfilContent({ userData }: PerfilContentProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [status, setStatus] = useState<string>('idle');
  const [mensagem, setMensagem] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Limpar mensagens de erro anteriores
    setStatus('idle');
    setMensagem('');

    // Verificar se as senhas correspondem
    if (novaSenha !== confirmaSenha) {
      setStatus('erro_local');
      setMensagem('A nova senha e a confirmação não conferem');
      return;
    }

    // Verificar se o ID do usuário está disponível
    const userId = (session?.user as any)?.id;
    if (!userId) {
      setStatus('failed');
      setMensagem('Sessão inválida. Por favor, faça login novamente.');
      return;
    }

    try {
      setStatus('in_progress');

      const formData = new FormData(e.currentTarget);
      formData.set('userId', userId);

      const resultado = await alterarSenha(formData);

      setStatus(resultado.status);
      if (resultado.message) {
        setMensagem(resultado.message);
      }

      // Limpar o formulário em caso de sucesso
      if (resultado.status === 'success' && formRef.current) {
        formRef.current.reset();
        setNovaSenha('');
        setConfirmaSenha('');
      }
    } catch (error) {
      setStatus('failed');
      setMensagem('Erro ao processar a solicitação');
      console.error('Erro ao alterar senha:', error);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Visualize suas informações pessoais e altere sua senha
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">Informações pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Nome completo
              </h3>
              <p className="text-base font-medium">
                {userData.nome || 'Não informado'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Email
              </h3>
              <p className="text-base font-medium">{userData.email}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                WhatsApp
              </h3>
              <p className="text-base font-medium">
                {userData.whatsapp || 'Não informado'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Atividade profissional
              </h3>
              <p className="text-base font-medium">
                {userData.atividade
                  ? userData.atividade.charAt(0).toUpperCase() +
                    userData.atividade.slice(1)
                  : 'Não informado'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === 'failed' ||
            status === 'erro_local' ||
            status === 'senha_incorreta') && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-md">
              {mensagem || 'Erro ao alterar senha. Tente novamente.'}
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 bg-green-100 text-green-800 rounded-md">
              {mensagem || 'Senha alterada com sucesso!'}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="senhaAtual">Senha atual</Label>
                <Input
                  id="senhaAtual"
                  name="senhaAtual"
                  type="password"
                  required
                  disabled={status === 'in_progress'}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="novaSenha">Nova senha</Label>
                <Input
                  id="novaSenha"
                  name="novaSenha"
                  type="password"
                  required
                  minLength={6}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  disabled={status === 'in_progress'}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmaSenha">Confirme a nova senha</Label>
                <Input
                  id="confirmaSenha"
                  name="confirmaSenha"
                  type="password"
                  required
                  minLength={6}
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  disabled={status === 'in_progress'}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={status === 'in_progress'}>
                {status === 'in_progress' ? 'Processando...' : 'Alterar senha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
