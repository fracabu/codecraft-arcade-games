// Uno scatto veloce di una pagina, con gli errori della console.
// node strumenti/scatto.mjs <percorso> <file.png> [larghezza] [altezza] [touch] [js-da-eseguire]
import { chromium } from "playwright";

const [percorso = "/", uscita = "_scatti/scatto.png", w = "1280", h = "800", touch = "", js = ""] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  hasTouch: touch === "touch", isMobile: touch === "touch", deviceScaleFactor: touch === "touch" ? 2 : 1,
});
const page = await ctx.newPage();
const errori = [];
page.on("pageerror", (e) => errori.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errori.push(`console: ${m.text()}`); });
await page.goto(new URL(percorso, "http://127.0.0.1:5490/").href);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => errori.push("timeout: __ready mai arrivato"));
await page.waitForTimeout(400);
let risultato = null;
if (js) risultato = await page.evaluate(js);
await page.waitForTimeout(300);
await page.screenshot({ path: uscita });
console.log(JSON.stringify({ percorso, uscita, risultato, errori }, null, 1));
await browser.close();
