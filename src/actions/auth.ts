"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { LIMITS, getClientIp, rateLimit, rateLimitInfo } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/session";
import { escapeHtml, sendEmail } from "@/lib/email";
import { createResetToken, hashToken, resetUrl } from "@/lib/password-reset";
import { forgotPasswordSchema, referralCodeSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";

// `values` devolve o que foi digitado: no React 19 o formulário é limpo depois da ação
export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { name: string; email: string; phone: string; companyName: string };
};

export type LoginState = { error?: string; email?: string };

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/inicio",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const ip = await getClientIp();
      const email = String(formData.get("email") ?? "").toLowerCase();
      const [byEmail, byIp] = await Promise.all([
        rateLimitInfo(`login:${ip}:${email}`, LIMITS.loginEmail.limit),
        rateLimitInfo(`login:${ip}`, LIMITS.loginIp.limit),
      ]);
      const wait = Math.max(byEmail.limited ? byEmail.retryAfterSec : 0, byIp.limited ? byIp.retryAfterSec : 0);
      return {
        email: String(formData.get("email") ?? ""),
        error:
          wait > 0
            ? `Muitas tentativas. Tente novamente em ${Math.ceil(wait / 60)} min.`
            : "E-mail ou senha inválidos",
      };
    }
    throw e; // NEXT_REDIRECT
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function registerAction(
  _prev: RegisterState | undefined,
  formData: FormData,
): Promise<RegisterState | undefined> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
  };
  const reg = await rateLimit(`register:${await getClientIp()}`, LIMITS.register.limit, LIMITS.register.windowSec);
  if (!reg.ok) return { error: "Muitas tentativas. Tente novamente mais tarde.", values };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    accept: formData.get("accept"),
  });
  if (!parsed.success) {
    return { error: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors, values };
  }
  const { name, email, password, phone, companyName } = parsed.data;

  // código inexistente/inválido é ignorado em silêncio: não bloqueia o cadastro, não revela se existe
  const refParsed = referralCodeSchema.safeParse(formData.get("ref"));
  const referredBy = refParsed.success
    ? await db.user.findUnique({ where: { referralCode: refParsed.data }, select: { id: true } })
    : null;

  try {
    await db.user.create({
      data: {
        name,
        email,
        phone,
        companyName: companyName || null,
        passwordHash: await bcrypt.hash(password, 10),
        termsAcceptedAt: new Date(),
        referredById: referredBy?.id,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { email: ["E-mail já cadastrado"] }, values };
    }
    throw e;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/inicio" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Conta criada. Entre pelo login.", values };
    throw e; // NEXT_REDIRECT
  }
}

export type ResetState = { ok?: boolean; error?: string };

// Resposta sempre igual, exista o e-mail ou não (não revela quem tem conta)
export async function requestPasswordReset(
  _prev: ResetState | undefined,
  formData: FormData,
): Promise<ResetState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Informe um e-mail válido" };
  const { email } = parsed.data;

  const ip = await getClientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`reset:ip:${ip}`, LIMITS.resetIp.limit, LIMITS.resetIp.windowSec),
    rateLimit(`reset:email:${email}`, LIMITS.resetEmail.limit, LIMITS.resetEmail.windowSec),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: "Muitas tentativas. Tente novamente mais tarde." };

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const token = await createResetToken(user.id);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = resetUrl(token, base);
    const sent = await sendEmail({
      to: email,
      subject: "Redefinir sua senha do FechouClima",
      text: `Para criar uma nova senha, abra o link (vale por 1 hora e só pode ser usado uma vez):\\n${link}\\n\\nSe você não pediu, ignore este e-mail.`,
      html:
        `<p>Para criar uma nova senha, clique no botão abaixo. O link vale por 1 hora e só pode ser usado uma vez.</p>` +
        `<p><a href="${escapeHtml(link)}">Criar nova senha</a></p>` +
        `<p style="color:#64748b;font-size:12px">Se você não pediu, ignore este e-mail.</p>`,
    });
    // sem Resend configurado (desenvolvimento), mostra o link no log do servidor
    if (!sent && process.env.NODE_ENV !== "production") console.info(`[reset] link para ${email}: ${link}`);
  }
  return { ok: true };
}

export async function resetPassword(
  _prev: ResetState | undefined,
  formData: FormData,
): Promise<ResetState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (formData.get("password") !== formData.get("confirm")) return { error: "As senhas não conferem" };

  const rl = await rateLimit(`reset-use:${await getClientIp()}`, LIMITS.resetUse.limit, LIMITS.resetUse.windowSec);
  if (!rl.ok) return { error: "Muitas tentativas. Tente novamente mais tarde." };

  const tokenHash = hashToken(parsed.data.token);
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // updateMany condicional = uso único atômico (dois cliques ao mesmo tempo: só um passa)
  const ok = await db.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) return false;
    const row = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
    // invalida sessões emitidas antes da troca: quem redefiniu a senha derruba quem a tinha
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, sessionsValidAfter: new Date() } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } });
    return true;
  });

  if (!ok) return { error: "Link inválido ou expirado. Peça um novo." };
  return { ok: true };
}

export type DeleteAccountState = { error?: string };

// Exclusão definitiva da conta e de todos os dados (orçamentos, clientes, serviços, logo, assinaturas de push).
// Exige a senha atual e tem rate limit.
export async function deleteAccount(
  _prev: DeleteAccountState | undefined,
  formData: FormData,
): Promise<DeleteAccountState | undefined> {
  const userId = await requireUserId();
  const rl = await rateLimit(`delete:${userId}`, LIMITS.deleteAccount.limit, LIMITS.deleteAccount.windowSec);
  if (!rl.ok) return { error: "Muitas tentativas. Tente novamente mais tarde." };

  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Senha incorreta" };
  }

  await db.user.delete({ where: { id: userId } }); // cascata remove todos os dados do técnico
  await signOut({ redirectTo: "/login?conta=excluida" });
}
