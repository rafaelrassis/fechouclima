"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { normalizeBrPhone } from "@/lib/whatsapp";
import { parseLeadLines, type ParsedLead } from "@/lib/lead-import";
import { buscarNegociosNoMapa, PlacesConfigError } from "@/lib/places";
import { LEAD_ORIGENS } from "@/lib/validations/lead";
import type { ActionResult } from "@/types/action";

export type ImportSummary = {
  novos: number;
  jaExistiam: number;
  jaSaoUsuarios: number;
  fixos: number;
  invalidos: number;
  cotaEsgotada?: boolean;
};

// Nunca recria quem já está na lista (telefone único, inclusive descartados) nem quem já é técnico cadastrado.
async function salvar(
  leads: ParsedLead[],
  origem: string,
): Promise<{ novos: number; jaExistiam: number; jaSaoUsuarios: number }> {
  if (leads.length === 0) return { novos: 0, jaExistiam: 0, jaSaoUsuarios: 0 };

  const usuarios = await db.user.findMany({ where: { phone: { not: null } }, select: { phone: true } });
  const telefonesUsuarios = new Set(usuarios.map((u) => normalizeBrPhone(u.phone ?? "")));
  const candidatos = leads.filter((l) => !telefonesUsuarios.has(l.telefone));
  const jaSaoUsuarios = leads.length - candidatos.length;

  const res = await db.lead.createMany({
    data: candidatos.map((l) => ({ nome: l.nome, telefone: l.telefone, cidade: l.cidade ?? null, origem })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/leads");
  return { novos: res.count, jaExistiam: candidatos.length - res.count, jaSaoUsuarios };
}

const importarSchema = z.object({
  texto: z.string().trim().min(1, "Cole a lista.").max(200_000, "Lista grande demais."),
  origem: z.enum(LEAD_ORIGENS),
  cidade: z.string().trim().max(80).optional(),
});

export async function importarLeads(input: z.input<typeof importarSchema>): Promise<ActionResult<ImportSummary>> {
  await requireAdmin();
  const parsed = importarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };

  const { leads, fixos, invalidos, repetidos } = parseLeadLines(parsed.data.texto, parsed.data.cidade || undefined);
  const { novos, jaExistiam, jaSaoUsuarios } = await salvar(leads, parsed.data.origem);
  return { ok: true, data: { novos, jaExistiam: jaExistiam + repetidos, jaSaoUsuarios, fixos, invalidos } };
}

const buscaSchema = z.object({
  cidade: z.string().trim().min(2, "Informe a cidade.").max(80),
  termo: z.string().trim().min(2).max(80).default("ar condicionado instalação"),
});

export async function buscarLeadsNoMapa(input: z.input<typeof buscaSchema>): Promise<ActionResult<ImportSummary>> {
  await requireAdmin();
  const parsed = buscaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };

  try {
    const { leads, fixos, semTelefone, cotaEsgotada } = await buscarNegociosNoMapa(parsed.data.cidade, parsed.data.termo);
    if (cotaEsgotada && leads.length === 0) {
      return { ok: false, error: "Cota gratuita do mês esgotada. Use \"Colar lista\" ou espere o mês virar." };
    }
    const { novos, jaExistiam, jaSaoUsuarios } = await salvar(leads, "gmaps");
    return { ok: true, data: { novos, jaExistiam, jaSaoUsuarios, fixos, invalidos: semTelefone, cotaEsgotada } };
  } catch (e) {
    if (e instanceof PlacesConfigError) return { ok: false, error: e.message };
    return { ok: false, error: "Não consegui buscar no Google agora. Tente de novo em instantes." };
  }
}
