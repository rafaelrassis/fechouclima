import { db } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatBRL } from "@/lib/money";
import { sendPushToUser } from "@/lib/push";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

// Avisa o técnico por e-mail quando o cliente responde. Nunca lança: falha de e-mail não pode quebrar a resposta do cliente.
export async function notifyQuoteResponse(publicId: string, outcome: "APPROVED" | "REJECTED"): Promise<void> {
  try {
    const q = await db.quote.findUnique({
      where: { publicId },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        totalCents: true,
        rejectReason: true,
        userId: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!q) return;

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const link = `${base}/orcamentos/${q.id}`;
    const total = formatBRL(q.totalCents);
    const approved = outcome === "APPROVED";

    const subject = approved
      ? `Fechou! ${q.customerName} aprovou o orçamento #${q.number}`
      : `${q.customerName} recusou o orçamento #${q.number}`;
    const pushTitle = `${approved ? "✅" : "❌"} ${subject}`;
    const reason = !approved && q.rejectReason ? `Motivo: ${q.rejectReason}` : "";

    const waMessage = approved
      ? `Olá, ${q.customerName}! Show, recebi sua aprovação do orçamento #${q.number}. Vamos combinar a data do serviço?`
      : `Olá, ${q.customerName}, vi que o orçamento #${q.number} não foi aprovado. Posso ajustar algo?`;
    const waUrl = buildWhatsAppUrl(q.customerPhone, waMessage);

    const text = [
      approved
        ? `${q.customerName} aprovou o orçamento #${q.number} de ${total}.`
        : `${q.customerName} recusou o orçamento #${q.number} de ${total}.`,
      reason,
      `Abrir: ${link}`,
    ]
      .filter(Boolean)
      .join("\n");

    const html =
      `<p>${escapeHtml(text.split("\n")[0])}</p>` +
      (reason ? `<p>${escapeHtml(reason)}</p>` : "") +
      `<p><a href="${escapeHtml(link)}">Abrir orçamento</a></p>`;

    await Promise.all([
      sendEmail({ to: q.user.email, subject, html, text }),
      sendPushToUser(q.userId, {
        title: pushTitle,
        body: `${total}${reason ? ` · ${reason}` : ""}`,
        url: `/orcamentos/${q.id}`,
        tag: `quote-${q.id}`,
        actions: [{ action: "whatsapp", title: "Chamar no WhatsApp" }],
        waUrl,
      }),
    ]);
  } catch (e) {
    console.error("[notify] falha", e);
  }
}
