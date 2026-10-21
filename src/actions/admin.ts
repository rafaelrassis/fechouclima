"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import type { ActionResult } from "@/types/action";

// Ativa/inativa a conta de um técnico. Inativar derruba sessões abertas (sessionsValidAfter)
// e bloqueia login novo (checado em src/auth.ts); não apaga nada, dá para reativar depois.
export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (userId === adminId && !isActive) {
    return { ok: false, error: "Você não pode inativar sua própria conta." };
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!target) return { ok: false, error: "Técnico não encontrado." };
  if (target.isAdmin && !isActive) {
    return { ok: false, error: "Não é possível inativar outra conta admin." };
  }

  await db.user.update({
    where: { id: userId },
    data: {
      isActive,
      deactivatedAt: isActive ? null : new Date(),
      ...(isActive ? {} : { sessionsValidAfter: new Date() }),
    },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: true, data: undefined };
}

// Apaga a conta do técnico e tudo que pertence a ele (orçamentos, clientes, serviços
// próprios, etc.) via cascade no banco. Irreversível: exige a senha do admin logado.
export async function deleteUserAccount(userId: string, adminPassword: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (userId === adminId) {
    return { ok: false, error: "Você não pode excluir sua própria conta por aqui." };
  }

  const admin = await db.user.findUnique({ where: { id: adminId }, select: { passwordHash: true } });
  if (!admin || !(await bcrypt.compare(adminPassword, admin.passwordHash))) {
    return { ok: false, error: "Senha incorreta." };
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!target) return { ok: false, error: "Técnico não encontrado." };
  if (target.isAdmin) {
    return { ok: false, error: "Não é possível excluir outra conta admin." };
  }

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin/usuarios");
  return { ok: true, data: undefined };
}
