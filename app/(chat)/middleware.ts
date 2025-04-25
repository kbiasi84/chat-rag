import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { verificarLimiteConsulta } from '@/lib/actions/subscription';
import { incrementConsultasUsadas } from '@/lib/db/queries';

export async function verificarConsultaMiddleware(request: Request) {
  try {
    // Obter a sessão atual
    const session = await auth();

    // Se não estiver autenticado, redirecionar para login
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verificar se o usuário pode fazer consulta
    const resultado = await verificarLimiteConsulta(session.user.id);

    if (!resultado.permitido) {
      // Se atingiu o limite, redirecionar para página de planos
      if (resultado.redirecionarParaPlanos) {
        return NextResponse.redirect(
          new URL('/planos?limite=atingido', request.url),
        );
      }

      // Outros casos de erro
      return NextResponse.redirect(
        new URL('/configuracoes?tab=cobranca&erro=consulta', request.url),
      );
    }

    // Incrementar contador de consultas
    await incrementConsultasUsadas(session.user.id);

    // Permitir o acesso ao chat
    return NextResponse.next();
  } catch (error) {
    console.error('Erro ao verificar limite de consultas:', error);
    return NextResponse.redirect(new URL('/erro', request.url));
  }
}
