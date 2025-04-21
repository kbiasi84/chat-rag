/**
 * Ferramenta para analisar a consulta do usuário e extrair palavras-chave relevantes
 */
export const analyzeQuery = tool({
  description:
    'Analisar a consulta do usuário para extrair palavras-chave importantes para melhorar a pesquisa.',
  parameters: z.object({
    query: z.string().describe('A consulta do usuário'),
  }),
  execute: async ({ query }) => {
    console.log('--------- ANÁLISE DE CONSULTA ---------');
    console.log(`Consulta original: "${query}"`);

    try {
      console.log('Gerando palavras-chave com IA...');
      const { object } = await generateObject({
        model: openai.completion('gpt-3.5-turbo-instruct'),
        schema: z.object({
          keywords: z
            .array(z.string())
            .max(5)
            .describe('palavras-chave importantes extraídas da consulta'),
        }),
        prompt: `Extraia até 5 palavras-chave importantes desta consulta: "${query}". Forneça apenas palavras individuais ou termos técnicos curtos que sejam relevantes para a busca em uma base de conhecimento.`,
      });

      console.log(
        `Palavras-chave extraídas: ${object.keywords?.join(', ') || 'nenhuma'}`,
      );
      console.log('--------- FIM DA ANÁLISE ---------');

      // Retornar um objeto estruturado com resultado da análise
      return {
        query,
        success: true,
        keywords: object.keywords || [],
      };
    } catch (error: unknown) {
      console.error('ERRO NA ANÁLISE DE CONSULTA:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      const stackTrace =
        error instanceof Error ? error.stack : 'Sem stack trace';
      console.error(stackTrace || 'Sem stack trace');

      // Em caso de erro, retornar objeto com status de falha
      return {
        query,
        success: false,
        message: `Não foi possível extrair palavras-chave da consulta: "${query}". ${errorMessage}`,
        keywords: [],
      };
    }
  },
});
