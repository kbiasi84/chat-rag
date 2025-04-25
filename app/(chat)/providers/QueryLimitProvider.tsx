'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface QueryLimitContextType {
  isLoading: boolean;
  isAllowed: boolean;
  verificarConsulta: () => Promise<boolean>;
  incrementarConsulta: () => Promise<void>;
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

      setIsAllowed(resultado.permitido);

      if (!resultado.permitido && resultado.redirecionarParaPlanos) {
        toast.error(
          resultado.mensagem ||
            'Você atingiu o limite de consultas do seu plano',
        );

        router.push('/planos?limite=atingido');
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

  const incrementarConsulta = async (): Promise<void> => {
    try {
      const response = await fetch('/api/consultas/incrementar', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 403 && data.redirecionarParaPlanos) {
          toast.error(
            data.mensagem || 'Você atingiu o limite de consultas do seu plano',
          );

          router.push('/planos?limite=atingido');
        } else {
          toast.error(
            data.error || 'Erro ao incrementar contador de consultas',
          );
        }
      }
    } catch (error) {
      console.error('Erro ao incrementar contador:', error);
      toast.error('Não foi possível atualizar seu contador de consultas');
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
        verificarConsulta,
        incrementarConsulta,
      }}
    >
      {children}
    </QueryLimitContext.Provider>
  );
}
