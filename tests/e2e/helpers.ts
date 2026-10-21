import type { Page } from "@playwright/test";

let n = 0;

// Cadastra um técnico novo (login automático) e cai em /inicio
export async function registerTechnician(page: Page, label: string) {
  n += 1;
  // cada técnico de teste vem de um IP diferente: o cadastro tem rate limit por IP (15/hora)
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${n}` });
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(`Técnico ${label}`);
  await page.getByLabel("E-mail").fill(`${label}-${n}-${Date.now()}@fechouclima.com.br`.toLowerCase());
  await page.getByLabel("WhatsApp").fill("11999990000");
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/inicio$/);
}

import type { Browser } from "@playwright/test";
import { PrismaClient, type QuoteStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/climazap_test" },
  },
});

const DAY = 86_400_000;

// Técnico com um orçamento no status pedido; devolve ids e credenciais
export async function seedTechnician(label: string, status: QuoteStatus, extra: Record<string, unknown> = {}) {
  n += 1;
  const email = `${label}-${n}-${Date.now()}@fechouclima.com.br`.toLowerCase(); // login normaliza para minúsculas
  const user = await prisma.user.create({
    data: { name: `Técnico ${label}`, email, passwordHash: await bcrypt.hash("senha123", 10), quoteSeq: 1 },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, name: `Cliente ${label}`, phone: "11977776666", address: "Rua das Flores, 10" },
  });
  const quote = await prisma.quote.create({
    data: {
      userId: user.id,
      customerId: customer.id,
      number: 1,
      customerName: customer.name,
      customerPhone: customer.phone,
      status,
      totalCents: 30000,
      sentAt: status === "DRAFT" ? null : new Date(Date.now() - DAY),
      validUntil: new Date(Date.now() + 7 * DAY),
      items: { create: [{ description: "Instalação de split", unit: "un", quantity: 1, unitPriceCents: 30000, totalCents: 30000 }] },
      ...extra,
    },
  });
  return { email, userId: user.id, customerId: customer.id, quoteId: quote.id, publicId: quote.publicId, customerName: customer.name };
}

// IP único por chamada: evita que visitas anônimas a /o/[publicId] caiam todas no mesmo bucket
// "unknown" do rate limit público (o beacon de "visto" conta nele, assim como aprovar/recusar).
export function uniqueIp() {
  n += 1;
  return `198.51.101.${n}`;
}

// Contexto de cliente anônimo (sem login) para abrir /o/[publicId], já com IP próprio.
export async function newClientContext(browser: Browser, options?: Parameters<Browser["newContext"]>[0]) {
  const ctx = await browser.newContext(options);
  await ctx.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  return ctx;
}

export async function login(page: Page, email: string) {
  n += 1;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${n}` });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/inicio$/);
}
