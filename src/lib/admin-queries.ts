import type { QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminOverview = {
  tecnicosTotal: number;
  tecnicosAtivos: number;
  tecnicosInativos: number;
  cadastros7d: number;
  cadastros30d: number;
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
export async function getAdminOverview(now = new Date()): Promise<AdminOverview> {
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [
    tecnicosTotal,
    tecnicosAtivos,
    cadastros7d,
    cadastros30d,
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
    db.quote.groupBy({ by: ["status"], _count: { _all: true } }),
    db.quote.count({ where: { sentAt: { not: null } } }),
    db.quote.count({ where: { sentAt: { not: null }, viewedAt: { not: null } } }),
    db.quote.aggregate({ where: { status: "APPROVED" }, _sum: { totalCents: true }, _count: { _all: true } }),
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

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: Date;
  totalOrcamentos: number;
  enviados: number;
  aprovados: number;
  receitaAprovadaCents: number;
  ultimoOrcamentoEm: Date | null;
};

// Lista para /admin/usuarios, com busca por nome/e-mail/empresa. Contagens via groupBy (evita N+1).
export async function listAdminUsers(query?: string): Promise<AdminUserRow[]> {
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { companyName: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, statusCounts, enviadosByUser, lastQuotes] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true, companyName: true, isActive: true, isAdmin: true, createdAt: true },
    }),
    db.quote.groupBy({ by: ["userId", "status"], _count: { _all: true }, _sum: { totalCents: true } }),
    db.quote.groupBy({ by: ["userId"], where: { sentAt: { not: null } }, _count: { _all: true } }),
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

  return users.map((u) => ({
    ...u,
    totalOrcamentos: totalByUser.get(u.id) ?? 0,
    enviados: sentByUser.get(u.id) ?? 0,
    aprovados: approvedByUser.get(u.id) ?? 0,
    receitaAprovadaCents: revenueByUser.get(u.id) ?? 0,
    ultimoOrcamentoEm: lastByUser.get(u.id) ?? null,
  }));
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
