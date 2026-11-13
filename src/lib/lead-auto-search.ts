import { deveRodarAgora, getLeadAutomation, cidadesDaAutomacao } from "@/lib/lead-automation";
import { salvarLeadsNovos } from "@/lib/lead-import";
import { buscarNegociosNoMapa, PlacesConfigError } from "@/lib/places";

export type ResultadoBuscaAutomatica =
  | { executada: false; motivo: "desativada" | "fora_do_horario" | "sem_chave" | "sem_cidades" }
  | { executada: true; novos: number; cidadesBuscadas: number; cotaEsgotada: boolean };

// O cron roda 1x/dia (vercel.json; sem Vercel Pro não dá pra escolher hora exata); só busca de
// fato nos dias da semana configurados em /admin/leads/importar (horário de SP). Varre TODAS as
// cidades configuradas nessa única rodada do dia (para de cidade em cidade só quando a cota
// diária/mensal do Google acaba): como só há 1 chance por dia, é melhor gastar a cota formando
// fila para os próximos dias do que parar cedo e nunca alcançar cidades mais abaixo da lista.
// Nunca envia mensagem: só alimenta a fila que o técnico abre no WhatsApp com 1 toque em /admin/leads.
export async function executarBuscaAutomaticaLeads(agora: Date = new Date()): Promise<ResultadoBuscaAutomatica> {
  const automacao = await getLeadAutomation();
  if (!automacao.ativo) return { executada: false, motivo: "desativada" };
  if (!deveRodarAgora(automacao, agora)) return { executada: false, motivo: "fora_do_horario" };
  if (!process.env.GOOGLE_PLACES_API_KEY) return { executada: false, motivo: "sem_chave" };

  const cidades = cidadesDaAutomacao(automacao.cidades);
  if (cidades.length === 0) return { executada: false, motivo: "sem_cidades" };

  let novosTotal = 0;
  let cidadesBuscadas = 0;
  let cotaEsgotada = false;

  for (const cidade of cidades) {
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
