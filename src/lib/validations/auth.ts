import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(72, "Máximo de 72 caracteres"),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 11, "WhatsApp inválido"),
  // checkbox HTML: "on" quando marcado, ausente (null) quando não
  accept: z.literal("on", { error: "Aceite os Termos e a Política de Privacidade" }),
});

export const waTemplateSchema = z.object({
  template: z
    .string()
    .trim()
    .min(10, "Mensagem muito curta")
    .max(600, "Máximo de 600 caracteres")
    .refine((v) => v.includes("{link}"), "A mensagem precisa conter {link}"),
});

export const nudgeTemplateSchema = z.object({
  template: z.string().trim().min(10, "Mensagem muito curta").max(400, "Máximo de 400 caracteres"),
});

export const approvalWaTemplateSchema = z.object({
  template: z.string().trim().min(10, "Mensagem muito curta").max(400, "Máximo de 400 caracteres"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, "Link inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(72, "Máximo de 72 caracteres"),
});

// Código de indicação: 6 caracteres de ABCDEFGHJKMNPQRSTUVWXYZ23456789 (sem I/L/O/0/1)
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/);
