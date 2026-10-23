"use client";

import { useTransition } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { atualizarStatusLead, excluirLead, marcarContatado } from "@/actions/leads";
import { LEAD_STATUSES } from "@/lib/validations/lead";

export function LeadActions({ id, status, waUrl }: { id: string; status: string; waUrl: string }) {
  const [pending, startTransition] = useTransition();

  function onStatus(next: string) {
    startTransition(async () => {
      const res = await atualizarStatusLead(id, next);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onDelete() {
    if (!window.confirm("Excluir este lead?")) return;
    startTransition(async () => {
      const res = await excluirLead(id);
      if (res.ok) toast.success("Lead excluído");
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          // dispara em paralelo: o link abre na hora, o status avança sem bloquear
          void marcarContatado(id);
        }}
        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-success px-3 text-sm font-semibold text-white"
      >
        <MessageCircle className="size-4" />
        Abrir WhatsApp
      </a>
      <select
        aria-label="Status do lead"
        value={status}
        disabled={pending}
        onChange={(e) => onStatus(e.target.value)}
        className="h-11 rounded-md border border-input bg-transparent px-2 text-base"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Excluir lead"
        onClick={onDelete}
        disabled={pending}
        className="flex size-11 items-center justify-center rounded-md text-muted-foreground"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
