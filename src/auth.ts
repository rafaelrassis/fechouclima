import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { LIMITS, getClientIp, rateLimit } from "@/lib/rate-limit";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const ip = await getClientIp();
        const [byEmail, byIp] = await Promise.all([
          rateLimit(`login:${ip}:${email}`, LIMITS.loginEmail.limit, LIMITS.loginEmail.windowSec),
          rateLimit(`login:${ip}`, LIMITS.loginIp.limit, LIMITS.loginIp.windowSec),
        ]);
        if (!byEmail.ok || !byIp.ok) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        if (!user.isActive) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
