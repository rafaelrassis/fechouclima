"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription } from "@/actions/settings";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "install-pwa" | "denied" | "off" | "on";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos() && !isStandalone() ? "install-pwa" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          if (permission === "denied") toast.error("Permissão de notificação negada");
          else toast.error("Autorize a notificação para ativar os avisos");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
        const res = await savePushSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setState("on");
        toast.success("Avisos ativados neste aparelho");
      } catch {
        toast.error("Não foi possível ativar os avisos neste aparelho");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        toast.success("Avisos desativados neste aparelho");
      } catch {
        toast.error("Não foi possível desativar");
      }
    });
  }

  const hint: Record<State, string> = {
    loading: "Verificando...",
    unsupported: "Este navegador não permite avisos.",
    "install-pwa": 'No iPhone, toque em "Compartilhar" e depois em "Adicionar à Tela de Início" para ativar os avisos.',
    denied: "Você bloqueou as notificações. Libere nas configurações do navegador para ativar.",
    off: "Receba no celular quando um cliente aprovar ou recusar.",
    on: "Ativado neste aparelho.",
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Avisos no celular</p>
      <p className="text-xs text-muted-foreground">{hint[state]}</p>
      {(state === "off" || state === "on") && (
        <button
          type="button"
          onClick={state === "off" ? enable : disable}
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-md border text-sm font-medium disabled:opacity-50"
        >
          {state === "off" ? "Ativar avisos" : "Desativar avisos"}
        </button>
      )}
    </div>
  );
}
