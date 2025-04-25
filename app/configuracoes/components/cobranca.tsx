'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CobrancaContent() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cobrança</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu plano de assinatura e informações de pagamento
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            Plano atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-lg">
            <div className="bg-primary/10 p-3 rounded-full">
              <Check size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Standard</h3>
              <p className="text-muted-foreground">Mensal • R$ 99,00</p>
              <p className="text-muted-foreground">60 consultas/mês</p>
            </div>
            <Link href="/planos">
              <Button type="button" variant="outline">
                Ajustar plano
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Próxima cobrança
              </div>
              <div className="font-medium">26 de abril de 2025</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Método de pagamento
              </div>
              <div className="font-medium flex items-center gap-2">
                <CreditCard size={16} /> Mastercard •••• 0673
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="font-medium text-green-600 flex items-center gap-1">
                <Check size={16} /> Ativo
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline">
              Atualizar pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">Histórico de faturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium p-2">Data</th>
                  <th className="text-left font-medium p-2">Total</th>
                  <th className="text-left font-medium p-2">Status</th>
                  <th className="text-left font-medium p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-accent/5">
                  <td className="p-2">26 de mar. de 2025</td>
                  <td className="p-2">R$ 110,00</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <Check size={14} /> Pago
                    </span>
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="sm">
                      Ver
                    </Button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-accent/5">
                  <td className="p-2">26 de fev. de 2025</td>
                  <td className="p-2">R$ 110,00</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <Check size={14} /> Pago
                    </span>
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="sm">
                      Ver
                    </Button>
                  </td>
                </tr>
                <tr className="border-b hover:bg-accent/5">
                  <td className="p-2">26 de jan. de 2025</td>
                  <td className="p-2">R$ 110,00</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <Check size={14} /> Pago
                    </span>
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="sm">
                      Ver
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-destructive">
            <AlertCircle size={20} />
            Cancelamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Cancele seu plano a qualquer momento. Você pode continuar usando o
            serviço até o final do período de cobrança atual.
          </p>
          <Button type="button" variant="destructive">
            Cancelar plano
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
