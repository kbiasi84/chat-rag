import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Verificar se é uma rota de chat
  if (pathname === '/' || pathname.startsWith('/chat/')) {
    try {
      // Usamos a rota organizada no grupo (chat), mas na URL não usamos os parênteses
      const cookieHeader = request.headers.get('cookie') || '';
      const response = await fetch(
        new URL('/api/consultas/verificar', request.url),
        {
          headers: {
            cookie: cookieHeader,
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();

        if (data.redirecionarParaLogin) {
          return NextResponse.redirect(new URL('/login', request.url));
        }

        return NextResponse.redirect(new URL('/erro', request.url));
      }

      const resultado = await response.json();

      if (!resultado.permitido) {
        if (resultado.redirecionarParaPlanos) {
          return NextResponse.redirect(
            new URL('/planos?limite=atingido', request.url),
          );
        }

        return NextResponse.redirect(
          new URL('/configuracoes?tab=cobranca&erro=consulta', request.url),
        );
      }

      // Incrementar contador de consultas
      await fetch(new URL('/api/consultas/incrementar', request.url), {
        method: 'POST',
        headers: {
          cookie: cookieHeader,
        },
      });

      return NextResponse.next();
    } catch (error) {
      console.error('Erro no middleware:', error);
      return NextResponse.redirect(new URL('/erro', request.url));
    }
  }

  // Permitir outras rotas
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/chat/:path*'],
};
