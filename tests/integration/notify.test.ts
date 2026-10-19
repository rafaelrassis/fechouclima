import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { savePushSubscription } from "@/actions/settings";
import { createQuote } from "@/actions/quotes";
import { notifyQuoteResponse } from "@/lib/notify";
import { _resetPushConfig } from "@/lib/push";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

vi.unmock("@/lib/notify"); // o setup global mocka; aqui testamos o de verdade

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));
const emails: { to: string; subject: string }[] = [];
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string }) => {
    emails.push(m);
    return true;
  },
}));

beforeEach(async () => {
  await resetDb();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({});
  emails.length = 0;
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:t@t.com";
  _resetPushConfig();
});

describe("aviso ao técnico quando o cliente responde", () => {
  it("aprovação: e-mail e push com o cliente, o valor e o link do orçamento", async () => {
    const u = await makeUser("tec@t.com");
    loginAs(u.id);
    await savePushSubscription({
      endpoint: "https://push.example.com/send/1",
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    });
    const q = await createQuote(quoteInput({ customerName: "Maria Souza" }) as never);
    if (!q.ok) throw new Error(q.error);

    await notifyQuoteResponse(q.data.publicId, "APPROVED");

    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("tec@t.com");
    expect(emails[0].subject).toBe("Fechou! Maria Souza aprovou o orçamento #1");

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload.title).toBe("✅ Fechou! Maria Souza aprovou o orçamento #1");
    expect(payload.body).toContain("200,00");
    expect(payload.url).toBe(`/orcamentos/${q.data.id}`);
    expect(payload.url.startsWith("/")).toBe(true);
    expect(payload.actions).toEqual([{ action: "whatsapp", title: "Chamar no WhatsApp" }]);
    expect(payload.waUrl).toMatch(/^https:\/\/wa\.me\/55\d+\?text=/);
    expect(decodeURIComponent(payload.waUrl.split("text=")[1])).toContain("Vamos combinar a data do serviço");
  });

  it("aprovação com mensagem de WhatsApp customizada em Ajustes", async () => {
    const u = await makeUser("tec@t.com");
    loginAs(u.id);
    await savePushSubscription({
      endpoint: "https://push.example.com/send/3",
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    });
    await db.user.update({ where: { id: u.id }, data: { approvalWaTemplate: "Oi {cliente}, orçamento #{numero} aprovado!" } });
    const q = await createQuote(quoteInput({ customerName: "Maria Souza" }) as never);
    if (!q.ok) throw new Error(q.error);

    await notifyQuoteResponse(q.data.publicId, "APPROVED");

    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(decodeURIComponent(payload.waUrl.split("text=")[1])).toBe("Oi Maria Souza, orçamento #1 aprovado!");
  });

  it("recusa com motivo vai no corpo do push; orçamento inexistente não lança", async () => {
    const u = await makeUser();
    loginAs(u.id);
    await savePushSubscription({
      endpoint: "https://push.example.com/send/2",
      keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    });
    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);
    await db.quote.update({ where: { id: q.data.id }, data: { status: "REJECTED", rejectReason: "Achei caro" } });

    await notifyQuoteResponse(q.data.publicId, "REJECTED");
    expect(JSON.parse(sendNotification.mock.calls[0][1]).body).toContain("Achei caro");

    await expect(notifyQuoteResponse("00000000-0000-0000-0000-000000000000", "APPROVED")).resolves.toBeUndefined();
  });
});
