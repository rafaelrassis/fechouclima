import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

function presetHref(basePath: string, extraParams: Record<string, string | undefined>, days: number | null) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(extraParams)) if (v) params.set(k, v);
  if (days !== null) params.set("from", toISODate(new Date(Date.now() - days * DAY_MS)));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Filtro de período por ?from=&to= (datas YYYY-MM-DD), com atalhos de 7/30/90 dias e "tudo".
// `extraParams` preserva outros filtros da página (busca, ordenação) ao trocar o período.
export function DateRangeFilter({
  basePath,
  from,
  to,
  extraParams = {},
}: {
  basePath: string;
  from?: string;
  to?: string;
  extraParams?: Record<string, string | undefined>;
}) {
  const isAll = !from && !to;
  return (
    <div className="space-y-2">
      <form className="flex flex-wrap items-end gap-2">
        {Object.entries(extraParams).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="from">
            De
          </label>
          <Input id="from" type="date" name="from" defaultValue={from} className="h-10 w-36 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="to">
            Até
          </label>
          <Input id="to" type="date" name="to" defaultValue={to} className="h-10 w-36 text-sm" />
        </div>
        <Button type="submit" className="h-10">
          Filtrar
        </Button>
      </form>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <Link href={presetHref(basePath, extraParams, 7)} className="text-primary">
          7 dias
        </Link>
        <Link href={presetHref(basePath, extraParams, 30)} className="text-primary">
          30 dias
        </Link>
        <Link href={presetHref(basePath, extraParams, 90)} className="text-primary">
          90 dias
        </Link>
        <Link href={presetHref(basePath, extraParams, null)} className={cn("font-semibold", isAll ? "text-foreground" : "text-muted-foreground")}>
          Tudo
        </Link>
      </div>
    </div>
  );
}
