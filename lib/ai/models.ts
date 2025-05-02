export const DEFAULT_CHAT_MODEL: string = 'chat-dp';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-dp',
    name: 'ChatDP',
    description: 'Especialista em questões trabalhistas e recursos humanos',
  },
  /*{
    id: 'chat-model-reasoning',
    name: 'Reasoning model',
    description: 'Uses advanced reasoning',
  },*/
];
