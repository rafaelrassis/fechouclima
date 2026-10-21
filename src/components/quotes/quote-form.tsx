"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Minus, Plus, Trash2 } from "lucide-react";
import { createQuote, sendQuoteViaWhatsApp, updateQuote } from "@/actions/quotes";
import { calcLineCents, formatBRL } from "@/lib/money";
import { maskPhone } from "@/lib/utils";
import type { CreateQuoteInput } from "@/lib/validations/quote";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  priceCents: number;
  userId: string | null;
};

export type QuoteFormInitial = {
  quoteId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  discountCents: number;
  validDays: number;
  items: { serviceId: string | null; description: string; unit: string; quantity: number; unitPriceCents: number }[];
};

type CustomerOption = { id: string; name: string; phone: string; address: string | null };

type Line = {
  key: string;
  serviceId: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPriceCents: number;
};

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const toNumber = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function QuoteForm({
  services,
  customers,
  initial,
  userId,
  prefill,
}: {
  services: ServiceOption[];
  customers: CustomerOption[];
  initial?: QuoteFormInitial;
  userId: string;
  prefill?: { name: string; phone: string; address: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const [customerName, setCustomerName] = useState(initial?.customerName ?? prefill?.name ?? "");
  const [phone, setPhone] = useState(initial ? maskPhone(initial.customerPhone) : prefill ? maskPhone(prefill.phone) : "");
  const [address, setAddress] = useState(initial?.customerAddress ?? prefill?.address ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    (initial?.items ?? []).map((i) => ({
      key: crypto.randomUUID(),
      serviceId: i.serviceId,
      description: i.description,
      unit: i.unit,
      quantity: String(i.quantity).replace(".", ","),
      unitPriceCents: i.unitPriceCents,
    })),
  );
  const [discountCents, setDiscountCents] = useState(initial?.discountCents ?? 0);
  const [validDays, setValidDays] = useState(String(initial?.validDays ?? 7));

  const [picked, setPicked] = useState(!!initial || !!prefill);

  // Rascunho local (só em orçamento novo): sobrevive a fechar a aba/perder sinal. Chave por usuário.
  const draftKey = `fc:draft:${userId}`;
  const hydrated = useRef(false);

  useEffect(() => {
    if (initial || prefill) return; // cliente pré-selecionado tem prioridade sobre o rascunho local
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as {
          savedAt: number;
          customerName: string;
          phone: string;
          address: string;
          lines: Line[];
          discountCents: number;
          validDays: string;
        };
        if (Date.now() - d.savedAt < DRAFT_TTL_MS && (d.customerName || d.lines?.length)) {
          setCustomerName(d.customerName ?? "");
          setPhone(d.phone ?? "");
          setAddress(d.address ?? "");
          setLines(Array.isArray(d.lines) ? d.lines : []);
          setDiscountCents(d.discountCents ?? 0);
          setValidDays(d.validDays ?? "7");
          setPicked(true);
          toast("Rascunho restaurado", {
            action: {
              label: "Descartar",
              onClick: () => {
                localStorage.removeItem(draftKey);
                setCustomerName("");
                setPhone("");
                setAddress("");
                setLines([]);
                setDiscountCents(0);
                setValidDays("7");
                setPicked(false);
              },
            },
          });
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {
      // localStorage indisponível ou JSON inválido: segue sem rascunho
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initial || !hydrated.current) return;
    const t = setTimeout(() => {
      try {
        if (!customerName && !phone && !address && lines.length === 0) {
          localStorage.removeItem(draftKey);
          return;
        }
        localStorage.setItem(
          draftKey,
          JSON.stringify({ savedAt: Date.now(), customerName, phone, address, lines, discountCents, validDays }),
        );
      } catch {
        // cota cheia ou bloqueado: ignora
      }
    }, 400);
    return () => clearTimeout(t);
  }, [initial, draftKey, customerName, phone, address, lines, discountCents, validDays]);
  const suggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (picked || q.length < 2) return [];
    const digits = q.replace(/\D/g, "");
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)))
      .slice(0, 5);
  }, [customers, customerName, picked]);

  function pickCustomer(c: CustomerOption) {
    setCustomerName(c.name);
    setPhone(maskPhone(c.phone));
    setAddress(c.address ?? "");
    setPicked(true);
  }

  const { subtotal, total } = useMemo(() => {
    const subtotal = lines.reduce(
      (acc, l) => acc + calcLineCents(round2(toNumber(l.quantity)), l.unitPriceCents),
      0,
    );
    return { subtotal, total: Math.max(subtotal - discountCents, 0) };
  }, [lines, discountCents]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const step = (l: Line, delta: number) =>
    updateLine(l.key, { quantity: String(Math.max(round2(toNumber(l.quantity) + delta), 1)).replace(".", ",") });

  const addService = (s: ServiceOption) => {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), serviceId: s.id, description: s.name, unit: s.unit, quantity: "1", unitPriceCents: s.priceCents },
    ]);
    setPickerOpen(false);
  };

  const addCustom = () => {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), serviceId: null, description: "", unit: "un", quantity: "1", unitPriceCents: 0 },
    ]);
    setPickerOpen(false);
  };

  function validate(): string | null {
    if (customerName.trim().length < 2) return "Informe o nome do cliente";
    if (phone.replace(/\D/g, "").length < 10) return "Telefone inválido";
    if (!lines.length) return "Adicione ao menos 1 serviço";
    for (const l of lines) {
      if (toNumber(l.quantity) <= 0) return "Quantidade inválida";
      if (l.description.trim().length < 2) return "Descreva o item avulso";
    }
    if (discountCents > subtotal) return "Desconto maior que o subtotal";
    return null;
  }

  function submit(sendNow: boolean) {
    const err = validate();
    if (err) return toast.error(err);

    const payload: CreateQuoteInput = {
      customerName: customerName.trim(),
      customerPhone: phone,
      customerAddress: address.trim() || undefined,
      discountCents,
      validDays: Number(validDays),
      items: lines.map((l) => ({
        serviceId: l.serviceId ?? undefined,
        description: l.description.trim(),
        unit: l.unit,
        quantity: toNumber(l.quantity),
        unitPriceCents: l.unitPriceCents,
      })),
    };

    startTransition(async () => {
      const res = initial
        ? await updateQuote(initial.quoteId, payload)
        : await createQuote(payload);
      if (!res.ok) {
        const first = Object.values(res.fieldErrors ?? {}).flat()[0];
        toast.error(first ?? res.error);
        return;
      }

      if (!initial) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignora
        }
        hydrated.current = false;
      }

      if (!sendNow) {
        toast.success(initial ? `Orçamento #${res.data.number} atualizado` : `Rascunho #${res.data.number} salvo`);
        router.push(initial ? `/orcamentos/${res.data.id}` : "/orcamentos");
        return;
      }

      const wa = await sendQuoteViaWhatsApp(res.data.id);
      if (!wa.ok) {
        toast.error(wa.error);
        router.push("/orcamentos");
        return;
      }
      // replace: o "voltar" do WhatsApp não reabre o form preenchido (evita duplicar)
      window.location.replace(wa.data.url);
    });
  }

  return (
    <div className="space-y-5 pb-44">
      {/* Cliente */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Cliente</h2>
        <Input
          aria-label="Nome do cliente"
          placeholder="Nome"
          autoComplete="off"
          className="h-12 text-base"
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setPicked(false);
          }}
        />
        {suggestions.length > 0 && (
          <ul className="divide-y rounded-md border bg-background">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-1 text-left"
                  onClick={() => pickCustomer(c)}
                >
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{maskPhone(c.phone)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Input
          aria-label="WhatsApp do cliente"
          placeholder="(11) 99999-9999"
          inputMode="tel"
          autoComplete="off"
          className="h-12 text-base"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
        />
        <Input
          aria-label="Endereço"
          placeholder="Endereço (opcional)"
          autoComplete="off"
          className="h-12 text-base"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </section>

      {/* Serviços */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Serviços</h2>

        {lines.map((l) => (
          <Card key={l.key}>
            <CardContent className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-2">
                {l.serviceId ? (
                  <p className="pt-2 text-sm font-medium leading-snug">{l.description}</p>
                ) : (
                  <Input
                    aria-label="Descrição do item"
                    placeholder="Descrição do item"
                    className="h-11 min-w-0 flex-1 text-base"
                    value={l.description}
                    onChange={(e) => updateLine(l.key, { description: e.target.value })}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Remover item"
                  onClick={() => removeLine(l.key)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Qtd ({l.unit})</Label>
                  <div className="flex h-11 items-center rounded-md border">
                    <button type="button" aria-label="Diminuir" className="grid size-11 shrink-0 place-items-center" onClick={() => step(l, -1)}>
                      <Minus className="size-4" />
                    </button>
                    <input
                      aria-label="Quantidade"
                      inputMode="decimal"
                      className="h-11 w-full min-w-0 bg-transparent text-center text-base outline-none"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: e.target.value.replace(/[^\d,.]/g, "") })}
                    />
                    <button type="button" aria-label="Aumentar" className="grid size-11 shrink-0 place-items-center" onClick={() => step(l, 1)}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preço unit.</Label>
                  <MoneyInput label="Preço unitário" value={l.unitPriceCents} onChange={(c) => updateLine(l.key, { unitPriceCents: c })} />
                </div>
              </div>

              <p className="text-right text-sm text-muted-foreground">
                Subtotal{" "}
                <span className="font-semibold text-foreground">
                  {formatBRL(calcLineCents(round2(toNumber(l.quantity)), l.unitPriceCents))}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" className="h-12 w-full border-dashed" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 size-4" /> Adicionar serviço
        </Button>
      </section>

      {/* Desconto e validade */}
      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desconto</Label>
          <MoneyInput label="Desconto" value={discountCents} onChange={setDiscountCents} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Validade</Label>
          <Select value={validDays} onValueChange={setValidDays}>
            <SelectTrigger aria-label="Validade do orçamento" className="h-11 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 7, 15, 30].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Barra fixa */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-muted-foreground">
              Total{discountCents > 0 ? ` (desc. ${formatBRL(discountCents)})` : ""}
            </span>
            <span className="text-xl font-bold">{formatBRL(total)}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
            <Button type="button" variant="outline" className="h-12 px-2 text-sm min-[360px]:text-base" disabled={pending} onClick={() => submit(false)}>
              Salvar rascunho
            </Button>
            <Button type="button" className="h-12 px-2 text-sm min-[360px]:text-base" disabled={pending} onClick={() => submit(true)}>
              <MessageCircle className="mr-2 size-4 max-[359px]:hidden" />
              {pending ? "Enviando..." : "Enviar no WhatsApp"}
            </Button>
          </div>
        </div>
      </div>

      {/* Seletor de serviços */}
      <Drawer open={pickerOpen} onOpenChange={setPickerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Escolha o serviço</DrawerTitle>
            <DrawerDescription>Você pode ajustar quantidade e preço depois.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[65dvh] space-y-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addService(s)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left active:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">{s.name}</span>
                  {s.description && <span className="block truncate text-xs text-muted-foreground">{s.description}</span>}
                </span>
                <span className="shrink-0 text-sm font-semibold">{formatBRL(s.priceCents)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={addCustom}
              className="w-full rounded-lg border border-dashed p-3 text-sm font-medium active:bg-muted"
            >
              + Item avulso
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
