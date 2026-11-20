// Service worker di arcade.nerd: la home e i giochi locali funzionano anche senza rete.
// Subito si scaricano solo i file leggeri; Phaser (1,3 MB) e i giochi che lo usano entrano in cache
// la prima volta che si giocano, così chi apre solo la home non scarica un mega e mezzo.
// La versione viene cambiata da strumenti/prepara_dist.mjs a ogni pubblicazione.
const VERSIONE = "sviluppo";
const CACHE = `arcade-nerd-${VERSIONE}`;
const SUBITO = [
  "./", "index.html", "stile.css", "hub.js", "catalogo.json", "manifest.webmanifest",
  "comune/classifica.js", "comune/gioco.css", "icone/icona.svg", "icone/icona-192.png",
  "lcd/motore.js", "lcd/lcd.css",
  "giochi/incastro/", "giochi/incastro/gioco.js",
  "giochi/cache-miss/", "giochi/cache-miss/gioco.js",
  "giochi/bug-bash/", "giochi/bug-bash/gioco.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SUBITO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k.startsWith("arcade-nerd-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// stessa origine: risponde subito dalla cache e intanto aggiorna (stale-while-revalidate).
// catalogo e pagine HTML: prima la rete, la cache solo se manca la rete.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;     // font, CDN e siti esterni: li gestisce il browser
  // in sviluppo (VERSIONE non timbrata) sempre prima la rete: niente file vecchi mentre si lavora
  const primaRete = VERSIONE === "sviluppo" || req.mode === "navigate" || url.pathname.endsWith("catalogo.json");
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const inCache = await cache.match(req, { ignoreSearch: true });
    const dallaRete = fetch(req).then((r) => {
      if (r.status === 200 && r.type === "basic") cache.put(req, r.clone()).catch(() => {});
      return r;
    });
    if (primaRete) return dallaRete.catch(() => inCache || cache.match("index.html"));
    if (inCache) { e.waitUntil(dallaRete.catch(() => {})); return inCache; }
    return dallaRete;
  })());
});
