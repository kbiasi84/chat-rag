import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthProvider } from '@/components/auth/providers';

export default function PlanosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <header className="py-4">
        <div className="container flex items-center gap-4 px-6 md:px-8">
          <Link href="/configuracoes?tab=cobranca">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Voltar</span>
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Voltar</h1>
        </div>
      </header>
      <main>{children}</main>
    </AuthProvider>
  );
}
