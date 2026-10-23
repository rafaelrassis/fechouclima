"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buscarLeadsNoMapa, importarLeads, type ImportSummary } from "@/actions/leads-import";
import { LEAD_ORIGENS } from "@/lib/validations/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Resumo({ r }: { r: ImportSummary }) {
  return (
    <p className="rounded-md bg-muted p-3 text-sm" role="status">
      <strong>{r.novos}</strong> novo(s) · {r.jaExistiam} já existiam · {r.jaSaoUsuarios} já são usuários · {r.fixos} fixo(s) ignorado(s) · {r.invalidos} sem telefone/inválido(s)
      {r.cotaEsgotada && <span className="mt-1 block font-semibold text-warning">Cota grátis do mês acabou no meio da busca: resultado parcial.</span>}
    </p>
  );
}

export function BuscarNoMapaForm() {
  const [resumo, setResumo] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await buscarLeadsNoMapa({
        cidade: String(fd.get("cidade") ?? ""),
        termo: String(fd.get("termo") ?? "") || undefined,
      });
      if (res.ok) {
        setResumo(res.data);
        toast.success(`${res.data.novos} lead(s) novo(s)`);
      } else {
        setResumo(null);
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border p-3">
      <h2 className="text-base font-semibold">Buscar no Google Maps</h2>
      <div className="space-y-1.5">
        <Label htmlFor="busca-cidade">Cidade</Label>
        <Input id="busca-cidade" name="cidade" required placeholder="Campinas SP" className="h-12 text-base" autoComplete="off" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="busca-termo">Termo</Label>
        <Input id="busca-termo" name="termo" defaultValue="ar condicionado instalação" className="h-12 text-base" autoComplete="off" />
      </div>
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? "Buscando..." : "Buscar e salvar celulares"}
      </Button>
      {resumo && <Resumo r={resumo} />}
    </form>
  );
}

export function ColarListaForm() {
  const [resumo, setResumo] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importarLeads({
        texto: String(fd.get("texto") ?? ""),
        origem: String(fd.get("origem") ?? "outro") as (typeof LEAD_ORIGENS)[number],
        cidade: String(fd.get("cidade") ?? "") || undefined,
      });
      if (res.ok) {
        setResumo(res.data);
        toast.success(`${res.data.novos} lead(s) novo(s)`);
      } else {
        setResumo(null);
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border p-3">
      <h2 className="text-base font-semibold">Colar lista</h2>
      <p className="text-xs text-muted-foreground">Uma linha por lead: nome e telefone (planilha, vírgula ou ponto e vírgula). Fixos são ignorados.</p>
      <Textarea
        name="texto"
        required
        rows={8}
        placeholder={"João Refrigeração;(11) 91234-5678\nAna Clima, 19 99876-5432"}
        className="min-h-40 text-base"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="lista-cidade">Cidade (padrão)</Label>
          <Input id="lista-cidade" name="cidade" maxLength={80} className="h-12 text-base" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lista-origem">Origem</Label>
          <select id="lista-origem" name="origem" defaultValue="gmaps" className="h-12 w-full rounded-md border border-input bg-transparent px-2 text-base">
            {LEAD_ORIGENS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? "Importando..." : "Importar lista"}
      </Button>
      {resumo && <Resumo r={resumo} />}
    </form>
  );
}
