import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificar autenticação e permissão de administrador
  if (!session || !session.user) {
    // Redirecionar para login se não estiver autenticado
    redirect('/login');
  }

  // Verificar se o usuário tem perfil de administrador
  if (session.user.perfil !== 'admin') {
    // Redirecionar para página inicial se não for administrador
    redirect('/');
  }

  return <>{children}</>;
}
