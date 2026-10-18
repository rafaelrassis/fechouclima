"use server";

import { revalidatePath } from "next/cache";
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
