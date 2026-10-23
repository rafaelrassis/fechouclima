import { normalizeBrPhone } from "@/lib/whatsapp";

export type ParsedLead = { nome: string; telefone: string; cidade?: string };

export type ParseResult = {
  leads: ParsedLead[];
  fixos: number; // telefone fixo: não recebe WhatsApp
  invalidos: number; // sem telefone reconhecível ou sem nome
  repetidos: number; // duplicados dentro da própria lista
};

// Celular BR: DDD (2) + 9 + 8 dígitos, com ou sem 55.
export function isCelularBr(raw: string): boolean {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length === 11 && d[2] === "9";
}

const PHONE_RE = /(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*9?[\s.-]*\d{4}[\s.-]*\d{4}/;

// Aceita uma linha por lead: "Nome;telefone;cidade", "Nome,telefone", tab (colado de planilha)
// ou "Nome (11) 91234-5678". O telefone é achado pela forma, não pela posição.
export function parseLeadLines(texto: string, cidadePadrao?: string): ParseResult {
  const leads: ParsedLead[] = [];
  const vistos = new Set<string>();
  let fixos = 0;
  let invalidos = 0;
  let repetidos = 0;

  for (const linha of texto.split(/\r?\n/)) {
    const bruta = linha.trim();
    if (!bruta) continue;

    const m = PHONE_RE.exec(bruta);
    if (!m) {
      invalidos++;
      continue;
    }

    if (!isCelularBr(m[0])) {
      fixos++;
      continue;
    }

    const resto = (bruta.slice(0, m.index) + " " + bruta.slice(m.index + m[0].length))
      .split(/[;\t,|]/)
      .map((p) => p.replace(/[()"]/g, "").trim())
      .filter(Boolean);
    const nome = resto[0]?.slice(0, 120);
    if (!nome || nome.length < 2) {
      invalidos++;
      continue;
    }

    const telefone = normalizeBrPhone(m[0]);
    if (vistos.has(telefone)) {
      repetidos++;
      continue;
    }
    vistos.add(telefone);
    leads.push({ nome, telefone, cidade: (resto[1] || cidadePadrao || undefined)?.slice(0, 80) });
  }

  return { leads, fixos, invalidos, repetidos };
}
