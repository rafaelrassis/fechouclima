"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { LIMITS, getClientIp, rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/session";
import { leadTemplateId } from "@/lib/lead-message";
import { normalizeBrPhone } from "@/lib/whatsapp";
import { leadStatusSchema, registrarLeadSchema, type RegistrarLeadInput } from "@/lib/validations/lead";
import type { ActionResult } from "@/types/action";

export async function registrarLead(input: RegistrarLeadInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = registrarLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { nome, telefone, cidade, origem, notas } = parsed.data;

  try {
    await db.lead.create({
      data: {
        nome,
        telefone: normalizeBrPhone(telefone),
        cidade: cidade || null,
        origem,
        notas: notas || null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Esse telefone já está na lista." };
    }
    throw e;
  }

  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}

// Chamado ao clicar em "Abrir WhatsApp": só avança NOVO -> CONTATADO (nunca rebaixa status).
export async function marcarContatado(leadId: string): Promise<ActionResult> {
  await requireAdmin();
  await db.lead.updateMany({
    where: { id: leadId, status: "NOVO" },
    data: { status: "CONTATADO", contatadoEm: new Date(), templateId: leadTemplateId(leadId) },
  });
  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}

export async function atualizarStatusLead(leadId: string, status: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = leadStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Status inválido." };

  const res = await db.lead.updateMany({
    where: { id: leadId },
    data: {
      status: parsed.data,
      ...(parsed.data === "CONTATADO" ? { contatadoEm: new Date() } : {}),
    },
  });
  if (res.count === 0) return { ok: false, error: "Lead não encontrado." };

  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}

// Pública (sem auth): beacon de /v/[leadId]. Só conta com a aba visível (robôs de prévia não executam JS).
export async function marcarVideoVisto(leadId: string): Promise<ActionResult> {
  const rl = await rateLimit(`public:${await getClientIp()}`, LIMITS.publicAction.limit, LIMITS.publicAction.windowSec);
  if (!rl.ok) return { ok: false, error: "Muitas tentativas." };
  if (!/^c[a-z0-9]{20,30}$/.test(leadId)) return { ok: false, error: "Link inválido" };

  const { count } = await db.lead.updateMany({
    where: { id: leadId },
    data: { videoViews: { increment: 1 } },
  });
  if (count === 0) return { ok: false, error: "Link inválido" };
  await db.lead.updateMany({ where: { id: leadId, videoViewedAt: null }, data: { videoViewedAt: new Date() } });
  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}
