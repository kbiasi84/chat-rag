/**
 * Avalia a qualidade informativa de um fragmento de texto
 * @param content Texto a ser avaliado
 * @returns Pontuação de 0 a 10 representando a qualidade do conteúdo
 */
export const evaluateContentQuality = (content: string): number => {
  // 1. Detectar fragmentos relacionados a UI ou navegação
  const uiPatterns = [
    /clique|clicar|botão|menu|cursor|mouse|tela inicial|selecionar|escolher|navegar/i,
    /passar o cursor|arrastar|deslizar|pressionar|interface|página|aba|guia/i,
  ];

  // 2. Detectar fragmentos muito genéricos ou vazios
  const genericPatterns = [
    /^[^.!?]{0,50}$/, // Fragmentos muito curtos sem pontuação
    /(?:\.{3}|\.\.\.|…)$/, // Fragmentos que terminam com reticências (incompletos)
    /^(?:[A-Z]\.|Art\.|§)/, // Referências numéricas sem contexto
    /^\s*[0-9]+\s*\.?\s*$/, // Números isolados
  ];

  // 3. Detectar fragmentos com muita formatação/código
  const lowValuePatterns = [
    /\{|\}|\[|\]|<|>|\|/g, // Caracteres de formatação excessivos
    /\s{3,}/g, // Espaços em excesso
  ];

  // Calcular penalidades
  let score = 10; // Começa com pontuação máxima

  // Penalizar trechos de UI
  for (const pattern of uiPatterns) {
    if (pattern.test(content)) {
      score -= 3;
      break;
    }
  }

  // Penalizar conteúdo genérico
  for (const pattern of genericPatterns) {
    if (pattern.test(content)) {
      score -= 2;
      break;
    }
  }

  // Penalizar formatação excessiva
  for (const pattern of lowValuePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 5) {
      score -= 2;
      break;
    }
  }

  // Bônus para conteúdo com termos informativos
  const informativePatterns = [
    /lei|decreto|normativa|regulamento|portaria|instrução/i,
    /definição|conceito|significa|consiste|refere-se/i,
    /procedimento|processo|etapa|método|técnica/i,
    /obrigatório|necessário|exigido|requerido|mandatório/i,
  ];

  for (const pattern of informativePatterns) {
    if (pattern.test(content)) {
      score += 1;
      break;
    }
  }

  // Garantir que a pontuação esteja entre 0-10
  return Math.max(0, Math.min(10, score));
};

/**
 * Filtra e classifica fragmentos com base na qualidade do conteúdo
 * @param results Array de resultados a serem filtrados
 * @param minQualityScore Pontuação mínima de qualidade (padrão: 5)
 * @returns Array filtrado e ordenado por qualidade e similaridade
 */
export const filterLowQualityContent = (
  results: any[],
  minQualityScore = 5,
): any[] => {
  // Avaliar cada fragmento
  const scoredResults = results.map((result) => ({
    ...result,
    qualityScore: evaluateContentQuality(result.content),
  }));

  // Ordenar por uma combinação de similaridade e qualidade
  return scoredResults
    .filter((result) => result.qualityScore >= minQualityScore)
    .sort((a, b) => {
      // Fórmula de pontuação composta: 70% similaridade + 30% qualidade
      const scoreA = a.similarity * 0.7 + (a.qualityScore / 10) * 0.3;
      const scoreB = b.similarity * 0.7 + (b.qualityScore / 10) * 0.3;
      return scoreB - scoreA;
    });
};
