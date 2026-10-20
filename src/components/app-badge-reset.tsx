"use client";

import { useEffect } from "react";

type NavigatorWithBadge = Navigator & { clearAppBadge?: () => Promise<void> };

// Zera o badge do ícone (contagem de avisos não vistos) quando o técnico volta para o app.
// Nunca lança: Badging API e service worker podem não existir (ex.: iOS fora de um app instalado).
export function AppBadgeReset() {
  useEffect(() => {
    function clear() {
      if (document.visibilityState !== "visible") return;
      (navigator as NavigatorWithBadge).clearAppBadge?.().catch(() => {});
      navigator.serviceWorker?.getRegistration().then((reg) => reg?.active?.postMessage({ type: "clear-badge" }));
    }
    clear();
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  return null;
}
