import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { leadWhatsAppUrl } from "@/lib/lead-message";
import { inicioDoDiaSP, limiteContatosDia } from "@/lib/lead-limits";
import { LEAD_STATUSES, leadStatusSchema } from "@/lib/validations/lead";
import { Card, CardContent } from "@/components/ui/card";
import { LeadForm } from "@/components/admin/lead-form";
import { LeadActions } from "@/components/admin/lead-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const filtro = leadStatusSchema.safeParse(status);
  const statusAtivo = filtro.success ? filtro.data : undefined;

  const limiteDia = limiteContatosDia();
  const [contatadosHoje, leads, contagens] = await Promise.all([
    db.lead.count({ where: { contatadoEm: { gte: inicioDoDiaSP() } } }),
    db.lead.findMany({
      where: statusAtivo ? { status: statusAtivo } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const porStatus = new Map(contagens.map((c) => [c.status, c._count._all]));
  const total = contagens.reduce((acc, c) => acc + c._count._all, 0);
  const limiteAtingido = contatadosHoje >= limiteDia;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Leads ({total})</h1>
        <Link href="/admin/leads/importar" className="flex h-11 items-center text-sm font-semibold text-primary">
          Importar / buscar
        </Link>
      </div>

      <p className={cn("text-xs", limiteAtingido ? "font-semibold text-warning" : "text-muted-foreground")}>
        Contatos hoje: {contatadosHoje}/{limiteDia}
        {limiteAtingido && " · limite atingido, volte amanhã"}
      </p>

      <LeadForm />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ value: undefined, label: "Todos", n: total }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase(), n: porStatus.get(s) ?? 0 }))].map(
          (opt) => (
            <Link
              key={opt.label}
              href={opt.value ? `/admin/leads?status=${opt.value}` : "/admin/leads"}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                statusAtivo === opt.value ? "border-primary bg-info-bg text-primary" : "border-input text-muted-foreground",
              )}
            >
              {opt.label} · {opt.n}
            </Link>
          ),
        )}
      </div>

      {leads.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum lead aqui.</p>}

      {leads.map((l) => (
        <Card key={l.id}>
          <CardContent className="space-y-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{l.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[l.cidade, l.origem].filter(Boolean).join(" · ")}
                {l.contatadoEm && ` · contatado há ${Math.max(0, Math.floor((Date.now() - l.contatadoEm.getTime()) / DAY_MS))}d`}
              </p>
              {l.notas && <p className="mt-0.5 text-xs text-muted-foreground">{l.notas}</p>}
            </div>
            <LeadActions
              id={l.id}
              status={l.status}
              waUrl={leadWhatsAppUrl(l)}
              contatadoEm={l.contatadoEm?.toISOString() ?? null}
              limiteAtingido={limiteAtingido}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
