import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string | null;
      role: 'USER' | 'ADMIN';
      locale: string;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    username?: string | null;
    role?: 'USER' | 'ADMIN';
    locale?: string;
  }
}
