"use client";

import { useEffect } from "react";
import { marcarVideoVisto } from "@/actions/leads";

// Registra a abertura da página do vídeo (só com a aba visível; prévias/robôs não executam JS).
export function LeadVideoBeacon({ leadId }: { leadId: string }) {
  useEffect(() => {
    if (document.visibilityState === "visible") void marcarVideoVisto(leadId);
  }, [leadId]);
  return null;
}
