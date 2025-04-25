'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function PrivacidadeContent() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Privacidade</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas configurações de privacidade e acesso aos dados
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            Privacidade de dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            A ChatDP acredita em práticas transparentes de dados. Mantemos seus
            dados seguros e protegidos.
          </p>

          <div className="space-y-4">
            <h3 className="font-medium">Como protegemos seus dados</h3>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Não treinamos nossos modelos generativos com suas conversas
              </li>
              <li>Não vendemos seus dados para terceiros</li>
              <li>
                Excluímos seus dados prontamente quando solicitado, exceto em
                casos de violações de segurança
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Como usamos seus dados</h3>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Podemos usar conversas sinalizadas por violações de segurança
                para garantir a segurança dos sistemas
              </li>
              <li>
                Podemos usar seu e-mail para comunicações relacionadas à conta e
                marketing (novos produtos)
              </li>
              <li>
                Realizamos análises agregadas e anonimizadas dos dados para
                entender como as pessoas usam o sistema
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
