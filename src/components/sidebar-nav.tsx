"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Settings, Snowflake, Users, Wrench } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

const ITEMS = [
  { href: "/inicio", label: "Início", Icon: Home },
  { href: "/orcamentos", label: "Orçamentos", Icon: FileText },
  { href: "/clientes", label: "Clientes", Icon: Users },
  { href: "/servicos", label: "Serviços", Icon: Wrench },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
] as const;

export function SidebarNav({ userName, isAdmin }: { userName: string; isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 bg-primary-dark p-4 text-white lg:flex">
      <Link href="/inicio" className="flex min-h-11 items-center gap-2.5 px-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
          <Snowflake className="size-6" strokeWidth={2.2} />
        </span>
        <span className="text-[19px] font-extrabold tracking-tight">FechouClima</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold",
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-5" strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-white/10 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold">
          {getInitials(userName)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold">{userName}</span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin" className="text-xs font-semibold text-white/70 hover:text-white">
                Admin
              </Link>
            )}
            <LogoutButton className="h-auto min-h-0 p-0 text-xs font-medium text-white/70 hover:bg-transparent hover:text-white" />
          </div>
        </div>
      </div>
    </aside>
  );
}
