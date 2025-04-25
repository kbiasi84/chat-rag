import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { incrementConsultasUsadas } from '@/lib/db/queries';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';

// Forçar o uso do ambiente Node.js completo
export const runtime = 'nodejs';

/**
 * DEPRECATED: Esta API não deve mais ser chamada diretamente.
 * O incremento de consultas agora é feito automaticamente na API de chat
 * quando o usuário envia uma nova pergunta.
 *
 * Esta rota é mantida apenas para compatibilidade, mas seu uso direto
 * deve ser evitado para não causar contagem duplicada.
 */
export async function POST(request: Request) {
  // Logs detalhados para identificar a fonte da chamada
  console.warn('======== ALERTA: API DEPRECIADA CHAMADA ========');
  console.warn('Rota: /api/consultas/incrementar');

  try {
    // Log detalhado dos headers para ajudar a identificar a origem
    const headers = Object.fromEntries(request.headers.entries());
    console.warn('Headers da requisição:', JSON.stringify(headers, null, 2));

    const referer = request.headers.get('referer');
    console.warn(`Origem da chamada: ${referer || 'Desconhecida'}`);

    // Tenta obter informações do user-agent
    const userAgent = request.headers.get('user-agent');
    console.warn(`User-Agent: ${userAgent || 'Não disponível'}`);

    // Registra a URL completa da requisição
    console.warn(`URL completa: ${request.url}`);

    // Adiciona uma stack trace para depuração
    console.warn('Stack trace:');
    console.trace();

    // Continua com o fluxo normal, mas não incrementa o contador
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'Não autenticado',
          mensagem:
            'ATENÇÃO: Esta API está depreciada. A contagem de consultas agora é feita na API de chat.',
        },
        { status: 401 },
      );
    }

    // Verificar se o usuário ainda pode fazer consulta
    const verificacao = await verificarLimiteConsulta(session.user.id);
    if (!verificacao.permitido) {
      return NextResponse.json(
        {
          ...verificacao,
          mensagem:
            verificacao.mensagem + ' (ATENÇÃO: Esta API está depreciada)',
        },
        { status: 403 },
      );
    }

    // MODIFICAÇÃO: Não incrementa mais o contador
    // Apenas retorna uma resposta indicando que a API está depreciada
    // const novoTotal = await incrementConsultasUsadas(session.user.id);

    console.warn('======== FIM DO ALERTA ========');

    return NextResponse.json({
      success: true,
      mensagem:
        'ATENÇÃO: Esta API está depreciada. A contagem de consultas agora é feita na API de chat.',
      // Retornamos 0 como contador para evitar incrementos indesejados
      consultasUsadas: 0,
    });
  } catch (error) {
    console.error('Erro ao processar requisição depreciada:', error);
    return NextResponse.json(
      {
        error: 'Não foi possível processar a requisição',
        mensagem:
          'Esta API está depreciada. A contagem de consultas agora é feita na API de chat.',
      },
      { status: 500 },
    );
  }
}
