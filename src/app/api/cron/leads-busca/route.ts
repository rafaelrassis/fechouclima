import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { executarBuscaAutomaticaLeads } from "@/lib/lead-auto-search";

export const dynamic = "force-dynamic";

// Diário: busca leads automaticamente (Google Places) até o limite de contato do dia ou a cota
// do Google acabar. Pausável em /admin/leads/importar (LeadAutomation.ativo). Nunca envia mensagem.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resultado = await executarBuscaAutomaticaLeads();
  if (resultado.executada && resultado.novos > 0) revalidatePath("/admin/leads");
  return NextResponse.json({ ok: true, ...resultado });
}
