import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { executarBuscaAutomaticaLeads } from "@/lib/lead-auto-search";

export const dynamic = "force-dynamic";

// Diário, 6h BRT (1x/dia: compatível com Vercel Hobby, sem precisar de Pro). Só busca de fato nos
// dias da semana configurados em /admin/leads/importar (LeadAutomation.diasSemana, horário de SP),
// varrendo todas as cidades até a cota do Google acabar. Pausável pelo mesmo painel
// (LeadAutomation.ativo). Nunca envia mensagem.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resultado = await executarBuscaAutomaticaLeads();
  if (resultado.executada && resultado.novos > 0) revalidatePath("/admin/leads");
  return NextResponse.json({ ok: true, ...resultado });
}
