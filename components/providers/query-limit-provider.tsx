'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface QueryLimitContextType {
  isLoading: boolean;
  isAllowed: boolean;
  consultasRestantes: number;
  ultimaConsulta: boolean;
  planoAtingido: boolean;
  assinaturaCancelada: boolean;
  verificarConsulta: () => Promise<boolean>;
}

const QueryLimitContext = createContext<QueryLimitContextType | undefined>(
  undefined,
);

export function useQueryLimit() {
  const context = useContext(QueryLimitContext);
  if (!context) {
    throw new Error(
      'useQueryLimit deve ser usado dentro de um QueryLimitProvider',
    );
  }
  return context;
}

interface QueryLimitProviderProps {
  children: ReactNode;
}

export function QueryLimitProvider({ children }: QueryLimitProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [consultasRestantes, setConsultasRestantes] = useState(-1); // -1 indica que não foi carregado ainda
  const [ultimaConsulta, setUltimaConsulta] = useState(false); // Flag para última consulta
  const [planoAtingido, setPlanoAtingido] = useState(false); // Flag para plano atingido
  const [assinaturaCancelada, setAssinaturaCancelada] = useState(false); // Flag para assinatura cancelada

  const router = useRouter();

  const verificarConsulta = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/consultas/verificar');

      if (!response.ok) {
        const data = await response.json();
        if (data.redirecionarParaLogin) {
          router.push('/login');
          return false;
        }

        toast.error(
          data.error || 'Não foi possível verificar seu limite de consultas',
        );

        return false;
      }

      const resultado = await response.json();

      // Capturar o estado anterior antes de atualizar
      const limiteAtingidoAntes = planoAtingido;

      setIsAllowed(resultado.permitido);

      // Verificar se a assinatura está cancelada
      if (resultado.statusAssinatura === 'canceled') {
        setAssinaturaCancelada(true);
        toast.error(
          'Sua assinatura foi cancelada. Assine um plano para continuar usando o serviço.',
        );
      } else {
        setAssinaturaCancelada(false);
      }

      // Verificar se retornou informações sobre consultas restantes
      if (resultado.consultasRestantes !== undefined) {
        setConsultasRestantes(resultado.consultasRestantes);

        // Verifica se é a última consulta disponível (apenas 1 restante)
        setUltimaConsulta(resultado.consultasRestantes === 1);

        // Verifica se o plano atingiu o limite (0 restantes)
        setPlanoAtingido(resultado.consultasRestantes === 0);
      }

      // Mostrar aviso somente se já estávamos com limite atingido antes desta verificação
      // Isso evita mostrar o toast quando o usuário está enviando a última consulta disponível
      if (!resultado.permitido && limiteAtingidoAntes && !assinaturaCancelada) {
        toast.error(
          'Limite de consultas atingido. Considere atualizar seu plano para continuar.',
        );

        // Remover o redirecionamento automático
        // if (resultado.redirecionarParaPlanos) {
        //   router.push('/planos?limite=atingido');
        // }

        return false;
      }

      return resultado.permitido;
    } catch (error) {
      console.error('Erro ao verificar limite de consultas:', error);
      toast.error('Não foi possível verificar seu limite de consultas');

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verificarConsulta();
  }, []);

  return (
    <QueryLimitContext.Provider
      value={{
        isLoading,
        isAllowed,
        consultasRestantes,
        ultimaConsulta,
        planoAtingido,
        assinaturaCancelada,
        verificarConsulta,
      }}
    >
      {children}
    </QueryLimitContext.Provider>
  );
}
