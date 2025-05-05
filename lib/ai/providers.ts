import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';

export const myProvider = customProvider({
  languageModels: {
    //aqui responde as perguntas do usuário usando o mais atual gpt-4o
    'chat-dp': openai('gpt-4o'),
    //aqui para gerar os títulos da conversa, usa o gpt-3.5-turbo abaixo
    'title-model': openai('gpt-3.5-turbo'),
  },
});
