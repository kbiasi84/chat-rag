// Exporta todos os schemas do banco de dados

// Schemas da base de conhecimento
export * from './resources';
export * from './links';
export * from './embeddings';

// Schemas principais do sistema
export * from './user';
export * from './chat';
export * from './message';
export * from './vote';
export * from './document';
export * from './suggestion';

// Schemas depreciados
export * from './message-deprecated';
export * from './vote-deprecated';
