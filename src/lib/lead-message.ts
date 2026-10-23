import { buildWhatsAppUrl } from "@/lib/whatsapp";

// Abordagem curta, sem promessa exagerada e com saída fácil (LGPD/anti-spam): quem responde "não" vira DESCARTADO.
export function leadMessage(nome: string, cidade?: string | null): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  const local = cidade ? ` em ${cidade}` : "";
  return (
    `Oi ${primeiro}, tudo bem? Sou o Rafael, do FechouClima. ` +
    `Criei um app grátis pra técnico de ar-condicionado${local} fazer orçamento no celular em 1 minuto ` +
    `e mandar pelo WhatsApp, com o cliente aprovando por um link. ` +
    `Posso te mostrar? Se não for do seu interesse, é só avisar que não te chamo mais.`
  );
}

export function leadWhatsAppUrl(lead: { nome: string; telefone: string; cidade?: string | null }): string {
  return buildWhatsAppUrl(lead.telefone, leadMessage(lead.nome, lead.cidade));
}
