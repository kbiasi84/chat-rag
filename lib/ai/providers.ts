import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';

export const myProvider = customProvider({
  languageModels: {
    'chat-dp': openai('gpt-4o'),
    'title-model': openai('gpt-3.5-turbo'),
    //'chat-model': openai('gpt-4o'),
  },
});
