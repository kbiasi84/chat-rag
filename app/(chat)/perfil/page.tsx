'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserIcon, Mail, Phone, Briefcase, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function PerfilPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    atividade: '',
    perfil: '',
  });

  // Atualizar o estado quando a sessão estiver disponível
  useEffect(() => {
    if (session?.user) {
      setUserData({
        nome: (session.user as any)?.nome || '',
        email: session.user.email || '',
        whatsapp: (session.user as any)?.whatsapp || '',
        atividade: (session.user as any)?.atividade || '',
        perfil: (session.user as any)?.perfil || 'usuário',
      });
    }
  }, [session]);

  // Redirecionando para login se não estiver autenticado
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  // Mostrando estado de carregamento enquanto verifica autenticação
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const isAdmin = userData.perfil === 'admin';

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-6 w-6" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Visualize suas informações pessoais cadastradas no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <div className="flex items-center">
                <UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{userData.nome || 'Não informado'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{userData.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{userData.whatsapp || 'Não informado'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="atividade">Atividade</Label>
              <div className="flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{userData.atividade || 'Não informado'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-md">
            <div className="flex items-center">
              {isAdmin ? (
                <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground" />
              ) : (
                <UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
              )}
              <span className="font-medium">Tipo de Conta:</span>
              <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded-md capitalize">
                {userData.perfil}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Para alterar seus dados de perfil, entre em contato com o
              administrador do sistema.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={() => router.push('/')}>Voltar</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
