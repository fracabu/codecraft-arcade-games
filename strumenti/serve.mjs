// Server statico per provare il sito in locale: node strumenti/serve.mjs [cartella] [porta]
// Default: la radice del progetto sulla porta 5490 (dist/ per provare la versione da pubblicare).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = resolve(fileURLToPath(new URL("..", import.meta.url)), process.argv[2] ?? ".");
const PORTA = Number(process.argv[3] ?? 5490);
const TIPI = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    let percorso = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(RADICE, percorso));
    if (!file.startsWith(RADICE)) { res.writeHead(403).end(); return; }
    let s = await stat(file).catch(() => null);
    if (s?.isDirectory()) {
      if (!percorso.endsWith("/")) { res.writeHead(301, { Location: percorso + "/" }).end(); return; }
      file = join(file, "index.html");
      s = await stat(file).catch(() => null);
    }
    if (!s) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404"); return; }
    const corpo = await readFile(file);
    res.writeHead(200, { "Content-Type": TIPI[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(corpo);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORTA, "127.0.0.1", () => console.log(`arcade.nerd su http://127.0.0.1:${PORTA}/  (cartella: ${RADICE})`));
