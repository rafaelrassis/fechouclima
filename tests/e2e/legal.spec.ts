import { expect, test } from "@playwright/test";
import { login, prisma, registerTechnician, seedTechnician, uniqueIp } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("termos e privacidade são públicos e linkados do login, cadastro e do orçamento", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await page.goto("/login");
  await page.getByRole("link", { name: "Privacidade" }).click();
  await expect(page.getByRole("heading", { name: "Política de Privacidade" })).toBeVisible();
  await expect(page.getByText(/LGPD/)).toBeVisible();

  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "Termos de Uso" })).toBeVisible();

  await page.goto("/cadastro");
  await expect(page.getByRole("link", { name: "Termos de uso" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Política de Privacidade" })).toBeVisible();

  const t = await seedTechnician("legal-pub", "SENT");
  await page.goto(`/o/${t.publicId}`);
  await expect(page.getByRole("link", { name: "Privacidade" })).toBeVisible();
});

test("cadastro exige o aceite dos termos", async ({ page }) => {
  await page.goto("/cadastro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Sem Aceite");
  await page.getByLabel("E-mail").fill(`sem-aceite-${Date.now()}@fechouclima.com.br`);
  await page.getByLabel("WhatsApp").fill("11999990000");
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/cadastro$/); // o navegador bloqueia o envio
  await expect(page.getByRole("checkbox", { name: /Li e aceito/ })).toBeFocused();
});

test("baixar meus dados e excluir a conta com confirmação de senha", async ({ page }) => {
  const t = await seedTechnician("lgpd", "APPROVED");
  await login(page, t.email);
  await page.goto("/ajustes");

  // exportação: arquivo JSON com os dados e sem hash de senha
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Baixar meus dados" }).click()]);
  expect(download.suggestedFilename()).toBe("fechouclima-meus-dados.json");
  const body = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
  expect(body).not.toContain("passwordHash");
  const data = JSON.parse(body);
  expect(data.email).toBe(t.email);
  expect(data.quotes).toHaveLength(1);

  // exclusão: senha errada não apaga; a certa apaga e leva ao login com aviso
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await page.getByLabel("Digite sua senha para confirmar").fill("senha-errada");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByText("Senha incorreta")).toBeVisible();
  expect(await prisma.user.count({ where: { id: t.userId } })).toBe(1);

  await page.getByLabel("Digite sua senha para confirmar").fill("senha123");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/login\?conta=excluida/);
  await expect(page.getByText("Sua conta e todos os seus dados foram excluídos.")).toBeVisible();

  expect(await prisma.user.count({ where: { id: t.userId } })).toBe(0);
  expect(await prisma.quote.count({ where: { userId: t.userId } })).toBe(0);
  expect(await prisma.customer.count({ where: { userId: t.userId } })).toBe(0);

  // o link público do orçamento apagado deixa de existir
  expect((await page.goto(`/o/${t.publicId}`))?.status()).toBe(404);

  // e a conta antiga não entra mais
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.210" });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(t.email);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
});

test("conta nova aceita os termos e cai no início", async ({ page }) => {
  await registerTechnician(page, "legal-new");
  await expect(page).toHaveURL(/\/inicio$/);
});
