import { describe, expect, it } from "vitest";
import { isCelularBr, parseLeadLines } from "@/lib/lead-import";

describe("importação de leads", () => {
  it("reconhece celular e ignora fixo", () => {
    expect(isCelularBr("(11) 91234-5678")).toBe(true);
    expect(isCelularBr("+55 19 99876-5432")).toBe(true);
    expect(isCelularBr("(11) 3123-4567")).toBe(false);
  });

  it("parseia formatos mistos, remove fixos, inválidos e repetidos", () => {
    const texto = [
      "João Refrigeração;(11) 91234-5678;Campinas",
      "Ana Clima, 19 99876-5432",
      "Loja Fixa\t(11) 3123-4567",
      "Duplicado (11) 91234-5678",
      "sem telefone aqui",
      "",
    ].join("\n");
    const r = parseLeadLines(texto, "Santos");
    expect(r.leads).toEqual([
      { nome: "João Refrigeração", telefone: "5511912345678", cidade: "Campinas" },
      { nome: "Ana Clima", telefone: "5519998765432", cidade: "Santos" },
    ]);
    expect(r.fixos).toBe(1);
    expect(r.repetidos).toBe(1);
    expect(r.invalidos).toBe(1);
  });
});
