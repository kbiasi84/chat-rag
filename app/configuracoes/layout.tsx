// app/configuracoes/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { AuthProvider } from '@/components/providers';

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar autenticação
  if (!session || !session.user) {
    // Redirecionar para login se não estiver autenticado
    redirect('/login');
  }

  // Aqui não há verificação de perfil específico - qualquer usuário autenticado pode acessar

  // Retornamos o AuthProvider para que hooks client-side como useSession funcionem
  return <AuthProvider>{children}</AuthProvider>;
}
