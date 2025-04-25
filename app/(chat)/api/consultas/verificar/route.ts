import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';

// Forçar o uso do ambiente Node.js completo
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();

    // Se não estiver autenticado, retorna erro
    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'Não autenticado',
          permitido: false,
          redirecionarParaLogin: true,
        },
        { status: 401 },
      );
    }

    // Verificar se o usuário pode fazer consulta
    const resultado = await verificarLimiteConsulta(session.user.id);

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro ao verificar limite de consultas:', error);
    return NextResponse.json(
      {
        error: 'Não foi possível verificar seu limite de consultas',
        permitido: false,
      },
      { status: 500 },
    );
  }
}
