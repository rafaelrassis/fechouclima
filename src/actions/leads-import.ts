"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { parseLeadLines, type ParsedLead } from "@/lib/lead-import";
import { buscarNegociosNoMapa, PlacesConfigError } from "@/lib/places";
import { LEAD_ORIGENS } from "@/lib/validations/lead";
import type { ActionResult } from "@/types/action";

export type ImportSummary = {
  novos: number;
  jaExistiam: number;
  fixos: number;
  invalidos: number;
};

async function salvar(leads: ParsedLead[], origem: string): Promise<{ novos: number; jaExistiam: number }> {
  if (leads.length === 0) return { novos: 0, jaExistiam: 0 };
  const res = await db.lead.createMany({
    data: leads.map((l) => ({ nome: l.nome, telefone: l.telefone, cidade: l.cidade ?? null, origem })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/leads");
  return { novos: res.count, jaExistiam: leads.length - res.count };
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
  const { novos, jaExistiam } = await salvar(leads, parsed.data.origem);
  return { ok: true, data: { novos, jaExistiam: jaExistiam + repetidos, fixos, invalidos } };
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
    const { leads, fixos, semTelefone } = await buscarNegociosNoMapa(parsed.data.cidade, parsed.data.termo);
    const { novos, jaExistiam } = await salvar(leads, "gmaps");
    return { ok: true, data: { novos, jaExistiam, fixos, invalidos: semTelefone } };
  } catch (e) {
    if (e instanceof PlacesConfigError) return { ok: false, error: e.message };
    return { ok: false, error: "Não consegui buscar no Google agora. Tente de novo em instantes." };
  }
}
