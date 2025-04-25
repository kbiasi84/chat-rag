import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthProvider } from '@/components/providers';

export default function PlanosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <header className="border-b py-4">
        <div className="container flex items-center gap-4">
          <Link href="/configuracoes?tab=cobranca">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Voltar</span>
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Planos e Preços</h1>
        </div>
      </header>
      <main>{children}</main>
    </AuthProvider>
  );
}
