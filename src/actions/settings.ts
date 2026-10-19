"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { DEFAULT_BRAND, isBrandColor } from "@/lib/brand";
import { MAX_LOGO_BYTES, detectLogoType } from "@/lib/logo";
import { generateReferralCode } from "@/lib/referral";
import { approvalWaTemplateSchema, nudgeTemplateSchema, waTemplateSchema } from "@/lib/validations/auth";
import { pixSchema } from "@/lib/validations/pix";
import { pushSubscriptionSchema, type PushSubscriptionInput } from "@/lib/validations/push";
import { reminderMonthsSchema } from "@/lib/validations/service";
import type { ActionResult } from "@/types/action";

const REFERRAL_ATTEMPTS = 5;

// Devolve o código de indicação do técnico, gerando na 1ª vez que é pedido (sem backfill).
export async function ensureReferralCode(): Promise<ActionResult<{ code: string }>> {
  const userId = await requireUserId();
  const existing = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (existing?.referralCode) return { ok: true, data: { code: existing.referralCode } };

  for (let attempt = 0; attempt < REFERRAL_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return { ok: true, data: { code } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false, error: "Não foi possível gerar seu código agora. Tente de novo." };
}

export async function saveWaTemplate(template: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = waTemplateSchema.safeParse({ template });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida" };
  }
  await db.user.update({ where: { id: userId }, data: { waTemplate: parsed.data.template } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Volta ao modelo padrão
export async function resetWaTemplate(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { waTemplate: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function saveNudgeTemplate(template: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = nudgeTemplateSchema.safeParse({ template });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida" };
  }
  await db.user.update({ where: { id: userId }, data: { nudgeTemplate: parsed.data.template } });
  revalidatePath("/ajustes");
  revalidatePath("/inicio");
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

// Volta ao modelo padrão de cobrança
export async function resetNudgeTemplate(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { nudgeTemplate: null } });
  revalidatePath("/ajustes");
  revalidatePath("/inicio");
  revalidatePath("/orcamentos");
  return { ok: true, data: undefined };
}

export async function saveApprovalWaTemplate(template: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = approvalWaTemplateSchema.safeParse({ template });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida" };
  }
  await db.user.update({ where: { id: userId }, data: { approvalWaTemplate: parsed.data.template } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Volta ao modelo padrão de pós-aprovação
export async function resetApprovalWaTemplate(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { approvalWaTemplate: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function saveEmailDigest(enabled: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { emailDigest: enabled === true } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Logo do técnico: PNG até 150 KB (o cliente já reduz para 256px antes de enviar)
export async function saveLogo(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const file = formData.get("logo");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido" };
  if (file.size === 0 || file.size > MAX_LOGO_BYTES) return { ok: false, error: "A imagem deve ter até 150 KB" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectLogoType(bytes);
  if (!type) return { ok: false, error: "Use uma imagem PNG" };

  await db.user.update({
    where: { id: userId },
    data: { logo: Buffer.from(bytes), logoType: type, logoUpdatedAt: new Date() },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removeLogo(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { logo: null, logoType: null, logoUpdatedAt: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function savePushSubscription(input: PushSubscriptionInput, userAgent?: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Assinatura inválida" };
  const { endpoint, keys } = parsed.data;

  // O endpoint é do navegador: se outro técnico entrar no mesmo aparelho, a assinatura passa a ser dele
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.pushSubscription.deleteMany({ where: { endpoint, userId } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function savePix(key: string, city: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = pixSchema.safeParse({ key, city });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  await db.user.update({
    where: { id: userId },
    data: { pixKey: parsed.data.key, pixKeyType: parsed.data.type, pixCity: parsed.data.city },
  });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function removePix(): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { pixKey: null, pixKeyType: null, pixCity: null } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

// Invalida todas as sessões (inclusive a atual, que é encerrada em seguida) ao trocar o aparelho
// ou suspeitar de acesso indevido, sem precisar redefinir a senha.
export async function logoutEverywhere(): Promise<void> {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { sessionsValidAfter: new Date() } });
  // import dinâmico: evita carregar o next-auth (e seu runtime) para quem só usa as outras actions deste arquivo
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/login" });
}

// Padrão geral de lembrete de manutenção: vale para aprovações futuras quando nenhum item do
// orçamento tem serviço com prazo próprio. null desliga o lembrete automático.
export async function saveDefaultReminder(months: number | null): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = reminderMonthsSchema.safeParse(months);
  if (!parsed.success) return { ok: false, error: "Prazo inválido" };
  await db.user.update({ where: { id: userId }, data: { defaultReminderMonths: parsed.data } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}

export async function saveBrandColor(hex: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isBrandColor(hex)) return { ok: false, error: "Cor inválida" };
  await db.user.update({ where: { id: userId }, data: { brandColor: hex === DEFAULT_BRAND ? null : hex } });
  revalidatePath("/ajustes");
  return { ok: true, data: undefined };
}
