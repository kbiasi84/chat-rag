'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';

export default function PlanosPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Escolha seu plano
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Plano Starter */}
        <Card className="flex flex-col border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Starter</h2>
            <p className="text-muted-foreground mt-2">
              Para profissional individual
            </p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 59</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 flex-grow">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>30 consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/configuracoes?tab=cobranca&plan=starter">
                <Button
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800"
                  variant="secondary"
                >
                  Assinar Agora
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Plano Standard */}
        <Card className="flex flex-col border border-orange-500 rounded-lg overflow-hidden hover:shadow-md transition-shadow relative">
          <div className="absolute top-0 right-0 bg-orange-500 text-white px-3 py-1 rounded-bl-lg">
            Popular
          </div>
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Standard</h2>
            <p className="text-muted-foreground mt-2">
              Para escritórios e empresas médias
            </p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 99</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 flex-grow">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>60 consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/configuracoes?tab=cobranca&plan=standard">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  Assinar Agora
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Plano Enterprise */}
        <Card className="flex flex-col border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold">Enterprise</h2>
            <p className="text-muted-foreground mt-2">
              Para grandes empresas e consultorias
            </p>

            <div className="mt-4 mb-8">
              <span className="text-4xl font-bold">R$ 149</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-4 flex-grow">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>100 consultas/mês</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Histórico de chats</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span>Compartilhamento por link público</span>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/configuracoes?tab=cobranca&plan=enterprise">
                <Button className="w-full bg-black hover:bg-gray-800 text-white">
                  Assinar Agora
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
