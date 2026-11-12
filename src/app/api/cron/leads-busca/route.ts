import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { executarBuscaAutomaticaLeads } from "@/lib/lead-auto-search";

export const dynamic = "force-dynamic";

// De hora em hora: só busca de fato no dia/hora configurados em /admin/leads/importar
// (LeadAutomation.diasSemana/hora, horário de SP), até o limite de contato do dia ou a cota do
// Google acabar. Pausável pelo mesmo painel (LeadAutomation.ativo). Nunca envia mensagem.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resultado = await executarBuscaAutomaticaLeads();
  if (resultado.executada && resultado.novos > 0) revalidatePath("/admin/leads");
  return NextResponse.json({ ok: true, ...resultado });
}
