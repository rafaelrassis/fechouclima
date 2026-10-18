import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getAdminUserDetail } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { StatusBadge } from "@/components/quotes/status-badge";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Técnico" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const user = await getAdminUserDetail(id);
  if (!user) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        {user.companyName && <p className="text-sm text-muted-foreground">{user.companyName}</p>}
        {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          Cadastrado em {user.createdAt.toLocaleDateString("pt-BR")}
          {user.isAdmin && " · conta admin"}
          {!user.isActive && user.deactivatedAt && ` · inativado em ${user.deactivatedAt.toLocaleDateString("pt-BR")}`}
        </p>
      </div>

      {!user.isAdmin && <ToggleActiveButton userId={user.id} isActive={user.isActive} />}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Últimos orçamentos</h2>
        {user.quotes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum orçamento ainda.</p>}
        {user.quotes.map((q) => (
          <Card key={q.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  #{q.number} · {q.customerName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{q.createdAt.toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">{formatBRL(q.totalCents)}</p>
                <StatusBadge status={q.status} className="mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
