"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/usuarios", label: "Técnicos" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do admin" className="flex gap-1 border-b border-border">
      {ITEMS.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center border-b-2 px-3 text-sm font-semibold",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
