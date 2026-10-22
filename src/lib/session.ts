import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isSessionRevoked } from "@/lib/session-revoked";

const LAST_LOGIN_THROTTLE_MS = 60 * 60 * 1000;

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({ where: { id }, select: { sessionsValidAfter: true, lastLoginAt: true } });
  if (!user || isSessionRevoked(session.issuedAt, user.sessionsValidAfter)) return null;

  // "Último acesso" no admin: na prática é atividade, não só login, para não depender do técnico
  // relogar; throttle de 1h para não gravar em toda requisição autenticada.
  if (!user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > LAST_LOGIN_THROTTLE_MS) {
    await db.user.update({ where: { id }, data: { lastLoginAt: new Date() } }).catch(() => {});
  }

  return id;
}

// Server Actions e páginas (nunca rotas de API: lá o chamador trata getUserId() == null).
// Next.js agenda o fetch de dados de layout e página em paralelo; se a sessão foi revogada,
// a página também chega aqui de forma independente do redirect do layout. Por isso usamos
// redirect() (que o Next reconhece e não reporta como erro) em vez de lançar: um `throw` comum
// nessa corrida apareceria como erro de servidor de verdade e disparava o alerta por e-mail.
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/api/auth/sessao-revogada");
  return id;
}

// Páginas e actions de /admin: redireciona quem não é admin para /inicio (sem revelar que a rota existe).
export async function requireAdmin(): Promise<string> {
  const id = await requireUserId();
  const user = await db.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!user?.isAdmin) redirect("/inicio");
  return id;
}
