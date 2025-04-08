export const DEFAULT_CHAT_MODEL: string = "chat-dp";

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-dp',
    name: 'Chat DP',
    description: 'Chat para o Departamento Pessoal',
  },
  /*{
    id: 'chat-model-reasoning',
    name: 'Reasoning model',
    description: 'Uses advanced reasoning',
  },*/
];
