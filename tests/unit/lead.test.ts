import { describe, expect, it } from "vitest";
import { leadMessage, leadWhatsAppUrl } from "@/lib/lead-message";
import { registrarLeadSchema } from "@/lib/validations/lead";

describe("lead", () => {
  it("monta mensagem com primeiro nome, cidade e saída de descadastro", () => {
    const msg = leadMessage("João da Silva Refrigeração", "Campinas");
    expect(msg).toContain("Oi João,");
    expect(msg).toContain("em Campinas");
    expect(msg).toContain("não te chamo mais");
  });

  it("gera link wa.me com 55 e texto codificado", () => {
    const url = leadWhatsAppUrl({ nome: "Ana", telefone: "11912345678" });
    expect(url.startsWith("https://wa.me/5511912345678?text=")).toBe(true);
  });

  it("valida e normaliza telefone", () => {
    const ok = registrarLeadSchema.safeParse({ nome: "Ana", telefone: "(11) 91234-5678", origem: "gmaps" });
    expect(ok.success && ok.data.telefone).toBe("11912345678");
    expect(registrarLeadSchema.safeParse({ nome: "Ana", telefone: "123", origem: "gmaps" }).success).toBe(false);
    expect(registrarLeadSchema.safeParse({ nome: "Ana", telefone: "11912345678", origem: "spam" }).success).toBe(false);
  });
});
