/* Aitzaz AI Pro — service worker (PWA install + offline shell).
   Network-first for the HUD page (always fresh), cache-first for static
   assets (avatar, icons, manifest). API/WebSocket traffic is NEVER cached:
   audio and assistant data always go straight to the pipeline server. */
"use strict";

const CACHE = "aitzaz-hud-v1";
const SHELL = [
  "/hud/",
  "/hud/index.html",
  "/hud/avatar/aitzaz-avatar.js",
  "/hud/manifest.webmanifest",
  "/hud/icons/icon-192.png",
  "/hud/icons/icon-512.png",
  "/hud/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // never touch cross-origin
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws") return;

  const isPage = url.pathname === "/hud/" || url.pathname.endsWith("index.html");
  if (isPage) {
    // network-first so the HUD always gets the latest build
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put("/hud/index.html", clone));
          }
          return res;
        })
        .catch(() => caches.match("/hud/index.html").then((hit) => hit || caches.match(req)))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
    )
  );
});
