"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetApprovalWaTemplate, saveApprovalWaTemplate } from "@/actions/settings";
import { APPROVAL_PLACEHOLDERS, DEFAULT_APPROVAL_WA_TEMPLATE, renderWaTemplate } from "@/lib/wa-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalWaTemplateForm({ initial, sender }: { initial: string; sender: string }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();

  const preview = renderWaTemplate(text, { cliente: "Maria", valor: "R$ 450,00", link: "", numero: 12, tecnico: sender });

  const unknown = Array.from(new Set(text.match(/\{[^{}\s]*\}/g) ?? [])).filter(
    (v) => !(APPROVAL_PLACEHOLDERS as readonly string[]).includes(v),
  );

  function save() {
    startTransition(async () => {
      const res = await saveApprovalWaTemplate(text);
      if (res.ok) toast.success("Mensagem de aprovação salva");
      else toast.error(res.error);
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetApprovalWaTemplate();
      if (res.ok) {
        setText(DEFAULT_APPROVAL_WA_TEMPLATE);
        toast.success("Voltou ao modelo padrão");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-bold">Mensagem pós-aprovação</h2>
      <div className="space-y-1">
        <Label htmlFor="approval-wa-text">Sugerida no botão &quot;Chamar no WhatsApp&quot; do aviso de aprovação</Label>
        <Textarea
          id="approval-wa-text"
          rows={4}
          maxLength={400}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">Variáveis: {APPROVAL_PLACEHOLDERS.join(" ")}.</p>
        <p className="text-xs text-muted-foreground">Quando o cliente recusa, a mensagem sugerida é sempre a padrão.</p>
      </div>

      {unknown.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Variável desconhecida: {unknown.join(" ")}. Ela iria literal para o cliente.
        </p>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Prévia</p>
          <p className="whitespace-pre-line text-sm">{preview}</p>
        </CardContent>
      </Card>

      <Button className="h-12 w-full text-base" onClick={save} disabled={pending || unknown.length > 0}>
        {pending ? "Salvando..." : "Salvar mensagem de aprovação"}
      </Button>
      <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={reset} disabled={pending}>
        Voltar ao padrão
      </Button>
    </div>
  );
}
