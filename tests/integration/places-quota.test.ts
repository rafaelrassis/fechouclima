import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumirCotaPlaces, usoPlaces } from "@/lib/places-quota";
import { buscarNegociosNoMapa } from "@/lib/places";
import { resetDb } from "../helpers/db";

beforeEach(resetDb);

const ENV_KEYS = ["PLACES_DAILY_LIMIT", "PLACES_MONTHLY_LIMIT", "GOOGLE_PLACES_API_KEY"] as const;
const envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) envBackup[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (envBackup[k] === undefined) delete process.env[k];
    else process.env[k] = envBackup[k];
  }
  vi.unstubAllGlobals();
});

// Teto compartilhado por QUALQUER busca no mapa (manual em /admin/leads/importar e automática no
// cron): consumirCotaPlaces é o único ponto de checagem, chamado antes de cada requisição real ao
// Google. Nunca deixa passar do limite diário nem do mensal.
describe("cota do Google Places: nunca passa do limite", () => {
  it("consumirCotaPlaces libera até o limite diário e bloqueia depois, sem exceder", async () => {
    process.env.PLACES_DAILY_LIMIT = "3";
    process.env.PLACES_MONTHLY_LIMIT = "900";

    const resultados = [];
    for (let i = 0; i < 5; i++) resultados.push(await consumirCotaPlaces());
    expect(resultados).toEqual([true, true, true, false, false]);

    const { usadasHoje, limiteDia } = await usoPlaces();
    expect(limiteDia).toBe(3);
    expect(usadasHoje).toBeLessThanOrEqual(limiteDia);
  });

  it("o teto mensal também bloqueia, mesmo com saldo diário sobrando", async () => {
    process.env.PLACES_DAILY_LIMIT = "100";
    process.env.PLACES_MONTHLY_LIMIT = "2";

    expect(await consumirCotaPlaces()).toBe(true);
    expect(await consumirCotaPlaces()).toBe(true);
    expect(await consumirCotaPlaces()).toBe(false);
  });

  it("buscarNegociosNoMapa para de chamar o Google assim que a cota acaba (não excede)", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.PLACES_DAILY_LIMIT = "1";
    process.env.PLACES_MONTHLY_LIMIT = "900";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ places: [], nextPageToken: "sempre-tem-mais" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await buscarNegociosNoMapa("Campinas", "ar condicionado");

    expect(fetchMock).toHaveBeenCalledTimes(1); // limite diário é 1: nunca chega à 2ª página
    expect(r.cotaEsgotada).toBe(true);
  });
});
