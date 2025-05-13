/**
 * Modelos de OpenAI e seus respectivos encoders
 */
export type OpenAIModel =
  | 'gpt-4'
  | 'gpt-4-32k'
  | 'gpt-3.5-turbo'
  | 'gpt-4o'
  | 'text-embedding-ada-002'
  | 'text-embedding-3-small'
  | 'text-embedding-3-large';

/**
 * Conta o número aproximado de tokens em um texto para um modelo específico da OpenAI
 * Método: conta as palavras e multiplica por 1.3 (estimativa média)
 */
export const countTokens = (
  text: string,
  model: OpenAIModel = 'gpt-4o', // mantido para compatibilidade
): number => {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
};

/**
 * Estima o número de tokens em uma string JSON
 * Útil para calcular tokens em objetos/arrays antes de serializar
 */
export const estimateTokensInJSON = (obj: any): number => {
  try {
    const jsonString = JSON.stringify(obj);
    return countTokens(jsonString);
  } catch (error) {
    console.error(`[TOKEN] Erro ao estimar tokens em JSON: ${error}`);
    return 0;
  }
};

/**
 * Trunca um texto para um número máximo de tokens (estimado)
 */
export const truncateToTokenLimit = (
  text: string,
  maxTokens: number,
  model: OpenAIModel = 'gpt-4o',
): string => {
  const words = text.split(/\s+/);
  const maxWords = Math.floor(maxTokens / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
};
