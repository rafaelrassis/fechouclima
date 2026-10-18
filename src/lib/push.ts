import webpush from "web-push";
import { db } from "@/lib/db";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  actions?: { action: string; title: string }[];
  waUrl?: string;
};

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return (configured = false);
  webpush.setVapidDetails(subject, pub, priv);
  return (configured = true);
}

// Envia para todos os aparelhos do técnico. Nunca lança: falha de push não pode quebrar a ação do cliente.
// Assinaturas expiradas (404/410) são removidas.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  try {
    const subs = await db.pushSubscription.findMany({ where: { userId } });
    let delivered = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24, urgency: "high" },
          );
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.pushSubscription.deleteMany({ where: { id: s.id } });
          else console.error(JSON.stringify({ level: "error", scope: "push", userId, statusCode: status ?? null, tag: payload.tag ?? null }));
        }
      }),
    );
    return delivered;
  } catch (e) {
    console.error("[push] erro", e);
    return 0;
  }
}

// só para testes
export function _resetPushConfig() {
  configured = null;
}
