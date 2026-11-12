import { db } from "@/lib/db";
import { diaSemanaSP, horaSP } from "@/lib/lead-limits";

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

// O cron roda de hora em hora; só executa de fato quando bate com o dia da semana e a hora
// configurados (horário de SP). Fora da janela, a chamada é um no-op (ver motivo "fora_do_horario").
export function deveRodarAgora(automacao: { diasSemana: string; hora: number }, agora: Date = new Date()): boolean {
  return diasSemanaDaAutomacao(automacao.diasSemana).includes(diaSemanaSP(agora)) && horaSP(agora) === automacao.hora;
}
