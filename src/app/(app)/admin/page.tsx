import { requireAdmin } from "@/lib/session";
import { getAdminOverview } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { Stat } from "@/components/admin/stat";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const o = await getAdminOverview();

  const vistosPct = o.enviados > 0 ? Math.round((o.vistos / o.enviados) * 100) : 0;
  const aprovadosPct = o.enviados > 0 ? Math.round((o.aprovados / o.enviados) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Visão geral</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Técnicos</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cadastrados" value={String(o.tecnicosTotal)} />
          <Stat label="Ativos" value={String(o.tecnicosAtivos)} hint={o.tecnicosInativos > 0 ? `${o.tecnicosInativos} inativo(s)` : undefined} />
          <Stat label="Novos (7d)" value={String(o.cadastros7d)} />
          <Stat label="Novos (30d)" value={String(o.cadastros30d)} />
        </div>
        {o.tecnicosSemEnvio > 0 && (
          <p className="text-xs text-muted-foreground">
            {o.tecnicosSemEnvio} técnico(s) nunca enviaram um orçamento.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Orçamentos</h2>
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
        <h2 className="text-sm font-semibold text-muted-foreground">Receita (aprovados)</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total aprovado" value={formatBRL(o.receitaAprovadaCents)} />
          <Stat label="Ticket médio" value={formatBRL(o.ticketMedioCents)} />
        </div>
      </section>
    </div>
  );
}
