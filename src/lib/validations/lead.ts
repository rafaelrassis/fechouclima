import { z } from "zod";

export const LEAD_STATUSES = ["NOVO", "CONTATADO", "RESPONDEU", "TESTANDO", "CLIENTE", "DESCARTADO"] as const;
export const LEAD_ORIGENS = ["gmaps", "instagram", "grupo", "indicacao", "outro"] as const;

export const registrarLeadSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(120),
  telefone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido (DDD + número)"),
  cidade: z.string().trim().max(80).optional(),
  origem: z.enum(LEAD_ORIGENS),
  notas: z.string().trim().max(500).optional(),
});

export type RegistrarLeadInput = z.input<typeof registrarLeadSchema>;

export const leadStatusSchema = z.enum(LEAD_STATUSES);
