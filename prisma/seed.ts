import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const INSTALACAO_TEXT =
  "Oi, {cliente}! Aqui é {tecnico}. Já faz um ano desde a instalação do seu ar-condicionado ({servico}). Que tal uma manutenção preventiva pra garantir que continue gelando direito?";
const LIMPEZA_TEXT =
  "Oi, {cliente}! Aqui é {tecnico}. Já faz 6 meses desde a última limpeza do seu ar-condicionado. Hora de higienizar de novo pra manter o ar saudável!";
const GAS_TEXT =
  "Oi, {cliente}! Aqui é {tecnico}. Já faz um ano desde a carga de gás do seu ar-condicionado ({servico}). Vale a pena checar a pressão e o funcionamento.";
const PREVENTIVA_TEXT =
  "Oi, {cliente}! Aqui é {tecnico}. Já faz 6 meses desde a última manutenção preventiva. Que tal agendar a próxima?";

const DEFAULT_SERVICES = [
  { name: "Instalação de Split até 12.000 BTUs", unit: "un", priceCents: 45000, description: "Instalação completa com até 3m de tubulação", reminderMonths: 12, reminderText: INSTALACAO_TEXT },
  { name: "Instalação de Split 18.000 a 24.000 BTUs", unit: "un", priceCents: 65000, description: "Instalação completa com até 3m de tubulação", reminderMonths: 12, reminderText: INSTALACAO_TEXT },
  { name: "Instalação de Split 30.000+ BTUs", unit: "un", priceCents: 90000, description: "Instalação completa com até 3m de tubulação", reminderMonths: 12, reminderText: INSTALACAO_TEXT },
  { name: "Metro adicional de tubulação", unit: "m", priceCents: 6500, description: "Cobre, isolamento e dreno", reminderMonths: null, reminderText: null },
  { name: "Limpeza/higienização de Split", unit: "un", priceCents: 18000, description: "Evaporadora e condensadora", reminderMonths: 6, reminderText: LIMPEZA_TEXT },
  { name: "Carga de gás R410A", unit: "un", priceCents: 25000, description: "Completa pressão e checa vazamentos", reminderMonths: 12, reminderText: GAS_TEXT },
  { name: "Carga de gás R32", unit: "un", priceCents: 28000, description: "Completa pressão e checa vazamentos", reminderMonths: 12, reminderText: GAS_TEXT },
  { name: "Manutenção preventiva", unit: "un", priceCents: 22000, description: "Limpeza, checagem elétrica e de pressão", reminderMonths: 6, reminderText: PREVENTIVA_TEXT },
  { name: "Visita técnica / diagnóstico", unit: "un", priceCents: 12000, description: "Abatida do valor se o serviço for aprovado", reminderMonths: null, reminderText: null },
];

async function main() {
  // Serviços padrão do sistema (userId null), idempotente por nome. Em produção o seed já rodou
  // antes: só atualiza reminderMonths/reminderText dos existentes, nunca preço/nome/descrição/unidade.
  for (const { reminderMonths, reminderText, ...rest } of DEFAULT_SERVICES) {
    const exists = await db.service.findFirst({ where: { userId: null, name: rest.name } });
    if (!exists) await db.service.create({ data: { ...rest, reminderMonths, reminderText, userId: null } });
    else await db.service.update({ where: { id: exists.id }, data: { reminderMonths, reminderText } });
  }

  // Usuário demo: nunca em produção (senha pública)
  if (process.env.NODE_ENV !== "production") {
    await db.user.upsert({
      where: { email: "demo@fechouclima.com.br" },
      update: {},
      create: {
        name: "Técnico Demo",
        email: "demo@fechouclima.com.br",
        passwordHash: await bcrypt.hash("demo1234", 10),
        phone: "11999999999",
        companyName: "Demo Climatização",
      },
    });
  }

  // Conta admin do painel /admin (único e-mail, por ora). Idempotente: só marca, não cria usuário.
  await db.user.updateMany({ where: { email: "rrodriguesdeassis@gmail.com" }, data: { isAdmin: true } });

  console.log("Seed concluído");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
