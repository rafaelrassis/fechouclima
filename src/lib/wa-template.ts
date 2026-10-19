export const WA_PLACEHOLDERS = ["{cliente}", "{valor}", "{link}", "{numero}", "{tecnico}"] as const;

export const WA_MODELS = [
  {
    id: "amigavel",
    label: "Amigável",
    text: "Olá, {cliente}! Tudo bem? Preparei o orçamento #{numero} no valor de {valor}. Dá uma olhada e, se estiver ok, é só aprovar com 1 toque: {link}\n\n{tecnico}",
  },
  {
    id: "formal",
    label: "Formal",
    text: "Prezado(a) {cliente}, segue o orçamento #{numero} de {tecnico}, no valor de {valor}.\n\nPara visualizar os detalhes e aprovar, acesse: {link}",
  },
  {
    id: "curto",
    label: "Curto",
    text: "{cliente}, orçamento #{numero}: {valor}.\nAprove aqui: {link}",
  },
] as const;

export const DEFAULT_WA_TEMPLATE = WA_MODELS[1].text;

// Mensagem sugerida no botão "Chamar no WhatsApp" do aviso de aprovação (editável em Ajustes).
// A de recusa é fixa: é um caso raro e mais delicado para deixar no automático.
export const APPROVAL_PLACEHOLDERS = ["{cliente}", "{numero}", "{valor}", "{tecnico}"] as const;
export const DEFAULT_APPROVAL_WA_TEMPLATE =
  "Olá, {cliente}! Show, recebi sua aprovação do orçamento #{numero} de {valor}. Vamos combinar a data do serviço?";

export function renderWaTemplate(
  template: string,
  vars: { cliente: string; valor: string; link: string; numero: number | string; tecnico: string },
): string {
  return template
    .split("{cliente}").join(vars.cliente)
    .split("{valor}").join(vars.valor)
    .split("{link}").join(vars.link)
    .split("{numero}").join(String(vars.numero))
    .split("{tecnico}").join(vars.tecnico);
}
