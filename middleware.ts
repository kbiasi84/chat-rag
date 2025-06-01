import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * O Playwright inicia o servidor de desenvolvimento e requer um status 200 para
   * iniciar os testes, garantindo que eles possam ser iniciados.
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Lista de caminhos públicos que não requerem autenticação
  const publicPaths = [
    '/api/webhook-stripe', // Webhook do Stripe
    '/api/public-chat', // API pública de chat
    '/api/auth', // Rotas de autenticação
    '/logos', // Imagens de logos
    '/images', // Outras imagens
    '/char', // Assets de personagens
    '/favicon.ico', // Favicon
    '/sitemap.xml', // Sitemap
    '/robots.txt', // Robots
  ];

  // Verificar se o caminho atual é público
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Verificar se é uma página de chat público
  const isPublicChatPage = pathname.match(/^\/chat\/[^\/]+\/public$/);

  // Se for um caminho público ou página de chat público, permitir acesso
  if (isPublicPath || isPublicChatPage) {
    //console.log('Acesso a conteúdo público permitido:', pathname);
    return NextResponse.next();
  }

  // Obter token de autenticação
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Páginas públicas de autenticação
  const authPages = [
    '/login',
    '/register',
    '/recover-password',
    '/reset-password',
  ];
  const isAuthPage = authPages.some((page) => pathname.startsWith(page));

  // Se usuário não está autenticado e tenta acessar página protegida, redireciona para login
  if (!token && !isAuthPage) {
    // Nunca redirecionar rotas de webhook mesmo que cheguem até aqui
    if (pathname.includes('/webhook')) {
      console.log(
        'Rota de webhook detectada em verificação secundária, permitindo acesso',
      );
      return NextResponse.next();
    }

    const redirectUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${redirectUrl}`, request.url),
    );
  }

  // Se usuário está autenticado e tenta acessar página de autenticação, redireciona para home
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Para outros casos, permite o acesso
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/chat/:id/public',
    '/api/:path*',
    '/login',
    '/register',
    '/recover-password',
    '/reset-password',
    '/logos/:path*',
    '/images/:path*',
    '/char/:path*',

    /*
     * Corresponde a todos os caminhos de solicitação, exceto aqueles que começam com:
     * - _next/static (arquivos estáticos do Next.js)
     * - _next/image (arquivos de otimização de imagem do Next.js)
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
