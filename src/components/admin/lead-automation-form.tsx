"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { definirAtivaAutomacaoLeads, salvarConfigAutomacaoLeads } from "@/actions/lead-automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = { ativo: boolean; cidades: string; termo: string; diasSemana: number[]; hora: number };

const DIAS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

export function LeadAutomationForm({ ativo, cidades, termo, diasSemana, hora }: Props) {
  const [pendingToggle, startToggle] = useTransition();
  const [pendingSave, startSave] = useTransition();
  const [dias, setDias] = useState<number[]>(diasSemana);

  function onToggle() {
    startToggle(async () => {
      const res = await definirAtivaAutomacaoLeads(!ativo);
      if (res.ok) toast.success(ativo ? "Busca automática pausada" : "Busca automática ativada");
      else toast.error(res.error);
    });
  }

  function toggleDia(v: number) {
    setDias((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (dias.length === 0) {
      toast.error("Selecione pelo menos um dia.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      const res = await salvarConfigAutomacaoLeads({
        cidades: String(fd.get("cidades") ?? ""),
        termo: String(fd.get("termo") ?? ""),
        diasSemana: dias,
        hora: Number(fd.get("hora") ?? 6),
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
          <p className="text-xs text-muted-foreground">Roda sozinha nos dias/horário abaixo. Contatar continua manual (1 clique por lead).</p>
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
          <Label>Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDia(d.v)}
                className={cn(
                  "flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold",
                  dias.includes(d.v) ? "border-primary bg-info-bg text-primary" : "border-input text-muted-foreground",
                )}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auto-hora">Horário (hora de SP)</Label>
          <select
            id="auto-hora"
            name="hora"
            defaultValue={hora}
            className="h-12 w-full rounded-md border border-input bg-transparent px-2 text-base"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
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
          {pendingSave ? "Salvando..." : "Salvar configuração"}
        </Button>
      </form>
    </div>
  );
}
