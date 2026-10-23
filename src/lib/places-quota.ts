import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { dataSP } from "@/lib/lead-limits";

// Text Search Enterprise (campo de telefone) tem 1.000 requisições grátis por mês no Google.
// Cada página de resultados conta como 1 requisição. Padrão 900: margem abaixo da cota grátis.
// Troque com PLACES_MONTHLY_LIMIT. O freio definitivo continua sendo a cota diária no Google Cloud.
export function limiteMensalPlaces(): number {
  const n = Number(process.env.PLACES_MONTHLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 900;
}

function chaveDoMes(): string {
  return `places:${dataSP().slice(0, 7)}`;
}

const JANELA_SEG = 35 * 24 * 60 * 60; // a chave é por mês; a janela só precisa cobrir o mês inteiro

// Teto diário (padrão 30 requisições ≈ 10 buscas): espalha a cota do mês e limita o estrago de um clique repetido.
export function limiteDiarioPlaces(): number {
  const n = Number(process.env.PLACES_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

function chaveDoDia(): string {
  return `places:dia:${dataSP()}`;
}

const JANELA_DIA_SEG = 26 * 60 * 60;

// Consome 1 requisição da cota; false = acabou (dia ou mês): não chame o Google.
export async function consumirCotaPlaces(): Promise<boolean> {
  const dia = await rateLimit(chaveDoDia(), limiteDiarioPlaces(), JANELA_DIA_SEG);
  if (!dia.ok) return false;
  const mes = await rateLimit(chaveDoMes(), limiteMensalPlaces(), JANELA_SEG);
  return mes.ok;
}

async function usoDaChave(key: string, limite: number): Promise<number> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  return row && row.resetAt > new Date() ? Math.min(row.count, limite) : 0;
}

export async function usoPlaces(): Promise<{ usadas: number; limite: number; usadasHoje: number; limiteDia: number }> {
  const limite = limiteMensalPlaces();
  const limiteDia = limiteDiarioPlaces();
  const [usadas, usadasHoje] = await Promise.all([usoDaChave(chaveDoMes(), limite), usoDaChave(chaveDoDia(), limiteDia)]);
  return { usadas, limite, usadasHoje, limiteDia };
}
