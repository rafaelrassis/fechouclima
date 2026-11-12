import { db } from "@/lib/db";

export const LEAD_AUTOMATION_ID = "default";

export async function getLeadAutomation() {
  const existente = await db.leadAutomation.findUnique({ where: { id: LEAD_AUTOMATION_ID } });
  if (existente) return existente;
  return db.leadAutomation.create({ data: { id: LEAD_AUTOMATION_ID, cidades: "" } });
}

export function cidadesDaAutomacao(cidades: string): string[] {
  return cidades
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
}
