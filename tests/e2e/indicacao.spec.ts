import { expect, test } from "@playwright/test";
import { prisma, registerTechnician, uniqueIp } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("técnico indica um colega: copia o link, o colega se cadastra por ele e o contador atualiza", async ({ page, browser }) => {
  await registerTechnician(page, "indic");

  await page.goto("/ajustes");
  await expect(page.getByText("Indique um colega")).toBeVisible();
  const link = (await page.locator("p").filter({ hasText: /\/cadastro\?ref=/ }).first().textContent())?.trim();
  expect(link, "link de indicação").toBeTruthy();
  await expect(page.getByText("colega criou conta")).toHaveCount(0); // ainda sem indicados

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await pageB.goto(link!);
  await pageB.getByLabel("Nome").fill("Colega Indicado");
  await pageB.getByLabel("E-mail").fill(`colega-${Date.now()}@fechouclima.com.br`);
  await pageB.getByLabel("WhatsApp").fill("11999990000");
  await pageB.getByLabel("Senha").fill("senha123");
  await pageB.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await pageB.getByRole("button", { name: "Criar conta" }).click();
  await pageB.waitForURL(/\/inicio$/);
  await ctxB.close();

  await page.goto("/ajustes");
  await expect(page.getByText("1 colega criou conta")).toBeVisible();
});
