import { compare } from 'bcrypt-ts';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { getUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';

// Estendendo os tipos para TypeScript
declare module 'next-auth' {
  interface User {
    nome?: string;
    perfil?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      nome?: string;
      perfil?: string;
    };
  }

  interface JWT {
    id: string;
    email: string;
    nome?: string;
    perfil?: string;
  }
}

// Tipo para o token JWT
interface JwtToken {
  id: string;
  email: string;
  nome?: string;
  perfil?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  session: {
    // Usando a estratégia de token JWT para garantir que as informações do usuário estejam disponíveis no cliente
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, senha }: any) {
        try {
          const users = await getUser(email);
          if (users.length === 0) return null;

          // biome-ignore lint: Forbidden non-null assertion.
          const passwordsMatch = await compare(senha, users[0].senha!);
          if (!passwordsMatch) return null;

          // Garantir que os campos personalizados sejam incluídos no objeto retornado
          return {
            id: users[0].id,
            email: users[0].email,
            name: users[0].nome || null,
            image: null,
            emailVerified: null,
            nome: users[0].nome || undefined,
            perfil: users[0].perfil || undefined,
          };
        } catch (error) {
          console.error('Erro na autorização:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Se o usuário acabou de fazer login, adicione os dados ao token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.nome = user.nome;
        token.perfil = user.perfil;
        token.name = user.nome || null;
      }

      return token;
    },
    async session({ session, token }) {
      // Usar type assertion para resolver o problema de tipos
      const user = session.user as any;

      // Adicionar propriedades ao objeto de usuário
      user.id = token.id;
      user.email = token.email;
      user.nome = token.nome;
      user.perfil = token.perfil;
      user.name = token.name || null;

      return session;
    },
  },
  debug: process.env.NODE_ENV === 'development',
});
