import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { leadFollowUpWhatsAppUrl, leadWhatsAppUrl } from "@/lib/lead-message";
import { inicioDoDiaSP, intervaloEntreContatosMs, limiteContatosDia } from "@/lib/lead-limits";
import { getLeadAutomation } from "@/lib/lead-automation";
import { LEAD_STATUSES, leadStatusSchema } from "@/lib/validations/lead";
import { Card, CardContent } from "@/components/ui/card";
import { LeadForm } from "@/components/admin/lead-form";
import { LeadActions } from "@/components/admin/lead-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; filtro?: string }> }) {
  await requireAdmin();
  const { status, filtro: filtroParam } = await searchParams;
  const quentes = filtroParam === "quentes";
  const filtro = leadStatusSchema.safeParse(status);
  const statusAtivo = filtro.success ? filtro.data : undefined;

  const limiteDia = limiteContatosDia();
  const [contatadosHoje, ultimoContato, leads, contagens, automacao, enviados] = await Promise.all([
    db.lead.count({ where: { contatadoEm: { gte: inicioDoDiaSP() } } }),
    db.lead.findFirst({
      where: { contatadoEm: { not: null } },
      orderBy: { contatadoEm: "desc" },
      select: { contatadoEm: true },
    }),
    db.lead.findMany({
      where: quentes ? { status: "CONTATADO", videoViewedAt: { not: null } } : statusAtivo ? { status: statusAtivo } : undefined,
      orderBy: [{ videoViewedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
    }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    getLeadAutomation(),
    db.lead.findMany({ where: { templateId: { not: null } }, select: { templateId: true, status: true, videoViewedAt: true } }),
  ]);
  const porTemplate = new Map<string, { enviados: number; viram: number; responderam: number }>();
  for (const e of enviados) {
    const t = porTemplate.get(e.templateId!) ?? { enviados: 0, viram: 0, responderam: 0 };
    t.enviados++;
    if (e.videoViewedAt) t.viram++;
    if (["RESPONDEU", "TESTANDO", "CLIENTE"].includes(e.status)) t.responderam++;
    porTemplate.set(e.templateId!, t);
  }
  const porStatus = new Map(contagens.map((c) => [c.status, c._count._all]));
  const total = contagens.reduce((acc, c) => acc + c._count._all, 0);
  const quentesTotal = await db.lead.count({ where: { status: "CONTATADO", videoViewedAt: { not: null } } });
  const limiteAtingido = contatadosHoje >= limiteDia;
  const liberaEm = ultimoContato?.contatadoEm ? ultimoContato.contatadoEm.getTime() + intervaloEntreContatosMs() : 0;

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
      <p className="text-xs text-muted-foreground">
        Busca automática: <span className={automacao.ativo ? "font-semibold text-success" : "font-semibold"}>{automacao.ativo ? "ativa" : "pausada"}</span>
        {" · "}
        <Link href="/admin/leads/importar" className="font-semibold text-primary">
          gerenciar
        </Link>
      </p>

      {porTemplate.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Mensagens (enviadas · viram vídeo · responderam):{" "}
          {[...porTemplate.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([id, t]) => `${id} ${t.enviados}·${t.viram}·${t.responderam}`)
            .join(" | ")}
        </p>
      )}

      <LeadForm />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/admin/leads?filtro=quentes"
          className={cn(
            "flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
            quentes ? "border-primary bg-info-bg text-primary" : "border-input text-muted-foreground",
          )}
        >
          🔥 Quentes · {quentesTotal}
        </Link>
        {[{ value: undefined, label: "Todos", n: total }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase(), n: porStatus.get(s) ?? 0 }))].map(
          (opt) => (
            <Link
              key={opt.label}
              href={opt.value ? `/admin/leads?status=${opt.value}` : "/admin/leads"}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                !quentes && statusAtivo === opt.value ? "border-primary bg-info-bg text-primary" : "border-input text-muted-foreground",
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
                {l.templateId && ` · msg ${l.templateId}`}
              </p>
              {l.videoViewedAt && (
                <p className="text-xs font-semibold text-success">
                  🔥 Viu o vídeo{l.videoViews > 1 ? ` (${l.videoViews}x)` : ""} em{" "}
                  {l.videoViewedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {l.notas && <p className="mt-0.5 text-xs text-muted-foreground">{l.notas}</p>}
            </div>
            <LeadActions
              id={l.id}
              status={l.status}
              waUrl={l.status === "NOVO" ? leadWhatsAppUrl(l) : leadFollowUpWhatsAppUrl({ ...l, viu: !!l.videoViewedAt })}
              contatadoEm={l.contatadoEm?.toISOString() ?? null}
              limiteAtingido={limiteAtingido}
              liberaEm={liberaEm}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
