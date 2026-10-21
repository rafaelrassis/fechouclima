"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_PHOTOS_PER_QUOTE, MAX_PHOTO_BYTES, detectPhotoType } from "@/lib/image";
import { notifyQuoteResponse } from "@/lib/notify";
import { LIMITS, getClientIp, rateLimit } from "@/lib/rate-limit";
import { getUserId, requireUserId } from "@/lib/session";
import { calcLineCents, formatBRL } from "@/lib/money";
import { SNOOZE_GUARD_MS } from "@/lib/followup";
import { addMonths, resolveReminder } from "@/lib/maintenance";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { DEFAULT_WA_TEMPLATE, renderWaTemplate } from "@/lib/wa-template";
import { createQuoteSchema, type CreateQuoteInput } from "@/lib/validations/quote";
import { reminderMonthsSchema } from "@/lib/validations/service";
import type { ActionResult } from "@/types/action";

// Agenda o lembrete de manutenção sozinho na aprovação, pelo serviço de menor prazo entre os
// itens (ou o padrão do técnico, sem nenhum). Nunca lança: falha aqui não pode desfazer a aprovação
// (inclusive a própria busca do orçamento, por isso recebe o publicId em vez do id já resolvido).
async function scheduleMaintenanceReminder(publicId: string, approvedAt: Date): Promise<void> {
  try {
    const quote = await db.quote.findUnique({
      where: { publicId },
      select: {
        id: true,
        user: { select: { defaultReminderMonths: true } },
        items: { select: { service: { select: { name: true, reminderMonths: true, reminderText: true } } } },
      },
    });
    if (!quote) return;

    const resolved = resolveReminder(quote.items, quote.user.defaultReminderMonths);
    if (!resolved) return;

    await db.quote.updateMany({
      where: { id: quote.id, status: "APPROVED", reminderAt: null },
      data: {
        reminderAt: addMonths(approvedAt, resolved.months),
        reminderText: resolved.text,
        reminderService: resolved.service,
      },
    });
  } catch (e) {
    console.error("[maintenance] falha ao agendar lembrete na aprovação", e);
  }
}

type Prepared = {
  items: {
    serviceId: string | null;
    description: string;
    unit: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    position: number;
  }[];
  totalCents: number;
  validUntil: Date;
};

// Valida e monta o snapshot dos itens. lenient: serviço removido do catálogo vira item avulso (edição).
async function prepareQuote(
  userId: string,
  data: z.output<typeof createQuoteSchema>,
  lenient: boolean,
): Promise<{ ok: true; prepared: Prepared } | { ok: false; error: string }> {
  const serviceIds = Array.from(new Set(data.items.map((i) => i.serviceId).filter((v): v is string => !!v)));
  const services = serviceIds.length
    ? await db.service.findMany({
        where: { id: { in: serviceIds }, isActive: true, OR: [{ userId: null }, { userId }] },
      })
    : [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  if (!lenient && serviceIds.some((id) => !serviceMap.has(id))) {
    return { ok: false, error: "Serviço não encontrado" };
  }

  // Snapshot: copia descrição/unidade/preço do catálogo no momento da criação
  const items: Prepared["items"] = [];
  for (let position = 0; position < data.items.length; position++) {
    const item = data.items[position];
    const svc = item.serviceId ? (serviceMap.get(item.serviceId) ?? null) : null;
    const description = item.description ?? svc?.name;
    const unitPriceCents = item.unitPriceCents ?? svc?.priceCents;
    if (!description || unitPriceCents === undefined) return { ok: false, error: "Item inválido" };
    const quantity = Math.round(item.quantity * 100) / 100;
    items.push({
      serviceId: svc?.id ?? null,
      description,
      unit: item.unit ?? svc?.unit ?? "un",
      quantity,
      unitPriceCents,
      totalCents: calcLineCents(quantity, unitPriceCents),
      position,
    });
  }

  const subtotal = items.reduce((acc, i) => acc + i.totalCents, 0);
  if (data.discountCents > subtotal) return { ok: false, error: "Desconto maior que o subtotal" };

  return {
    ok: true,
    prepared: {
      items,
      totalCents: subtotal - data.discountCents,
      validUntil: new Date(Date.now() + data.validDays * 24 * 60 * 60 * 1000),
    },
  };
}

type CustomerData = { customerName: string; customerPhone: string; customerAddress?: string };

// Cria/atualiza o cliente pela chave (técnico, telefone). Mantém o endereço anterior se o novo vier vazio.
async function upsertCustomer(
  tx: Pick<typeof db, "customer">,
  userId: string,
  c: CustomerData,
): Promise<string> {
  const row = await tx.customer.upsert({
    where: { userId_phone: { userId, phone: c.customerPhone } },
    create: { userId, name: c.customerName, phone: c.customerPhone, address: c.customerAddress ?? null },
    update: { name: c.customerName, ...(c.customerAddress ? { address: c.customerAddress } : {}) },
    select: { id: true },
  });
  return row.id;
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; publicId: string; number: number; totalCents: number }>> {
  const userId = await requireUserId();
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const prep = await prepareQuote(userId, data, false);
  if (!prep.ok) return prep;
  const { items, totalCents, validUntil } = prep.prepared;

  const quote = await db.$transaction(async (tx) => {
    const { quoteSeq } = await tx.user.update({
      where: { id: userId },
      data: { quoteSeq: { increment: 1 } },
      select: { quoteSeq: true },
    });
    const customerId = await upsertCustomer(tx, userId, data);
    return tx.quote.create({
      data: {
        userId,
        customerId,
        number: quoteSeq,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        title: data.title,
        notes: data.notes,
        discountCents: data.discountCents,
        totalCents,
        validUntil,
        items: { create: items },
      },
      select: { id: true, publicId: true, number: true, totalCents: true },
    });
  });

  revalidatePath("/orcamentos");
  return { ok: true, data: quote };
}

// Edita um orçamento não aprovado. Volta para DRAFT: o link antigo deixa de permitir aprovar a versão velha.
export async function updateQuote(
  quoteId: string,
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; number: number }>> {
  const userId = await requireUserId();
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const prep = await prepareQuote(userId, data, true);
  if (!prep.ok) return prep;
  const { items, totalCents, validUntil } = prep.prepared;

  const updated = await db.$transaction(async (tx) => {
    const customerId = await upsertCustomer(tx, userId, data);
    // updateMany condicional: se o cliente aprovou no meio da edição, count = 0
    const { count } = await tx.quote.updateMany({
      where: { id: quoteId, userId, status: { not: "APPROVED" } },
      data: {
        customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress ?? null,
        title: data.title ?? null,
        notes: data.notes ?? null,
        discountCents: data.discountCents,
        totalCents,
        validUntil,
        status: "DRAFT",
        sentAt: null,
        viewedAt: null,
        respondedAt: null,
        rejectReason: null,
      },
    });
    if (count === 0) return null;
    await tx.quoteItem.deleteMany({ where: { quoteId } });
    await tx.quoteItem.createMany({ data: items.map((i) => ({ ...i, quoteId })) });
    return tx.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { publicId: true, number: true } });
  });

  if (!updated) return { ok: false, error: "Orçamento não encontrado ou já aprovado" };

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath(`/o/${updated.publicId}`);
  return { ok: true, data: { id: quoteId, number: updated.number } };
}

// Gera o link wa.me e marca como SENT (se ainda rascunho)
export async function sendQuoteViaWhatsApp(quoteId: string): Promise<ActionResult<{ url: string }>> {
  const userId = await requireUserId();

  const quote = await db.quote.findFirst({
    where: { id: quoteId, userId },
    include: { user: { select: { name: true, companyName: true, waTemplate: true } } },
  });
  if (!quote) return { ok: false, error: "Orçamento não encontrado" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL não configurada" };

  const publicUrl = `${baseUrl.replace(/\/$/, "")}/o/${quote.publicId}`;
  const sender = quote.user.companyName ?? quote.user.name;
  const message = renderWaTemplate(quote.user.waTemplate ?? DEFAULT_WA_TEMPLATE, {
    cliente: quote.customerName,
    valor: formatBRL(quote.totalCents),
    link: publicUrl,
    numero: quote.number,
    tecnico: sender,
  });

  if (quote.status === "DRAFT") {
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    revalidatePath("/orcamentos");
    revalidatePath(`/orcamentos/${quote.id}`);
    revalidatePath(`/o/${quote.publicId}`);
  }

  return { ok: true, data: { url: buildWhatsAppUrl(quote.customerPhone, message) } };
}

// Pública (sem auth): cliente aprova pelo link
export async function approveQuoteByPublicId(publicId: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return { ok: false, error: "Link inválido" };

  const now = new Date();
  // updateMany atômico: evita dupla aprovação e aprovação após expirar
  const { count } = await db.quote.updateMany({
    where: {
      publicId,
      status: "SENT",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    data: { status: "APPROVED", respondedAt: now },
  });

  if (count === 0) {
    const q = await db.quote.findUnique({ where: { publicId }, select: { status: true } });
    if (!q) return { ok: false, error: "Orçamento não encontrado" };
    if (q.status === "APPROVED") return { ok: true, data: undefined };
    return { ok: false, error: "Este orçamento não pode mais ser aprovado" };
  }

  revalidatePath(`/o/${publicId}`);
  revalidatePath("/orcamentos");
  await notifyQuoteResponse(publicId, "APPROVED");
  await scheduleMaintenanceReminder(publicId, now);

  return { ok: true, data: undefined };
}

// Pública (sem auth): beacon da página marca a 1ª abertura do link pelo cliente
export async function markQuoteViewed(publicId: string, src?: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return { ok: false, error: "Link inválido" };

  // técnico testando o próprio link não conta como "cliente abriu"
  const ownerId = await getUserId();

  // toda abertura de terceiros (não rascunho) entra em QuoteVisit; origem só se for um slug curto
  const cleanSrc = src && /^[a-z0-9_-]{1,24}$/i.test(src) ? src.toLowerCase() : null;
  const target = await db.quote.findFirst({
    where: { publicId, status: { not: "DRAFT" }, ...(ownerId ? { userId: { not: ownerId } } : {}) },
    select: { id: true },
  });
  if (target) await db.quoteVisit.create({ data: { quoteId: target.id, src: cleanSrc } });

  const { count } = await db.quote.updateMany({
    where: { publicId, status: "SENT", viewedAt: null, ...(ownerId ? { userId: { not: ownerId } } : {}) },
    data: { viewedAt: new Date() },
  });

  if (count > 0) {
    const q = await db.quote.findUnique({ where: { publicId }, select: { id: true } });
    revalidatePath("/inicio");
    revalidatePath("/orcamentos");
    if (q) revalidatePath(`/orcamentos/${q.id}`);
  }

  return { ok: true, data: undefined };
}

// Copia o orçamento como novo rascunho (snapshot dos itens, sem recalcular pelo catálogo)
export async function duplicateQuote(
  quoteId: string,
  extraDiscountPercent = 0,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();

  const src = await db.quote.findFirst({
    where: { id: quoteId, userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!src) return { ok: false, error: "Orçamento não encontrado" };

  const pct = Math.min(Math.max(extraDiscountPercent, 0), 50);
  const subtotal = src.items.reduce((acc, i) => acc + i.totalCents, 0);
  const discountCents = Math.min(src.discountCents + Math.round((subtotal * pct) / 100), subtotal);

  const copy = await db.$transaction(async (tx) => {
    const { quoteSeq } = await tx.user.update({
      where: { id: userId },
      data: { quoteSeq: { increment: 1 } },
      select: { quoteSeq: true },
    });
    return tx.quote.create({
      data: {
        userId,
        number: quoteSeq,
        customerName: src.customerName,
        customerPhone: src.customerPhone,
        customerAddress: src.customerAddress,
        title: src.title,
        notes: src.notes,
        discountCents,
        totalCents: subtotal - discountCents,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: {
          create: src.items.map((i) => ({
            serviceId: i.serviceId,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
            totalCents: i.totalCents,
            position: i.position,
          })),
        },
      },
      select: { id: true },
    });
  });

  revalidatePath("/orcamentos");
  return { ok: true, data: copy };
}

// Pública (sem auth): cliente recusa pelo link, com motivo opcional
export async function rejectQuoteByPublicId(publicId: string, reason?: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return { ok: false, error: "Link inválido" };

  const rejectReason = reason?.trim().slice(0, 300) || null;
  const { count } = await db.quote.updateMany({
    where: { publicId, status: "SENT" },
    data: { status: "REJECTED", respondedAt: new Date(), rejectReason },
  });

  if (count === 0) {
    const q = await db.quote.findUnique({ where: { publicId }, select: { status: true } });
    if (!q) return { ok: false, error: "Orçamento não encontrado" };
    if (q.status === "REJECTED") return { ok: true, data: undefined };
    return { ok: false, error: "Este orçamento não pode mais ser recusado" };
  }

  revalidatePath(`/o/${publicId}`);
  revalidatePath("/orcamentos");
  await notifyQuoteResponse(publicId, "REJECTED");
  return { ok: true, data: undefined };
}

// Renova a validade de um orçamento expirado e o devolve para "Enviado"
export async function renewQuote(quoteId: string, days = 7): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.quote.updateMany({
    where: { id: quoteId, userId, status: { in: ["EXPIRED", "SENT"] } },
    data: { status: "SENT", validUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000) },
  });
  if (count === 0) return { ok: false, error: "Orçamento não pode ser renovado" };

  const q = await db.quote.findFirst({ where: { id: quoteId, userId }, select: { publicId: true } });
  if (q) revalidatePath(`/o/${q.publicId}`);
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

// Controle de recebimento: só orçamento aprovado pode ser marcado como pago
export async function setQuotePaid(quoteId: string, paid: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  const { count } = await db.quote.updateMany({
    where: { id: quoteId, userId, status: "APPROVED" },
    data: { paidAt: paid ? new Date() : null },
  });
  if (count === 0) return { ok: false, error: "Orçamento não encontrado ou não aprovado" };

  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/orcamentos");
  revalidatePath("/inicio");
  return { ok: true, data: undefined };
}

// Lembrete de manutenção manual: só em orçamento aprovado. months = null remove o lembrete.
// Sempre usa a mensagem padrão (sem reminderText/reminderService): isso é só do agendamento
// automático pelo serviço na aprovação.
export async function setMaintenanceReminder(quoteId: string, months: number | null): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = reminderMonthsSchema.safeParse(months);
  if (!parsed.success) return { ok: false, error: "Prazo inválido" };

  const reminderAt = parsed.data === null ? null : addMonths(new Date(), parsed.data);

  const { count } = await db.quote.updateMany({
    where: { id: quoteId, userId, status: "APPROVED" },
    data: { reminderAt, reminderDoneAt: null, reminderNotifiedAt: null, reminderText: null, reminderService: null },
  });
  if (count === 0) return { ok: false, error: "Orçamento não encontrado ou não aprovado" };

  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/inicio");
  return { ok: true, data: undefined };
}

// Marca o lembrete como feito (some do início). Com nextMonths, já agenda a próxima manutenção
// (mesmo orçamento, mesmos reminderText/reminderService); sem, é só marcar como feito.
export async function completeMaintenanceReminder(quoteId: string, nextMonths?: 3 | 6 | 12 | null): Promise<ActionResult> {
  const userId = await requireUserId();

  if (nextMonths == null) {
    const { count } = await db.quote.updateMany({
      where: { id: quoteId, userId, reminderAt: { not: null } },
      data: { reminderDoneAt: new Date() },
    });
    if (count === 0) return { ok: false, error: "Lembrete não encontrado" };
  } else {
    const parsed = reminderMonthsSchema.safeParse(nextMonths);
    if (!parsed.success || parsed.data === null) return { ok: false, error: "Prazo inválido" };
    const { count } = await db.quote.updateMany({
      where: { id: quoteId, userId, reminderAt: { not: null } },
      data: { reminderAt: addMonths(new Date(), parsed.data), reminderDoneAt: null, reminderNotifiedAt: null },
    });
    if (count === 0) return { ok: false, error: "Lembrete não encontrado" };
  }

  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath("/inicio");
  return { ok: true, data: undefined };
}

// Fotos do orçamento: até 4, JPEG/PNG até 450 KB (o navegador reduz antes de enviar). Não vale para aprovado.
export async function addQuotePhoto(quoteId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido" };
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) return { ok: false, error: "A foto deve ter até 450 KB" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectPhotoType(bytes);
  if (!type) return { ok: false, error: "Use uma foto JPEG ou PNG" };

  const quote = await db.quote.findFirst({
    where: { id: quoteId, userId, status: { not: "APPROVED" } },
    select: { id: true, _count: { select: { photos: true } } },
  });
  if (!quote) return { ok: false, error: "Orçamento não encontrado ou já aprovado" };
  if (quote._count.photos >= MAX_PHOTOS_PER_QUOTE) return { ok: false, error: `Máximo de ${MAX_PHOTOS_PER_QUOTE} fotos` };

  // posição = próxima livre; o limite é conferido dentro da transação, com o orçamento travado
  const photo = await db.$transaction(async (tx) => {
    // trava a linha do orçamento: sem isso, envios simultâneos leem a mesma contagem e passam do limite
    await tx.$queryRaw`SELECT "id" FROM "Quote" WHERE "id" = ${quoteId} FOR UPDATE`;
    const count = await tx.quotePhoto.count({ where: { quoteId } });
    if (count >= MAX_PHOTOS_PER_QUOTE) return null;
    return tx.quotePhoto.create({
      data: { quoteId, data: Buffer.from(bytes), type, position: count },
      select: { id: true },
    });
  });
  if (!photo) return { ok: false, error: `Máximo de ${MAX_PHOTOS_PER_QUOTE} fotos` };

  revalidatePath(`/orcamentos/${quoteId}`);
  const pub = await db.quote.findUnique({ where: { id: quoteId }, select: { publicId: true } });
  if (pub) revalidatePath(`/o/${pub.publicId}`);
  return { ok: true, data: photo };
}

export async function removeQuotePhoto(photoId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const photo = await db.quotePhoto.findFirst({
    where: { id: photoId, quote: { userId, status: { not: "APPROVED" } } },
    select: { id: true, quoteId: true, quote: { select: { publicId: true } } },
  });
  if (!photo) return { ok: false, error: "Foto não encontrada" };

  await db.quotePhoto.delete({ where: { id: photo.id } });
  revalidatePath(`/orcamentos/${photo.quoteId}`);
  revalidatePath(`/o/${photo.quote.publicId}`);
  return { ok: true, data: undefined };
}

// Registra que o técnico cobrou o cliente pelo WhatsApp (evita cobrar duas vezes e some da lista por um tempo)
export async function markQuoteNudged(quoteId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = z.string().min(1).max(64).safeParse(quoteId);
  if (!id.success) return { ok: false, error: "Orçamento inválido" };
  const done = await db.$transaction(async (tx) => {
    const { count } = await tx.quote.updateMany({
      where: { id: id.data, userId, status: "SENT" },
      data: { lastNudgeAt: new Date() },
    });
    if (count === 0) return false;
    await tx.quoteNudge.create({ data: { quoteId: id.data, userId, kind: "NUDGE" } });
    return true;
  });
  if (!done) return { ok: false, error: "Orçamento não está aguardando resposta" };
  revalidatePath("/inicio");
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

// Adia a cobrança em 3 dias: lastNudgeAt no futuro (hoje + 1 dia) faz o orçamento voltar às listas 48h depois
export async function snoozeQuoteFollowUp(quoteId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = z.string().min(1).max(64).safeParse(quoteId);
  if (!id.success) return { ok: false, error: "Orçamento inválido" };
  const day = 24 * 60 * 60 * 1000;
  const done = await db.$transaction(async (tx) => {
    const { count } = await tx.quote.updateMany({
      // não adia quem vence em até 3 dias (a janela do adiamento): ele sumiria da lista e poderia expirar sem cobrança
      where: { id: id.data, userId, status: "SENT", OR: [{ validUntil: null }, { validUntil: { gt: new Date(Date.now() + SNOOZE_GUARD_MS) } }] },
      data: { lastNudgeAt: new Date(Date.now() + day) },
    });
    if (count === 0) return false;
    await tx.quoteNudge.create({ data: { quoteId: id.data, userId, kind: "SNOOZE" } });
    return true;
  });
  if (!done) return { ok: false, error: "Não dá para adiar: o orçamento vence em até 3 dias ou não está aguardando resposta" };
  revalidatePath("/inicio");
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}
