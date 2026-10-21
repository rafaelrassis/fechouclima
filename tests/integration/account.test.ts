import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { deleteAccount, registerAction } from "@/actions/auth";
import { createQuote } from "@/actions/quotes";
import { logoutEverywhere, savePushSubscription, saveLogo } from "@/actions/settings";
import { GET as exportData } from "@/app/api/meus-dados/route";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

const signOut = vi.fn();
const signIn = vi.fn();
vi.mock("@/auth", () => ({ signIn: (...a: unknown[]) => signIn(...a), signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

beforeEach(async () => {
  await resetDb();
  signOut.mockReset();
  signIn.mockReset();
});

async function userWithData(email: string, password = "minhasenha") {
  const u = await db.user.create({ data: { name: "Téc", email, passwordHash: await bcrypt.hash(password, 4) } });
  loginAs(u.id);
  await createQuote(quoteInput({ customerName: `Cliente de ${email}` }) as never);
  await db.service.create({ data: { userId: u.id, name: "Serviço próprio", unit: "un", priceCents: 100 } });
  await savePushSubscription({
    endpoint: `https://push.example.com/${email}`,
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  });
  await db.passwordResetToken.create({ data: { userId: u.id, tokenHash: email.padEnd(64, "x"), expiresAt: new Date(Date.now() + 1000) } });
  return u;
}

describe("cadastro com consentimento", () => {
  it("exige aceite dos termos e grava a data do aceite", async () => {
    const base = { name: "Maria", email: "maria@t.com", password: "senha123", phone: "11999990000" };
    const refused = await registerAction(undefined, form(base));
    expect(refused?.fieldErrors?.accept?.[0]).toMatch(/Aceite os Termos/);
    expect(refused?.values).toEqual({ name: "Maria", email: "maria@t.com", phone: "11999990000", companyName: "" }); // não perde o que digitou
    expect(await db.user.count()).toBe(0);

    await registerAction(undefined, form({ ...base, accept: "on" }));
    const u = await db.user.findUniqueOrThrow({ where: { email: "maria@t.com" } });
    expect(u.termsAcceptedAt).not.toBeNull();
    expect(Math.abs(Date.now() - u.termsAcceptedAt!.getTime())).toBeLessThan(10_000);
  });

  it("e-mail duplicado (qualquer caixa) devolve erro de campo e mantém os valores", async () => {
    await registerAction(undefined, form({ name: "Ana", email: "dup@t.com", password: "senha123", phone: "11999990000", accept: "on" }));
    const again = await registerAction(undefined, form({ name: "Outra Pessoa", email: "DUP@t.com", password: "senha123", phone: "11999990000", accept: "on" }));
    expect(again?.fieldErrors?.email?.[0]).toBe("E-mail já cadastrado");
    expect(again?.values?.name).toBe("Outra Pessoa");
    expect(await db.user.count()).toBe(1);
  });

  it("valida nome curto, e-mail inválido e senha curta; rate limit por IP (15/hora)", async () => {
    const bad = await registerAction(undefined, form({ name: "A", email: "x", password: "123", phone: "11999990000", accept: "on" }));
    expect(Object.keys(bad?.fieldErrors ?? {}).sort()).toEqual(["email", "name", "password"]);

    let blocked = 0;
    for (let i = 0; i < 17; i++) {
      const r = await registerAction(undefined, form({ name: "Pessoa", email: `p${i}@t.com`, password: "senha123", phone: "11999990000", accept: "on" }));
      if (r?.error?.startsWith("Muitas tentativas")) blocked++;
    }
    expect(blocked).toBeGreaterThanOrEqual(2); // 1 tentativa inválida + 14 válidas gastam o limite de 15
    expect(await db.user.count()).toBeLessThanOrEqual(15);
  });
});

describe("exportar meus dados", () => {
  it("exige login", async () => {
    expect((await exportData()).status).toBe(401);
  });

  it("devolve só os dados do próprio técnico, sem hash de senha", async () => {
    const a = await userWithData("a@t.com");
    await userWithData("b@t.com");
    loginAs(a.id);
    const res = await exportData();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.text();
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("b@t.com");
    const data = JSON.parse(body);
    expect(data.email).toBe("a@t.com");
    expect(data.quotes).toHaveLength(1);
    expect(data.quotes[0].customerName).toBe("Cliente de a@t.com");
    expect(data.quotes[0].items).toHaveLength(1);
    expect(data.customers).toHaveLength(1);
    expect(data.services).toHaveLength(1);
  });
});

describe("excluir conta", () => {
  it("senha errada ou vazia: nada é apagado", async () => {
    const u = await userWithData("a@t.com");
    expect((await deleteAccount(undefined, form({ password: "errada" })))?.error).toBe("Senha incorreta");
    expect((await deleteAccount(undefined, form({ password: "" })))?.error).toBe("Senha incorreta");
    expect(await db.user.count({ where: { id: u.id } })).toBe(1);
    expect(await db.quote.count({ where: { userId: u.id } })).toBe(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("senha certa: apaga a conta e tudo dela, sem tocar nos dados de outro técnico", async () => {
    const a = await userWithData("a@t.com");
    const b = await userWithData("b@t.com");
    loginAs(a.id);
    await deleteAccount(undefined, form({ password: "minhasenha" }));

    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login?conta=excluida" });
    expect(await db.user.count({ where: { id: a.id } })).toBe(0);
    for (const table of ["quote", "customer", "service", "pushSubscription", "passwordResetToken"] as const) {
      expect(await (db[table] as unknown as { count: (a: unknown) => Promise<number> }).count({ where: { userId: a.id } }), table).toBe(0);
    }
    expect(await db.quoteItem.count()).toBe(1); // só os itens do B
    expect(await db.user.count({ where: { id: b.id } })).toBe(1);
    expect(await db.quote.count({ where: { userId: b.id } })).toBe(1);
  });

  it("rate limit de tentativas de senha (5/hora)", async () => {
    const u = await userWithData("a@t.com");
    loginAs(u.id);
    for (let i = 0; i < 5; i++) expect((await deleteAccount(undefined, form({ password: "x" })))?.error).toBe("Senha incorreta");
    expect((await deleteAccount(undefined, form({ password: "minhasenha" })))?.error).toMatch(/Muitas tentativas/);
    expect(await db.user.count({ where: { id: u.id } })).toBe(1);
  });

  it("logo some junto com a conta", async () => {
    const u = await userWithData("a@t.com");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const fd = new FormData();
    fd.set("logo", new File([new Uint8Array(png)], "l.png", { type: "image/png" }));
    expect((await saveLogo(fd)).ok).toBe(true);
    await deleteAccount(undefined, form({ password: "minhasenha" }));
    expect(await db.user.count({ where: { id: u.id } })).toBe(0);
  });
});

describe("sair de todos os aparelhos", () => {
  it("grava sessionsValidAfter e encerra a sessão atual", async () => {
    const u = await makeUser("a@t.com");
    loginAs(u.id);
    await logoutEverywhere();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).sessionsValidAfter).not.toBeNull();
  });

  it("sessão emitida antes passa a ser tratada como não logada", async () => {
    const u = await makeUser("a@t.com");
    const oldIssuedAt = Date.now();
    await new Promise((r) => setTimeout(r, 5)); // garante que sessionsValidAfter fique depois de oldIssuedAt
    loginAs(u.id, oldIssuedAt);
    await logoutEverywhere();

    loginAs(u.id, oldIssuedAt); // mesmo "aparelho" tentando de novo
    await expect(createQuote(quoteInput() as never)).rejects.toThrow("UNAUTHORIZED");
  });

  it("sem sessão, não grava nada", async () => {
    await expect(logoutEverywhere()).rejects.toThrow("UNAUTHORIZED");
    expect(signOut).not.toHaveBeenCalled();
  });
});
