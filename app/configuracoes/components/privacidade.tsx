'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

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

      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            Documentos completos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Para informações mais detalhadas sobre como tratamos seus dados e
            quais são seus direitos, consulte nossa documentação completa.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="https://chatdp.com.br/termos-de-uso.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg px-4 py-3 transition-colors"
              >
                <FileText size={18} />
                <span className="font-medium">Termos de Uso</span>
                <ExternalLink size={16} className="ml-1 opacity-70" />
              </Link>

              <Link
                href="https://chatdp.com.br/politica-de-privacidade.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg px-4 py-3 transition-colors"
              >
                <Shield size={18} />
                <span className="font-medium">Política de Privacidade</span>
                <ExternalLink size={16} className="ml-1 opacity-70" />
              </Link>
            </div>

            <p className="text-sm text-muted-foreground mt-2">
              Ao continuar utilizando nossos serviços, você concorda com nossos
              termos de uso e política de privacidade em sua totalidade.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
