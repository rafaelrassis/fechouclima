import { describe, expect, it } from "vitest";
import { calcLineCents, formatBRL } from "@/lib/money";
import { buildWhatsAppUrl, normalizeBrPhone } from "@/lib/whatsapp";
import { DEFAULT_WA_TEMPLATE, renderWaTemplate } from "@/lib/wa-template";
import { createQuoteSchema } from "@/lib/validations/quote";
import { approvalWaTemplateSchema, waTemplateSchema } from "@/lib/validations/auth";
import { APPROVAL_PLACEHOLDERS, DEFAULT_APPROVAL_WA_TEMPLATE } from "@/lib/wa-template";

describe("money", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
  it("arredonda a linha em centavos inteiros", () => {
    expect(calcLineCents(1.5, 3333)).toBe(5000); // 4999.5 -> 5000
    expect(calcLineCents(0.33, 100)).toBe(33);
  });
});

describe("whatsapp", () => {
  it("normaliza telefone BR com DDI 55", () => {
    expect(normalizeBrPhone("(11) 99999-0000")).toBe("5511999990000");
    expect(normalizeBrPhone("+55 11 99999-0000")).toBe("5511999990000");
  });
  it("monta a URL com a mensagem codificada", () => {
    const url = buildWhatsAppUrl("11999990000", "Olá & tchau");
    expect(url).toBe("https://wa.me/5511999990000?text=Ol%C3%A1%20%26%20tchau");
  });
});

describe("template do WhatsApp", () => {
  const vars = { cliente: "Maria", valor: "R$ 10,00", link: "https://x/o/1", numero: 3, tecnico: "João" };
  it("substitui todas as ocorrências e mantém variáveis desconhecidas", () => {
    expect(renderWaTemplate("{cliente} {cliente} {nome} #{numero}", vars)).toBe("Maria Maria {nome} #3");
  });
  it("o modelo padrão contém o link", () => {
    expect(renderWaTemplate(DEFAULT_WA_TEMPLATE, vars)).toContain("https://x/o/1");
  });
  it("exige {link} no schema", () => {
    expect(waTemplateSchema.safeParse({ template: "Olá, segue o orçamento" }).success).toBe(false);
    expect(waTemplateSchema.safeParse({ template: "Olá, segue o orçamento {link}" }).success).toBe(true);
  });
});

describe("mensagem de WhatsApp pós-aprovação", () => {
  const vars = { cliente: "Maria", valor: "R$ 10,00", link: "", numero: 3, tecnico: "João" };
  it("o modelo padrão usa cliente, número e valor, sem exigir {link}", () => {
    const rendered = renderWaTemplate(DEFAULT_APPROVAL_WA_TEMPLATE, vars);
    expect(rendered).toContain("Maria");
    expect(rendered).toContain("#3");
    expect(rendered).toContain("R$ 10,00");
  });
  it("aceita mensagem curta sem {link}", () => {
    expect(approvalWaTemplateSchema.safeParse({ template: "Oi {cliente}, aprovado!" }).success).toBe(true);
  });
  it("rejeita mensagem muito curta", () => {
    expect(approvalWaTemplateSchema.safeParse({ template: "Oi" }).success).toBe(false);
  });
  it("placeholders conhecidos não incluem {link}", () => {
    expect(APPROVAL_PLACEHOLDERS).not.toContain("{link}");
  });
});

describe("createQuoteSchema", () => {
  const base = { customerName: "Maria", customerPhone: "(11) 99999-0000", items: [{ description: "Serviço", unitPriceCents: 100, quantity: 1 }] };
  it("limpa o telefone para dígitos", () => {
    const r = createQuoteSchema.parse(base);
    expect(r.customerPhone).toBe("11999990000");
  });
  it("rejeita telefone curto, quantidade <= 0 e item sem serviço nem preço", () => {
    expect(createQuoteSchema.safeParse({ ...base, customerPhone: "123" }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...base, items: [{ description: "Serviço", unitPriceCents: 1, quantity: 0 }] }).success).toBe(false);
    expect(createQuoteSchema.safeParse({ ...base, items: [{ quantity: 1 }] }).success).toBe(false);
  });
});
