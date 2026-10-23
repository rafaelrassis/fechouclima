// Limites de prospecção. Brasil não tem horário de verão desde 2019, então o dia de São Paulo é UTC-3 fixo.
export function dataSP(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
}

export function inicioDoDiaSP(d: Date = new Date()): Date {
  return new Date(`${dataSP(d)}T00:00:00-03:00`);
}

// Quantos "Abrir WhatsApp" por dia (padrão 30: volume baixo reduz risco de denúncia/banimento do número).
export function limiteContatosDia(): number {
  const n = Number(process.env.LEADS_DAILY_CONTACT_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}
