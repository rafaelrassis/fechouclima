"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { registrarLead } from "@/actions/leads";
import { LEAD_ORIGENS } from "@/lib/validations/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ORIGEM_LABEL: Record<(typeof LEAD_ORIGENS)[number], string> = {
  gmaps: "Google Maps",
  instagram: "Instagram",
  grupo: "Grupo WhatsApp/Facebook",
  indicacao: "Indicação",
  outro: "Outro",
};

export function LeadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarLead({
        nome: String(fd.get("nome") ?? ""),
        telefone: String(fd.get("telefone") ?? ""),
        cidade: String(fd.get("cidade") ?? "") || undefined,
        origem: String(fd.get("origem") ?? "gmaps") as (typeof LEAD_ORIGENS)[number],
        notas: String(fd.get("notas") ?? "") || undefined,
      });
      if (res.ok) {
        setErrors({});
        formRef.current?.reset();
        toast.success("Lead adicionado");
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="lead-nome">Nome ou empresa</Label>
        <Input id="lead-nome" name="nome" required maxLength={120} className="h-12 text-base" autoComplete="off" />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome[0]}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-telefone">WhatsApp (com DDD)</Label>
        <Input
          id="lead-telefone"
          name="telefone"
          type="tel"
          inputMode="tel"
          required
          placeholder="(11) 91234-5678"
          className="h-12 text-base"
          autoComplete="off"
        />
        {errors.telefone && <p className="text-xs text-destructive">{errors.telefone[0]}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="lead-cidade">Cidade</Label>
          <Input id="lead-cidade" name="cidade" maxLength={80} className="h-12 text-base" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-origem">Origem</Label>
          <select
            id="lead-origem"
            name="origem"
            defaultValue="gmaps"
            className="h-12 w-full rounded-md border border-input bg-transparent px-2 text-base"
          >
            {LEAD_ORIGENS.map((o) => (
              <option key={o} value={o}>
                {ORIGEM_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-notas">Notas (opcional)</Label>
        <Input id="lead-notas" name="notas" maxLength={500} className="h-12 text-base" autoComplete="off" />
      </div>
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? "Salvando..." : "Adicionar lead"}
      </Button>
    </form>
  );
}
