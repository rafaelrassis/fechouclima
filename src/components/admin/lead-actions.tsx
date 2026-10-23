"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { atualizarStatusLead, marcarContatado } from "@/actions/leads";
import { LEAD_STATUSES } from "@/lib/validations/lead";

type Props = {
  id: string;
  status: string;
  waUrl: string;
  contatadoEm: string | null;
  limiteAtingido: boolean;
};

const BTN = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold";

export function LeadActions({ id, status, waUrl, contatadoEm, limiteAtingido }: Props) {
  const [pending, startTransition] = useTransition();
  const jaContatado = status !== "NOVO";

  function onStatus(next: string) {
    startTransition(async () => {
      const res = await atualizarStatusLead(id, next);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onClickWhatsApp(e: React.MouseEvent<HTMLAnchorElement>) {
    if (jaContatado) {
      const quando = contatadoEm
        ? ` em ${new Date(contatadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
        : "";
      if (!window.confirm(`Esse lead já foi contatado${quando}. Falar de novo?`)) {
        e.preventDefault();
        return;
      }
      return;
    }
    // o link abre na hora; o status avança em paralelo (e a tela recarrega o contador do dia)
    void marcarContatado(id);
  }

  let acao: React.ReactNode;
  if (status === "DESCARTADO") {
    acao = <span className={`${BTN} bg-muted text-muted-foreground`}>Não contatar</span>;
  } else if (status === "CLIENTE") {
    acao = <span className={`${BTN} bg-muted text-muted-foreground`}>Já é cliente</span>;
  } else if (limiteAtingido && !jaContatado) {
    acao = <span className={`${BTN} bg-muted text-muted-foreground`}>Limite de hoje atingido</span>;
  } else {
    acao = (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClickWhatsApp}
        className={`${BTN} ${jaContatado ? "border border-input text-foreground" : "bg-success text-white"}`}
      >
        <MessageCircle className="size-4" />
        {jaContatado ? "Falar de novo" : "Abrir WhatsApp"}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {acao}
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
    </div>
  );
}
