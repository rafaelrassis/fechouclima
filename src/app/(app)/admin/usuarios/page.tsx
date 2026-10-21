import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listAdminUsers, parseDateRangeParams } from "@/lib/admin-queries";
import { formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { cn } from "@/lib/utils";

export const metadata = { title: "Técnicos" };

const DAY_MS = 24 * 60 * 60 * 1000;
const SORT_OPTIONS = [
  { value: undefined, label: "Recentes" },
  { value: "orcamentos", label: "Mais orçamentos" },
  { value: "aprovados", label: "Mais fechados" },
] as const;

function diasDesde(data: Date): number {
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / DAY_MS));
}

function sortHref(q: string | undefined, from: string | undefined, to: string | undefined, sort?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (sort) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/admin/usuarios?${qs}` : "/admin/usuarios";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; sort?: "orcamentos" | "aprovados" }>;
}) {
  await requireAdmin();
  const { q, from, to, sort } = await searchParams;
  const range = parseDateRangeParams({ from, to });
  const users = await listAdminUsers(q?.trim() || undefined, range, sort);
  const filtrado = !!(from || to);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Técnicos ({users.length})</h1>

      <DateRangeFilter basePath="/admin/usuarios" from={from} to={to} extraParams={{ q, sort }} />

      <form className="flex gap-2">
        {from && <input type="hidden" name="from" value={from} />}
        {to && <input type="hidden" name="to" value={to} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
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

      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => (
          <Link
            key={opt.label}
            href={sortHref(q, from, to, opt.value)}
            className={cn(
              "flex h-9 items-center rounded-full border px-3 text-xs font-semibold",
              sort === opt.value ? "border-primary bg-info-bg text-primary" : "border-input text-muted-foreground",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {users.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum técnico encontrado.</p>}

      {users.map((u, i) => (
        <Card key={u.id}>
          <CardContent className="flex items-center justify-between gap-3 p-3">
            <Link href={`/admin/usuarios/${u.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {sort && <span className="mr-1 text-muted-foreground">#{i + 1}</span>}
                {u.name}
                {u.isAdmin && <span className="ml-1.5 text-xs font-bold text-primary">ADMIN</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{u.companyName ?? u.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cadastrado há {diasDesde(u.createdAt)}d
                {!filtrado && u.enviados === 0 && <span className="ml-1.5 font-semibold text-warning">· nunca enviou orçamento</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {u.totalOrcamentos} {filtrado ? "no período" : "total"} · {u.enviados} enviado(s) · {u.aprovados} aprovado(s)
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
