// Service worker só para notificações push. Não faz cache de páginas: o app é autenticado e
// precisa de dado fresco, e cache offline de rotas logadas seria fonte de bug.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Contagem do badge do ícone (Badging API): sobrevive a reinícios do service worker via IndexedDB,
// porque variáveis em memória não persistem entre eventos. Nunca lança: sem suporte (ex.: iOS fora
// de um app instalado), as chamadas abaixo são puladas.
const BADGE_DB = "fc-badge";
const BADGE_STORE = "kv";

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BADGE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(BADGE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBadgeCount() {
  try {
    const db = await openBadgeDb();
    return await new Promise((resolve) => {
      const req = db.transaction(BADGE_STORE, "readonly").objectStore(BADGE_STORE).get("count");
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function setBadgeCount(n) {
  try {
    const db = await openBadgeDb();
    await new Promise((resolve) => {
      const tx = db.transaction(BADGE_STORE, "readwrite");
      tx.objectStore(BADGE_STORE).put(n, "count");
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // sem IndexedDB: segue sem contar
  }
}

async function bumpBadge() {
  if (!self.navigator?.setAppBadge) return;
  const count = (await getBadgeCount()) + 1;
  await setBadgeCount(count);
  try {
    await self.navigator.setAppBadge(count);
  } catch {
    // sem suporte nesta plataforma
  }
}

async function clearBadge() {
  await setBadgeCount(0);
  if (!self.navigator?.clearAppBadge) return;
  try {
    await self.navigator.clearAppBadge();
  } catch {
    // sem suporte nesta plataforma
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FechouClima", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
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
      bumpBadge(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.action === "whatsapp" && event.notification.data?.waUrl
      ? event.notification.data.waUrl
      : new URL(event.notification.data?.url || "/inicio", self.location.origin).href;
  event.waitUntil(
    Promise.all([
      clearBadge(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const c of list) {
          if (c.url === url && "focus" in c) return c.focus();
        }
        return self.clients.openWindow(url);
      }),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-badge") event.waitUntil(clearBadge());
});
