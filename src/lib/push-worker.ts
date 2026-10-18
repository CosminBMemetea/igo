/** Exported for deterministic worker tests. No application data is cached. */
export const PUSH_WORKER = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const tag = typeof payload.tag === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(payload.tag) ? payload.tag : "qfleet-notification";
  event.waitUntil(self.registration.showNotification("Querra Fleet", {
    body: "Ai o notificare nouă. Deschide aplicația pentru detalii.",
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag,
    renotify: false, data: { url: "/notifications" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/notifications", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      const navigated = await client.navigate(url);
      if (navigated) { await navigated.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
`;
