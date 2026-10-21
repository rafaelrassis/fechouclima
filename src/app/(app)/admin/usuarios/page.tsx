import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { listAdminUsers } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Técnicos" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const users = await listAdminUsers(q?.trim() || undefined);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Técnicos ({users.length})</h1>

      <form className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome, e-mail ou empresa"
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" className="h-11">
          Buscar
        </Button>
      </form>

      {users.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum técnico encontrado.</p>}

      {users.map((u) => (
        <Link key={u.id} href={`/admin/usuarios/${u.id}`}>
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.name}
                  {u.isAdmin && <span className="ml-1.5 text-xs font-bold text-primary">ADMIN</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.companyName ?? u.email}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {u.totalOrcamentos} total · {u.enviados} enviado(s) · {u.aprovados} aprovado(s)
                </p>
                {u.aprovados > 0 && <p className="text-xs font-semibold text-success">{formatBRL(u.receitaAprovadaCents)}</p>}
              </div>
              <span
                className={
                  u.isActive
                    ? "shrink-0 rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success"
                    : "shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive"
                }
              >
                {u.isActive ? "Ativo" : "Inativo"}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
