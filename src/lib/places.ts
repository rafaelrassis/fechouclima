import { isCelularBr } from "@/lib/lead-import";
import { normalizeBrPhone } from "@/lib/whatsapp";
import type { ParsedLead } from "@/lib/lead-import";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const MAX_PAGES = 3; // 20 por página = até 60 resultados por busca (limite da API)

type PlacesResponse = {
  places?: { displayName?: { text?: string }; nationalPhoneNumber?: string; internationalPhoneNumber?: string }[];
  nextPageToken?: string;
};

export class PlacesConfigError extends Error {}

// API oficial (Places API New, Text Search). Pede só os campos necessários (FieldMask) para
// não pagar SKU maior que o preciso. Chave só no servidor: GOOGLE_PLACES_API_KEY.
export async function buscarNegociosNoMapa(cidade: string, termo: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesConfigError("Configure GOOGLE_PLACES_API_KEY no ambiente.");

  const encontrados: ParsedLead[] = [];
  let fixos = 0;
  let semTelefone = 0;
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: `${termo} em ${cidade}`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Google Places respondeu ${res.status}`);

    const data = (await res.json()) as PlacesResponse;
    for (const p of data.places ?? []) {
      const fone = p.internationalPhoneNumber ?? p.nationalPhoneNumber;
      const nome = p.displayName?.text?.trim();
      if (!fone || !nome) {
        semTelefone++;
        continue;
      }
      if (!isCelularBr(fone)) {
        fixos++;
        continue;
      }
      encontrados.push({ nome: nome.slice(0, 120), telefone: normalizeBrPhone(fone), cidade: cidade.slice(0, 80) });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  const unicos = [...new Map(encontrados.map((l) => [l.telefone, l])).values()];
  return { leads: unicos, fixos, semTelefone };
}
