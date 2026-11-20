// Genera le icone PNG dall'SVG e l'immagine per i social: node strumenti/icone.mjs
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../icone/icona.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

async function png(lato, file, margine = 0, sfondo = "transparent") {
  await page.setViewportSize({ width: lato, height: lato });
  await page.setContent(`<html><body style="margin:0;background:${sfondo};display:grid;place-items:center;height:100vh">
    <div style="width:${lato - margine * 2}px;height:${lato - margine * 2}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: new URL(`../icone/${file}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), omitBackground: sfondo === "transparent" });
}
await png(180, "icona-180.png", 0, "#0a0f0b");
await png(192, "icona-192.png");
await png(512, "icona-512.png");
await png(512, "icona-maskable-512.png", 64, "#0a0f0b");   // zona sicura per le icone ritagliate

// anteprima per i social 1200x630
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;background:#0a0f0b;color:#b9f5c1;font-family:Consolas,ui-monospace,monospace;height:100vh;display:grid;place-content:center;gap:18px;padding:0 90px">
  <div style="font-size:110px;color:#39ff88;text-shadow:0 0 30px rgba(57,255,136,.5);letter-spacing:-2px">arcade<span style="color:#ff4fb3">.</span>nerd</div>
  <div style="font-size:30px"><span style="color:#39ff88">ospite@arcade</span>:<span style="color:#ffb000">~/giochi</span>$ ls</div>
  <div style="font-size:28px;color:#9fcfa8">/puzzle &nbsp;/arcade &nbsp;/lcd &nbsp;/corsa &nbsp;/tiro &nbsp;/platform &nbsp;/satira</div>
  <div style="font-size:22px;color:#5d8466">giochi leggeri per PC e telefono · gratis · senza account · anche offline</div>
</body></html>`);
await page.screenshot({ path: new URL("../icone/anteprima-social.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
await browser.close();
console.log("icone pronte");
