import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listAdminUsers } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Técnicos" };

const DAY_MS = 24 * 60 * 60 * 1000;

function diasDesde(data: Date): number {
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / DAY_MS));
}

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
        <Card key={u.id}>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <Link href={`/admin/usuarios/${u.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {u.name}
                {u.isAdmin && <span className="ml-1.5 text-xs font-bold text-primary">ADMIN</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{u.companyName ?? u.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cadastrado há {diasDesde(u.createdAt)}d
                {u.enviados === 0 && <span className="ml-1.5 font-semibold text-warning">· nunca enviou orçamento</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {u.totalOrcamentos} total · {u.enviados} enviado(s) · {u.aprovados} aprovado(s)
              </p>
              {u.aprovados > 0 && <p className="text-xs font-semibold text-success">{formatBRL(u.receitaAprovadaCents)}</p>}
            </Link>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={
                  u.isActive
                    ? "rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success"
                    : "rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive"
                }
              >
                {u.isActive ? "Ativo" : "Inativo"}
              </span>
              {u.phone ? (
                <a
                  href={buildWhatsAppUrl(u.phone, `Oi ${u.name.split(" ")[0]}! Aqui é o time do FechouClima.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-1 text-xs font-semibold text-success"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">sem WhatsApp</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
