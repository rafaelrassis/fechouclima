import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { AppBadgeReset } from "@/components/app-badge-reset";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // mesma checagem de sessionsValidAfter do requireUserId: sessão antiga depois de redefinir a senha
  // ou "Sair de todos os aparelhos" não deve renderizar a página, mesmo com o cookie ainda válido.
  // Redireciona para uma rota que limpa o cookie (signOut de verdade): só um redirect("/login") não
  // basta, porque o middleware (sem banco) ainda veria esse cookie como logado e mandaria de volta.
  const userId = await getUserId();
  if (!userId) redirect("/api/auth/sessao-revogada");
  const isAdmin = (await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }))?.isAdmin ?? false;

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <AppBadgeReset />
      <SidebarNav userName={session.user.name ?? "Técnico"} isAdmin={isAdmin} />
      <div className="flex min-h-dvh flex-1 flex-col lg:min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-card lg:hidden">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
            <Link href="/inicio" className="inline-flex min-h-11 items-center font-extrabold tracking-tight">
              FechouClima
            </Link>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link href="/admin" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary">
                  Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 lg:max-w-6xl lg:px-10 lg:py-8">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
