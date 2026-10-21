import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { registerAction } from "@/actions/auth";
import { ensureReferralCode } from "@/actions/settings";
import { loginAs, makeUser, resetDb } from "../helpers/db";

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

describe("ensureReferralCode", () => {
  it("gera na 1ª vez e devolve o mesmo código depois (idempotente)", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const first = await ensureReferralCode();
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    expect(first.data.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const second = await ensureReferralCode();
    expect(second).toEqual(first);
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.referralCode).toBe(first.data.code);
  });

  it("técnicos diferentes recebem códigos diferentes", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const codeA = await ensureReferralCode();
    loginAs(b.id);
    const codeB = await ensureReferralCode();
    expect(codeA.ok && codeB.ok && codeA.data.code).not.toBe(codeB.ok && codeB.data.code);
  });
});

describe("cadastro com indicação", () => {
  it("ref válido e existente grava referredById", async () => {
    const dono = await makeUser("dono@t.com");
    loginAs(dono.id);
    const { data } = (await ensureReferralCode()) as { ok: true; data: { code: string } };
    loginAs(""); // cadastro é público

    await registerAction(undefined, form({ name: "Maria", email: "maria@t.com", password: "senha123", phone: "11999990000", accept: "on", ref: data.code }));
    const novo = await db.user.findUniqueOrThrow({ where: { email: "maria@t.com" } });
    expect(novo.referredById).toBe(dono.id);
  });

  it("ref em minúsculas também funciona (normaliza para maiúsculas)", async () => {
    const dono = await makeUser("dono@t.com");
    loginAs(dono.id);
    const { data } = (await ensureReferralCode()) as { ok: true; data: { code: string } };
    loginAs("");

    await registerAction(undefined, form({ name: "Maria", email: "maria2@t.com", password: "senha123", phone: "11999990000", accept: "on", ref: data.code.toLowerCase() }));
    const novo = await db.user.findUniqueOrThrow({ where: { email: "maria2@t.com" } });
    expect(novo.referredById).toBe(dono.id);
  });

  it("ref malformado ou de código inexistente cadastra normalmente, sem vínculo e sem erro", async () => {
    await registerAction(undefined, form({ name: "Sem Ref", email: "semref@t.com", password: "senha123", phone: "11999990000", accept: "on", ref: "x".repeat(6) }));
    const a = await db.user.findUniqueOrThrow({ where: { email: "semref@t.com" } });
    expect(a.referredById).toBeNull();

    await registerAction(undefined, form({ name: "Ref Curto", email: "refcurto@t.com", password: "senha123", phone: "11999990000", accept: "on", ref: "AB" }));
    const b = await db.user.findUniqueOrThrow({ where: { email: "refcurto@t.com" } });
    expect(b.referredById).toBeNull();

    await registerAction(undefined, form({ name: "Sem Campo", email: "semcampo@t.com", password: "senha123", phone: "11999990000", accept: "on" }));
    const c = await db.user.findUniqueOrThrow({ where: { email: "semcampo@t.com" } });
    expect(c.referredById).toBeNull();
  });

  it("excluir quem indicou não apaga o indicado (SetNull)", async () => {
    const dono = await makeUser("dono@t.com");
    loginAs(dono.id);
    const { data } = (await ensureReferralCode()) as { ok: true; data: { code: string } };
    loginAs("");
    await registerAction(undefined, form({ name: "Maria", email: "maria@t.com", password: "senha123", phone: "11999990000", accept: "on", ref: data.code }));
    const novo = await db.user.findUniqueOrThrow({ where: { email: "maria@t.com" } });

    await db.user.delete({ where: { id: dono.id } }); // SetNull: só testa a cascata, não o fluxo de deleteAccount
    expect(await db.user.count({ where: { id: dono.id } })).toBe(0);

    const aindaExiste = await db.user.findUniqueOrThrow({ where: { id: novo.id } });
    expect(aindaExiste.referredById).toBeNull();
  });
});
