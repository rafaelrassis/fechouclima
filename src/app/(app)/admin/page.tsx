import { requireAdmin } from "@/lib/session";
import { getAdminOverview, getVisitsBySource, parseDateRangeParams } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { Stat } from "@/components/admin/stat";
import { DateRangeFilter } from "@/components/admin/date-range-filter";

export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdmin();
  const { from, to } = await searchParams;
  const range = parseDateRangeParams({ from, to });
  const [o, visitas] = await Promise.all([getAdminOverview(range), getVisitsBySource(range)]);

  const vistosPct = o.enviados > 0 ? Math.round((o.vistos / o.enviados) * 100) : 0;
  const aprovadosPct = o.enviados > 0 ? Math.round((o.aprovados / o.enviados) * 100) : 0;
  const filtrado = !!(from || to);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Visão geral</h1>

      <DateRangeFilter basePath="/admin" from={from} to={to} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Técnicos</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cadastrados" value={String(o.tecnicosTotal)} />
          <Stat label="Ativos" value={String(o.tecnicosAtivos)} hint={o.tecnicosInativos > 0 ? `${o.tecnicosInativos} inativo(s)` : undefined} />
          <Stat label="Novos (7d)" value={String(o.cadastros7d)} />
          <Stat label="Novos (30d)" value={String(o.cadastros30d)} />
          {filtrado && <Stat label="Cadastrados no período" value={String(o.cadastrosNoPeriodo ?? 0)} />}
        </div>
        {o.tecnicosSemEnvio > 0 && (
          <p className="text-xs text-muted-foreground">
            {o.tecnicosSemEnvio} técnico(s) nunca enviaram um orçamento.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Orçamentos {filtrado && "no período"}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total" value={String(o.orcamentosTotal)} />
          <Stat label="Rascunhos" value={String(o.rascunhos)} />
          <Stat label="Enviados" value={String(o.enviados)} />
          <Stat label="Vistos" value={`${o.vistos} (${vistosPct}%)`} hint="do que foi enviado" />
          <Stat label="Aprovados" value={`${o.aprovados} (${aprovadosPct}%)`} hint="do que foi enviado" />
          <Stat label="Recusados" value={String(o.recusados)} />
          <Stat label="Expirados" value={String(o.expirados)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Aberturas do link {filtrado && "no período"}</h2>
        {visitas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma abertura registrada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visitas.map((v) => (
              <Stat key={v.src ?? "sem-origem"} label={v.src ?? "sem origem"} value={String(v.aberturas)} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Use ?src=maps no fim do link para medir o canal. Não conta suas próprias aberturas.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Receita (aprovados {filtrado && "no período"})</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total aprovado" value={formatBRL(o.receitaAprovadaCents)} />
          <Stat label="Ticket médio" value={formatBRL(o.ticketMedioCents)} />
        </div>
      </section>
    </div>
  );
}
