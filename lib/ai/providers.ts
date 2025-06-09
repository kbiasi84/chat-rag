import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';

export const myProvider = customProvider({
  languageModels: {
    //modelo principal otimizado: o4-mini para maior capacidade de tokens
    'chat-dp': openai('o4-mini'),
    //modelo para geração de títulos: mantém gpt-3.5-turbo (eficiente para tarefa simples)
    'title-model': openai('gpt-3.5-turbo'),
  },
});
// OTIMIZAÇÃO IMPLEMENTADA:
// o4-mini como modelo principal:
// ✅ 200.000 TPM (vs 30.000 do gpt-4o)
// ✅ 500 RPM (vs 150 do gpt-4o)
// ✅ 2.000.000 TPD (vs 1.000.000 do gpt-4o)
// ✅ Custo ~80% menor
// ✅ Rate limiting resolvido
