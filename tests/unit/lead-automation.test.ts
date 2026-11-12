import { describe, expect, it } from "vitest";
import { deveRodarAgora, diasSemanaDaAutomacao } from "@/lib/lead-automation";
import { diaSemanaSP, horaSP } from "@/lib/lead-limits";

describe("agendamento da busca automática", () => {
  it("parseia o CSV de dias da semana, ignorando lixo", () => {
    expect(diasSemanaDaAutomacao("0,1,2,3,4,5,6")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(diasSemanaDaAutomacao("1,3,5")).toEqual([1, 3, 5]);
    expect(diasSemanaDaAutomacao("1, , 9, abc")).toEqual([1]);
  });

  it("só roda no dia da semana e na hora configurados (horário de SP)", () => {
    const agora = new Date("2026-11-12T09:00:00-03:00"); // quinta, 9h em SP
    expect(diaSemanaSP(agora)).toBe(4);
    expect(horaSP(agora)).toBe(9);

    expect(deveRodarAgora({ diasSemana: "4", hora: 9 }, agora)).toBe(true);
    expect(deveRodarAgora({ diasSemana: "1,2,3", hora: 9 }, agora)).toBe(false); // dia errado
    expect(deveRodarAgora({ diasSemana: "4", hora: 10 }, agora)).toBe(false); // hora errada
  });
});
