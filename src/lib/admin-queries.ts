import type { Prisma, QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = { from?: Date; to?: Date };

// Sem from/to: undefined (sem filtro, "desde sempre"). Usado em Quote.createdAt e User.createdAt.
function dateRangeWhere(range?: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range || (!range.from && !range.to)) return undefined;
  return { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) };
}

// Datas de ?from=&to= (YYYY-MM-DD, do input type="date") para um DateRange: `to` inclui o dia inteiro.
export function parseDateRangeParams(params: { from?: string; to?: string }): DateRange {
  const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : undefined;
  return {
    from: from && !isNaN(from.getTime()) ? from : undefined,
    to: to && !isNaN(to.getTime()) ? to : undefined,
  };
}

export type AdminOverview = {
  tecnicosTotal: number;
  tecnicosAtivos: number;
  tecnicosInativos: number;
  cadastros7d: number;
  cadastros30d: number;
  cadastrosNoPeriodo: number | null;
  orcamentosTotal: number;
  rascunhos: number;
  enviados: number;
  vistos: number;
  aprovados: number;
  recusados: number;
  expirados: number;
  receitaAprovadaCents: number;
  ticketMedioCents: number;
  tecnicosSemEnvio: number;
};

// Visão geral para o dashboard admin: 1 ida ao banco por métrica, tudo em paralelo.
// `range` filtra os orçamentos (e os cadastros em `cadastrosNoPeriodo`) por Quote/User.createdAt;
// sem range, é "desde sempre" (comportamento anterior).
export async function getAdminOverview(range?: DateRange, now = new Date()): Promise<AdminOverview> {
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const createdAt = dateRangeWhere(range);
  const quoteWhere: Prisma.QuoteWhereInput = createdAt ? { createdAt } : {};

  const [
    tecnicosTotal,
    tecnicosAtivos,
    cadastros7d,
    cadastros30d,
    cadastrosNoPeriodo,
    porStatus,
    enviados,
    vistos,
    receitaAprovada,
    tecnicosSemEnvio,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { createdAt: { gte: since7d } } }),
    db.user.count({ where: { createdAt: { gte: since30d } } }),
    createdAt ? db.user.count({ where: { createdAt } }) : Promise.resolve(null),
    db.quote.groupBy({ by: ["status"], where: quoteWhere, _count: { _all: true } }),
    db.quote.count({ where: { ...quoteWhere, sentAt: { not: null } } }),
    db.quote.count({ where: { ...quoteWhere, sentAt: { not: null }, viewedAt: { not: null } } }),
    db.quote.aggregate({ where: { ...quoteWhere, status: "APPROVED" }, _sum: { totalCents: true }, _count: { _all: true } }),
    db.user.count({ where: { quotes: { none: { sentAt: { not: null } } } } }),
  ]);

  const byStatus = (status: string) => porStatus.find((s) => s.status === status)?._count._all ?? 0;
  const aprovados = receitaAprovada._count._all;
  const receitaAprovadaCents = receitaAprovada._sum.totalCents ?? 0;

  return {
    tecnicosTotal,
    tecnicosAtivos,
    tecnicosInativos: tecnicosTotal - tecnicosAtivos,
    cadastros7d,
    cadastros30d,
    cadastrosNoPeriodo,
    orcamentosTotal: porStatus.reduce((acc, s) => acc + s._count._all, 0),
    rascunhos: byStatus("DRAFT"),
    enviados,
    vistos,
    aprovados,
    recusados: byStatus("REJECTED"),
    expirados: byStatus("EXPIRED"),
    receitaAprovadaCents,
    ticketMedioCents: aprovados > 0 ? Math.round(receitaAprovadaCents / aprovados) : 0,
    tecnicosSemEnvio,
  };
}

export type VisitsBySource = { src: string | null; aberturas: number };

// Aberturas do link público (QuoteVisit) por origem (?src=), da maior para a menor. `range` filtra por abertura.
export async function getVisitsBySource(range?: DateRange): Promise<VisitsBySource[]> {
  const createdAt = dateRangeWhere(range);
  const rows = await db.quoteVisit.groupBy({
    by: ["src"],
    where: createdAt ? { createdAt } : {},
    _count: { _all: true },
    orderBy: { _count: { src: "desc" } },
  });
  return rows.map((r) => ({ src: r.src, aberturas: r._count._all }));
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  totalOrcamentos: number;
  enviados: number;
  aprovados: number;
  receitaAprovadaCents: number;
  ultimoOrcamentoEm: Date | null;
};

// Lista para /admin/usuarios, com busca por nome/e-mail/empresa. Contagens via groupBy (evita N+1).
// `range` filtra os orçamentos contados (totalOrcamentos/enviados/aprovados/receita) por
// Quote.createdAt; sem range, são os totais de sempre. `sort` rankeia por esses números
// ("orcamentos" = mais orçamentos feitos, "aprovados" = mais fechados); sem sort, por cadastro.
export async function listAdminUsers(
  query?: string,
  range?: DateRange,
  sort?: "orcamentos" | "aprovados",
): Promise<AdminUserRow[]> {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { companyName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const createdAt = dateRangeWhere(range);
  const quoteWhere: Prisma.QuoteWhereInput = createdAt ? { createdAt } : {};

  const [users, statusCounts, enviadosByUser, lastQuotes] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        isActive: true,
        isAdmin: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    db.quote.groupBy({ by: ["userId", "status"], where: quoteWhere, _count: { _all: true }, _sum: { totalCents: true } }),
    db.quote.groupBy({ by: ["userId"], where: { ...quoteWhere, sentAt: { not: null } }, _count: { _all: true } }),
    db.quote.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);

  const totalByUser = new Map<string, number>();
  const approvedByUser = new Map<string, number>();
  const revenueByUser = new Map<string, number>();
  for (const row of statusCounts) {
    totalByUser.set(row.userId, (totalByUser.get(row.userId) ?? 0) + row._count._all);
    if (row.status === "APPROVED") {
      approvedByUser.set(row.userId, row._count._all);
      revenueByUser.set(row.userId, row._sum.totalCents ?? 0);
    }
  }
  const sentByUser = new Map(enviadosByUser.map((r) => [r.userId, r._count._all]));
  const lastByUser = new Map(lastQuotes.map((r) => [r.userId, r._max.createdAt]));

  const rows = users.map((u) => ({
    ...u,
    totalOrcamentos: totalByUser.get(u.id) ?? 0,
    enviados: sentByUser.get(u.id) ?? 0,
    aprovados: approvedByUser.get(u.id) ?? 0,
    receitaAprovadaCents: revenueByUser.get(u.id) ?? 0,
    ultimoOrcamentoEm: lastByUser.get(u.id) ?? null,
  }));

  if (sort === "orcamentos") return rows.sort((a, b) => b.totalOrcamentos - a.totalOrcamentos);
  if (sort === "aprovados") return rows.sort((a, b) => b.aprovados - a.aprovados);
  return rows;
}

export type AdminUserStats = {
  total: number;
  rascunhos: number;
  enviados: number;
  vistos: number;
  aprovados: number;
  recusados: number;
  expirados: number;
  receitaAprovadaCents: number;
};

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  stats: AdminUserStats;
  quotes: { id: string; number: number; customerName: string; status: QuoteStatus; totalCents: number; createdAt: Date }[];
};

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const [user, porStatus, enviados, vistos, receitaAprovada] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        isActive: true,
        isAdmin: true,
        deactivatedAt: true,
        createdAt: true,
        lastLoginAt: true,
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, number: true, customerName: true, status: true, totalCents: true, createdAt: true },
        },
      },
    }),
    db.quote.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    db.quote.count({ where: { userId, sentAt: { not: null } } }),
    db.quote.count({ where: { userId, sentAt: { not: null }, viewedAt: { not: null } } }),
    db.quote.aggregate({ where: { userId, status: "APPROVED" }, _sum: { totalCents: true } }),
  ]);
  if (!user) return null;

  const byStatus = (status: QuoteStatus) => porStatus.find((s) => s.status === status)?._count._all ?? 0;

  return {
    ...user,
    stats: {
      total: porStatus.reduce((acc, s) => acc + s._count._all, 0),
      rascunhos: byStatus("DRAFT"),
      enviados,
      vistos,
      aprovados: byStatus("APPROVED"),
      recusados: byStatus("REJECTED"),
      expirados: byStatus("EXPIRED"),
      receitaAprovadaCents: receitaAprovada._sum.totalCents ?? 0,
    },
  };
}
