import { db } from "@/lib/db";
import { session } from "./setup";

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "RateLimit", "PasswordResetToken", "QuotePhoto", "QuoteNudge", "PushSubscription", "QuoteItem", "Quote", "Customer", "Service", "User", "Lead", "LeadAutomation" RESTART IDENTITY CASCADE',
  );
  session.userId = "";
  session.issuedAt = Date.now();
}

export async function makeUser(email = `u${Math.random().toString(36).slice(2)}@t.com`) {
  return db.user.create({ data: { name: "Técnico", email, passwordHash: "x" } });
}

// issuedAt simula quando o token da sessão foi emitido (default: agora). Passe um valor anterior
// a uma troca de sessionsValidAfter para simular uma sessão antiga que deveria ser revogada.
export const loginAs = (userId: string, issuedAt: number = Date.now()) => {
  session.userId = userId;
  session.issuedAt = issuedAt;
};

export async function makeSystemService(name = "Instalação", priceCents = 45000) {
  return db.service.create({ data: { userId: null, name, unit: "un", priceCents } });
}

export const quoteInput = (over: Record<string, unknown> = {}) => ({
  customerName: "Maria",
  customerPhone: "(11) 99999-0000",
  validDays: 7,
  discountCents: 0,
  items: [{ description: "Limpeza", unit: "un", quantity: 2, unitPriceCents: 10000 }],
  ...over,
});
