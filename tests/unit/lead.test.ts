import { describe, expect, it } from "vitest";
import { LEAD_TEMPLATES, leadMessage, leadTemplateId, leadVideoUrl, leadWhatsAppUrl } from "@/lib/lead-message";
import { registrarLeadSchema } from "@/lib/validations/lead";

describe("lead", () => {
  it("monta mensagem com primeiro nome, cidade e saída de descadastro", () => {
    const msg = leadMessage({ id: "cabc123def456ghi789jkl012", nome: "João da Silva Refrigeração", cidade: "Campinas" });
    expect(msg).toContain("João");
    expect(msg).toContain("fechouclima.com.br/v/cabc123def456ghi789jkl012");
  });

  it("toda variação traz saída de descadastro e o link do vídeo", () => {
    for (const fn of Object.values(LEAD_TEMPLATES)) {
      const msg = fn({ p: "Ana", local: "", v: "https://x/v/1" });
      expect(msg).toContain("https://x/v/1");
      expect(msg).toMatch(/não (te chamo|incomodo|quiser|receber)|avisar|avisa|dizer/i);
    }
  });

  it("template é estável por lead e o rodízio usa mais de uma variação", () => {
    expect(leadTemplateId("clead000000000000000000001")).toBe(leadTemplateId("clead000000000000000000001"));
    const ids = new Set(Array.from({ length: 50 }, (_, i) => leadTemplateId(`clead${String(i).padStart(20, "0")}`)));
    expect(ids.size).toBeGreaterThan(1);
    expect(leadVideoUrl("cx")).toBe("https://fechouclima.com.br/v/cx");
  });

  it("gera link wa.me com 55 e texto codificado", () => {
    const url = leadWhatsAppUrl({ id: "cabc123def456ghi789jkl012", nome: "Ana", telefone: "11912345678" });
    expect(url.startsWith("https://wa.me/5511912345678?text=")).toBe(true);
  });

  it("valida e normaliza telefone", () => {
    const ok = registrarLeadSchema.safeParse({ nome: "Ana", telefone: "(11) 91234-5678", origem: "gmaps" });
    expect(ok.success && ok.data.telefone).toBe("11912345678");
    expect(registrarLeadSchema.safeParse({ nome: "Ana", telefone: "123", origem: "gmaps" }).success).toBe(false);
    expect(registrarLeadSchema.safeParse({ nome: "Ana", telefone: "11912345678", origem: "spam" }).success).toBe(false);
  });
});
