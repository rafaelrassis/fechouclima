import { db } from "@/lib/db";
import { diaSemanaSP } from "@/lib/lead-limits";

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

export function diasSemanaDaAutomacao(diasSemana: string): number[] {
  return diasSemana
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

// O cron roda 1x/dia (horário fixo em vercel.json: sem Vercel Pro não dá pra escolher hora exata);
// aqui só filtramos o dia da semana configurado. Fora dos dias marcados, a chamada é um no-op
// (ver motivo "fora_do_horario").
export function deveRodarAgora(automacao: { diasSemana: string }, agora: Date = new Date()): boolean {
  return diasSemanaDaAutomacao(automacao.diasSemana).includes(diaSemanaSP(agora));
}
