import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Text Search Enterprise (campo de telefone) tem 1.000 requisições grátis por mês no Google.
// Cada página de resultados conta como 1 requisição. Padrão 900: margem abaixo da cota grátis.
// Troque com PLACES_MONTHLY_LIMIT. O freio definitivo continua sendo a cota diária no Google Cloud.
export function limiteMensalPlaces(): number {
  const n = Number(process.env.PLACES_MONTHLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 900;
}

function chaveDoMes(): string {
  const mes = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  return `places:${mes}`;
}

const JANELA_SEG = 35 * 24 * 60 * 60; // a chave é por mês; a janela só precisa cobrir o mês inteiro

// Consome 1 requisição da cota; ok=false = acabou (não chame o Google).
export async function consumirCotaPlaces(): Promise<boolean> {
  const { ok } = await rateLimit(chaveDoMes(), limiteMensalPlaces(), JANELA_SEG);
  return ok;
}

export async function usoMensalPlaces(): Promise<{ usadas: number; limite: number }> {
  const row = await db.rateLimit.findUnique({ where: { key: chaveDoMes() } });
  const usadas = row && row.resetAt > new Date() ? Math.min(row.count, limiteMensalPlaces()) : 0;
  return { usadas, limite: limiteMensalPlaces() };
}
