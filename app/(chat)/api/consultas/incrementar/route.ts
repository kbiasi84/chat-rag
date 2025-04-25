import { auth } from '@/app/(auth)/auth';
import { NextResponse } from 'next/server';
import { incrementConsultasUsadas } from '@/lib/db/queries';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';

// Forçar o uso do ambiente Node.js completo
export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await auth();

    // Se não estiver autenticado, retorna erro
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se o usuário ainda pode fazer consulta
    const verificacao = await verificarLimiteConsulta(session.user.id);
    if (!verificacao.permitido) {
      return NextResponse.json(verificacao, { status: 403 });
    }

    // Incrementar contador de consultas
    const novoTotal = await incrementConsultasUsadas(session.user.id);

    return NextResponse.json({
      success: true,
      consultasUsadas: novoTotal,
    });
  } catch (error) {
    console.error('Erro ao incrementar contador de consultas:', error);
    return NextResponse.json(
      { error: 'Não foi possível atualizar o contador de consultas' },
      { status: 500 },
    );
  }
}
