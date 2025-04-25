import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verificarConsultaMiddleware } from './app/(chat)/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Verificar se é uma rota de chat
  if (pathname === '/' || pathname.startsWith('/chat/')) {
    return verificarConsultaMiddleware(request);
  }

  // Permitir outras rotas
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/chat/:path*'],
};
