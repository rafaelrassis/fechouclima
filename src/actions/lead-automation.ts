"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { LEAD_AUTOMATION_ID } from "@/lib/lead-automation";
import type { ActionResult } from "@/types/action";

// Interruptor da busca automática (cron). Nunca afeta o envio: contatar continua manual.
export async function definirAtivaAutomacaoLeads(ativo: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.leadAutomation.upsert({
    where: { id: LEAD_AUTOMATION_ID },
    create: { id: LEAD_AUTOMATION_ID, cidades: "", ativo },
    update: { ativo },
  });
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/importar");
  return { ok: true, data: undefined };
}

const configSchema = z.object({
  cidades: z.string().trim().max(2000, "Lista de cidades grande demais."),
  termo: z.string().trim().min(2, "Termo muito curto.").max(80),
});

export async function salvarConfigAutomacaoLeads(input: z.input<typeof configSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };

  await db.leadAutomation.upsert({
    where: { id: LEAD_AUTOMATION_ID },
    create: { id: LEAD_AUTOMATION_ID, cidades: parsed.data.cidades, termo: parsed.data.termo },
    update: { cidades: parsed.data.cidades, termo: parsed.data.termo },
  });
  revalidatePath("/admin/leads/importar");
  return { ok: true, data: undefined };
}
