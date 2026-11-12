"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { definirAtivaAutomacaoLeads, salvarConfigAutomacaoLeads } from "@/actions/lead-automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = { ativo: boolean; cidades: string; termo: string };

export function LeadAutomationForm({ ativo, cidades, termo }: Props) {
  const [pendingToggle, startToggle] = useTransition();
  const [pendingSave, startSave] = useTransition();

  function onToggle() {
    startToggle(async () => {
      const res = await definirAtivaAutomacaoLeads(!ativo);
      if (res.ok) toast.success(ativo ? "Busca automática pausada" : "Busca automática ativada");
      else toast.error(res.error);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await salvarConfigAutomacaoLeads({
        cidades: String(fd.get("cidades") ?? ""),
        termo: String(fd.get("termo") ?? ""),
      });
      if (res.ok) toast.success("Configuração salva");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Busca automática</h2>
          <p className="text-xs text-muted-foreground">Roda 1x/dia sozinha. Contatar continua manual (1 clique por lead).</p>
        </div>
        <Button
          type="button"
          onClick={onToggle}
          disabled={pendingToggle}
          className={cn("h-11 shrink-0", ativo ? "bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90")}
        >
          {pendingToggle ? "..." : ativo ? "Desligar" : "Ligar"}
        </Button>
      </div>
      <p className={cn("text-xs font-semibold", ativo ? "text-success" : "text-muted-foreground")}>
        Status: {ativo ? "ativa" : "pausada"}
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="auto-cidades">Cidades (uma por linha)</Label>
          <Textarea
            id="auto-cidades"
            name="cidades"
            rows={4}
            defaultValue={cidades}
            placeholder={"Campinas SP\nIndaiatuba SP\nValinhos SP"}
            className="min-h-24 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-termo">Termo de busca</Label>
          <Input id="auto-termo" name="termo" defaultValue={termo} required className="h-12 text-base" autoComplete="off" />
        </div>
        <Button type="submit" variant="outline" className="h-12 w-full" disabled={pendingSave}>
          {pendingSave ? "Salvando..." : "Salvar cidades e termo"}
        </Button>
      </form>
    </div>
  );
}
