"use client";

import { useEffect } from "react";
import { markQuoteViewed } from "@/actions/quotes";

// Registra a abertura do link pelo cliente. A página pública tem cache (revalidate = 300),
// então o registro não pode acontecer no render do servidor (nem ler searchParams lá, que
// tornaria a rota dinâmica): a origem (?src=) é lida aqui no cliente. Só roda com a aba visível
// (prévias/robôs do WhatsApp não executam JS, por isso não contam).
export function ViewBeacon({ publicId }: { publicId: string }) {
  useEffect(() => {
    if (document.visibilityState === "visible") {
      const src = new URLSearchParams(window.location.search).get("src") ?? undefined;
      void markQuoteViewed(publicId, src);
    }
  }, [publicId]);

  return null;
}
