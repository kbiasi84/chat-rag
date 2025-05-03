'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Interface igual à do QueryLimitContext real
interface MockQueryLimitContextType {
  isLoading: boolean;
  isAllowed: boolean;
  consultasRestantes: number;
  ultimaConsulta: boolean;
  planoAtingido: boolean;
  assinaturaCancelada: boolean;
  verificarConsulta: () => Promise<boolean>;
}

// Criar um contexto com valores padrão
const MockQueryLimitContext = createContext<MockQueryLimitContextType>({
  isLoading: false,
  isAllowed: true,
  consultasRestantes: 999, // Valor alto para evitar problemas
  ultimaConsulta: false,
  planoAtingido: false,
  assinaturaCancelada: false,
  verificarConsulta: async () => true,
});

// Reutilizar o mesmo nome do hook real para capturar as chamadas
export function useQueryLimit() {
  return useContext(MockQueryLimitContext);
}

// Provider simulado para páginas públicas
export function MockQueryLimitProvider({ children }: { children: ReactNode }) {
  return (
    <MockQueryLimitContext.Provider
      value={{
        isLoading: false,
        isAllowed: true,
        consultasRestantes: 999,
        ultimaConsulta: false,
        planoAtingido: false,
        assinaturaCancelada: false,
        verificarConsulta: async () => true,
      }}
    >
      {children}
    </MockQueryLimitContext.Provider>
  );
}
