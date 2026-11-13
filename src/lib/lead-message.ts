import { buildWhatsAppUrl } from "@/lib/whatsapp";

const SITE = "https://fechouclima.com.br";

type LeadMsgInput = { id: string; nome: string; cidade?: string | null };

// Variações da abordagem (rodízio determinístico por lead: o mesmo lead sempre recebe a mesma,
// então o texto exibido == o texto enviado == o `templateId` gravado). Todas: curtas, sem promessa
// exagerada e com saída fácil (LGPD/anti-spam). `{v}` = link do vídeo, `{p}` = primeiro nome.
export const LEAD_TEMPLATES: Record<string, (c: { p: string; local: string; v: string }) => string> = {
  A: ({ p, local, v }) =>
    `Oi ${p}! 👋 Sou o Rafael, do FechouClima. Criei um app grátis pra técnico de ar-condicionado${local} fazer orçamento no celular em 1 minuto e mandar pelo WhatsApp. Veja em 15s: ${v} Se não for do seu interesse, é só avisar que não te chamo mais 🙂`,
  B: ({ p, v }) =>
    `${p}, tudo bem? Fiz um vídeo rápido (15s) mostrando como o técnico manda orçamento pelo WhatsApp e o cliente aprova com 1 toque: ${v} Se não fizer sentido pra você, me avisa que eu não incomodo mais.`,
  C: ({ p, local, v }) =>
    `Oi ${p}, fala comigo? Estou testando um app de orçamento pra quem trabalha com ar-condicionado${local}. Dá uma olhada: ${v} Quer testar? Se preferir não receber mensagem, só me avisar 👍`,
  D: ({ p, v }) =>
    `Olá ${p}! Rafael aqui. Ajudo técnicos de ar-condicionado a fecharem mais serviço com orçamento profissional direto do celular. Mostrei tudo nesse vídeo curto: ${v} Se não quiser mais mensagens, é só dizer 🙂`,
};

const IDS = Object.keys(LEAD_TEMPLATES);

// hash simples e estável (djb2) do id do lead -> índice do template
export function leadTemplateId(leadId: string): string {
  let h = 5381;
  for (let i = 0; i < leadId.length; i++) h = ((h << 5) + h + leadId.charCodeAt(i)) >>> 0;
  return IDS[h % IDS.length]!;
}

export function leadVideoUrl(leadId: string): string {
  return `${SITE}/v/${leadId}`;
}

export function leadMessage(lead: LeadMsgInput): string {
  const p = lead.nome.trim().split(/\s+/)[0] ?? "";
  const local = lead.cidade ? ` em ${lead.cidade}` : "";
  return LEAD_TEMPLATES[leadTemplateId(lead.id)]!({ p, local, v: leadVideoUrl(lead.id) });
}

export function leadWhatsAppUrl(lead: LeadMsgInput & { telefone: string }): string {
  return buildWhatsAppUrl(lead.telefone, leadMessage(lead));
}

// Segundo contato (botão "Falar de novo"): muda o texto conforme o lead tenha ou não aberto o vídeo.
export function leadFollowUpMessage(lead: LeadMsgInput & { viu: boolean }): string {
  const p = lead.nome.trim().split(/\s+/)[0] ?? "";
  if (lead.viu) {
    return `Oi ${p}! Vi que você deu uma olhada no vídeo do FechouClima 🙂 Ficou alguma dúvida? Se quiser, eu configuro seu primeiro orçamento com você em 5 minutos. Se não for pra você, é só avisar que não te chamo mais.`;
  }
  return `Oi ${p}, tudo bem? Passando só pra ver se você conseguiu abrir o vídeo (15s): ${leadVideoUrl(lead.id)} Se não tiver interesse, é só me avisar que não te chamo mais 🙂`;
}

export function leadFollowUpWhatsAppUrl(lead: LeadMsgInput & { telefone: string; viu: boolean }): string {
  return buildWhatsAppUrl(lead.telefone, leadFollowUpMessage(lead));
}
