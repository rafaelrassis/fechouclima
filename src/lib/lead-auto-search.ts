import { db } from "@/lib/db";
import { getLeadAutomation, cidadesDaAutomacao } from "@/lib/lead-automation";
import { salvarLeadsNovos } from "@/lib/lead-import";
import { limiteContatosDia } from "@/lib/lead-limits";
import { buscarNegociosNoMapa, PlacesConfigError } from "@/lib/places";

export type ResultadoBuscaAutomatica =
  | { executada: false; motivo: "desativada" | "sem_chave" | "sem_cidades" }
  | { executada: true; novos: number; cidadesBuscadas: number; cotaEsgotada: boolean };

// Roda 1x/dia (cron). Busca cidade por cidade até a cota diária/mensal do Google acabar ou já
// haver leads NOVOS suficientes para o limite de contato de hoje (sem sentido buscar mais do que
// se consegue contatar manualmente no dia). Nunca envia mensagem: só alimenta a fila que o técnico
// abre no WhatsApp com 1 toque em /admin/leads.
export async function executarBuscaAutomaticaLeads(): Promise<ResultadoBuscaAutomatica> {
  const automacao = await getLeadAutomation();
  if (!automacao.ativo) return { executada: false, motivo: "desativada" };
  if (!process.env.GOOGLE_PLACES_API_KEY) return { executada: false, motivo: "sem_chave" };

  const cidades = cidadesDaAutomacao(automacao.cidades);
  if (cidades.length === 0) return { executada: false, motivo: "sem_cidades" };

  const limiteFila = limiteContatosDia();
  let novosTotal = 0;
  let cidadesBuscadas = 0;
  let cotaEsgotada = false;

  for (const cidade of cidades) {
    const novosNaFila = await db.lead.count({ where: { status: "NOVO" } });
    if (novosNaFila >= limiteFila) break;

    let resultado: Awaited<ReturnType<typeof buscarNegociosNoMapa>>;
    try {
      resultado = await buscarNegociosNoMapa(cidade, automacao.termo);
    } catch (e) {
      if (e instanceof PlacesConfigError) break;
      continue; // falha de rede numa cidade não derruba as outras
    }
    cidadesBuscadas++;

    if (resultado.leads.length > 0) {
      const { novos } = await salvarLeadsNovos(resultado.leads, "gmaps-auto");
      novosTotal += novos;
    }

    if (resultado.cotaEsgotada) {
      cotaEsgotada = true;
      break;
    }
  }

  return { executada: true, novos: novosTotal, cidadesBuscadas, cotaEsgotada };
}
