import type { NextAuthConfig } from "next-auth";

const PUBLIC_PREFIXES = ["/login", "/cadastro", "/o/", "/v/", "/api/health", "/api/cron/", "/descadastro", "/esqueci-senha", "/privacidade", "/termos", "/redefinir-senha", "/api/descadastro", "/icons/", "/icon", "/apple-icon", "/manifest"];

export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isPublic = path === "/" || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

      if (path.startsWith("/login") && isLoggedIn) {
        return Response.redirect(new URL("/inicio", nextUrl));
      }
      return isPublic || isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.issuedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (typeof token.issuedAt === "number") session.issuedAt = token.issuedAt;
      return session;
    },
  },
} satisfies NextAuthConfig;
