// Service worker só para notificações push. Não faz cache de páginas: o app é autenticado e
// precisa de dado fresco, e cache offline de rotas logadas seria fonte de bug.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FechouClima", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "FechouClima", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: data.tag || undefined,
      actions: Array.isArray(data.actions) ? data.actions : undefined,
      data: {
        url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/inicio",
        waUrl: typeof data.waUrl === "string" && data.waUrl.startsWith("https://wa.me/") ? data.waUrl : undefined,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.action === "whatsapp" && event.notification.data?.waUrl
      ? event.notification.data.waUrl
      : new URL(event.notification.data?.url || "/inicio", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
