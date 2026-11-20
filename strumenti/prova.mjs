// Collaudo di arcade.nerd con Playwright (Chromium). Serve il server: node strumenti/serve.mjs [cartella] [porta]
// node strumenti/prova.mjs [--base http://127.0.0.1:5490/] [--anteprime] [--veloce]
//   --anteprime  rifà le immagini delle cartucce in anteprime/
//   --veloce     solo pagine ed errori, senza prove di gioco, FPS e offline (per il sito pubblicato)
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const BASE = arg("--base") ?? "http://127.0.0.1:5490/";
const ANTEPRIME = process.argv.includes("--anteprime");
const VELOCE = process.argv.includes("--veloce");
const catalogo = JSON.parse(await readFile(new URL("../catalogo.json", import.meta.url), "utf8"));
const locali = catalogo.giochi.filter((g) => g.stato === "pronto" && !g.esterno);
const SCHERMI = [
  { nome: "telefono", width: 390, height: 844, touch: true },
  { nome: "telefono-orizz", width: 844, height: 390, touch: true },
  { nome: "tablet", width: 768, height: 1024, touch: true },
  { nome: "pc", width: 1440, height: 900, touch: false },
];
await mkdir("_scatti", { recursive: true });
await mkdir("anteprime", { recursive: true });

const browser = await chromium.launch();
const esito = { base: BASE, quando: new Date().toISOString(), pagine: [], prove: [], note: [] };
let falliti = 0;
const ok = (nome, vero, dettaglio = "") => {
  esito.prove.push({ nome, ok: !!vero, dettaglio });
  if (!vero) falliti++;
  console.log(`${vero ? "OK " : "NO "} ${nome}${dettaglio ? `  (${dettaglio})` : ""}`);
};

async function apri(ctx, percorso) {
  const page = await ctx.newPage();
  const errori = [];
  page.on("pageerror", (e) => errori.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errori.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errori.push(`${r.status()} ${r.url()}`); });
  await page.goto(new URL(percorso, BASE).href, { waitUntil: "load" });
  const pronto = await page.waitForFunction(() => window.__ready === true || !!window.game || !!document.querySelector("canvas"), null, { timeout: 20000 }).then(() => true, () => false);
  await page.waitForTimeout(700);
  return { page, errori, pronto };
}
function contesto(s) {
  return browser.newContext({ viewport: { width: s.width, height: s.height }, hasTouch: s.touch, isMobile: s.touch, deviceScaleFactor: s.touch ? 2 : 1, serviceWorkers: "block" });
}

// 1. tutte le pagine, a quattro misure di schermo
for (const s of SCHERMI) {
  const ctx = await contesto(s);
  for (const percorso of ["./", ...locali.map((g) => g.url)]) {
    const { page, errori, pronto } = await apri(ctx, percorso);
    const largo = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const nome = percorso === "./" ? "home" : percorso.split("/")[1];
    await page.screenshot({ path: `_scatti/${nome}-${s.nome}.png` });
    esito.pagine.push({ pagina: nome, schermo: s.nome, pronto, errori, scrollOrizzontale: largo });
    ok(`${nome} @ ${s.nome}: si apre senza errori`, pronto && !errori.length, errori.slice(0, 2).join(" | "));
    if (nome === "home") ok(`home @ ${s.nome}: niente scroll orizzontale`, !largo);
    await page.close();
  }
  await ctx.close();
}

if (!VELOCE) {
  const tel = await contesto(SCHERMI[0]);
  const pc = await contesto(SCHERMI[3]);

  // 2. home: categorie e ricerca
  {
    const { page } = await apri(pc, "./");
    const tutti = await page.locator(".cartuccia:not(.in-arrivo)").count();
    ok("home: cartucce pronte", tutti === catalogo.giochi.filter((g) => g.stato === "pronto").length, `${tutti}`);
    await page.click('button[data-cat="lcd"]');
    ok("home: la cartella /lcd mostra 2 giochi pronti", (await page.locator(".cartuccia:not(.in-arrivo)").count()) === 2);
    await page.keyboard.press("1");
    await page.keyboard.press("/");
    await page.keyboard.type("bug");
    ok("home: la ricerca 'bug' trova Bug Bash", (await page.locator(".cartuccia h2").allTextContents()).join() === "Bug Bash");
    await page.close();
  }

  // 3. Incastro: trascinamento vero col mouse
  {
    const { page } = await apri(pc, "giochi/incastro/");
    await page.evaluate(() => GIOCO.prepara(["#######.", "", "", "", "", "", "", ""], [0, 9, 3]));
    const da = await page.evaluate(() => GIOCO.posizioneVassoio(0));
    const a = await page.evaluate(() => GIOCO.posizioneCella(0, 7));
    await page.mouse.move(da.x, da.y);
    await page.mouse.down();
    await page.mouse.move(a.x, a.y, { steps: 8 });
    await page.mouse.up();
    const st = await page.evaluate(() => GIOCO.stato());
    ok("incastro: trascino un pezzo e la riga piena si svuota", st.piene === 0 && st.punti > 1, JSON.stringify(st));
    await page.close();
  }

  // 4. Fascia d'Asteroidi: parte col tocco, il tempo scorre, tre colpi chiudono la partita e il record resta
  {
    const { page } = await apri(tel, "giochi/fascia-asteroidi/");
    await page.touchscreen.tap(195, 500);
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => GIOCO.stato());
    ok("asteroidi: il tocco fa partire e il tempo scorre", st.fase === "gioco" && st.tempo > 1, JSON.stringify(st));
    await page.evaluate(() => { GIOCO.colpisci(); GIOCO.colpisci(); GIOCO.colpisci(); });
    await page.waitForSelector(".fp", { timeout: 4000 }).catch(() => {});
    const fp = await page.locator(".fp").count();
    ok("asteroidi: dopo tre colpi c'è la fine partita", fp === 1);
    if (fp) {
      await page.fill(".fp-nome input", "TST").catch(() => {});
      await page.click(".fp-nome button").catch(() => {});
      const rec = await page.evaluate(() => JSON.parse(localStorage.getItem("arcade-nerd:classifica:fascia-asteroidi") || "[]"));
      ok("asteroidi: il record è salvato in classifica", rec[0]?.nome === "TST", JSON.stringify(rec[0] ?? null));
      await page.click(".fp-rigioca");
      await page.waitForTimeout(800);
      ok("asteroidi: rigioca riparte da capo", (await page.evaluate(() => GIOCO.stato()))?.fase === "attesa");
    }
    await page.close();
  }

  // 5. Cache Miss: tasti a schermo col dito, un pacchetto perso conta un errore
  {
    const { page } = await apri(tel, "giochi/cache-miss/");
    await page.locator('button[data-modo="A"]').tap();
    await page.evaluate(() => GIOCO.ferma());
    const prima = (await page.evaluate(() => GIOCO.stato())).pos;
    await page.locator('button[data-tasto="destra"]').tap();
    const dopo = (await page.evaluate(() => GIOCO.stato())).pos;
    ok("cache-miss: il tasto a schermo destra sposta il sistemista", dopo === prima + 1, `${prima} → ${dopo}`);
    const st = await page.evaluate(() => {
      // il sistemista va all'angolo opposto al primo pacchetto, finché un pacchetto cade
      for (let i = 0; i < 40 && GIOCO.stato().errori === 0; i++) {
        const s = GIOCO.stato();
        const p = s.pacchetti[0];
        if (p) { const meta = p.l < 2 ? 3 : 0; while (GIOCO.stato().pos !== meta) GIOCO.tasto(meta > GIOCO.stato().pos ? "destra" : "sinistra"); }
        GIOCO.passo();
      }
      GIOCO.ferma();
      return GIOCO.stato();
    });
    ok("cache-miss: un pacchetto perso è un errore", st.errori === 1, JSON.stringify({ errori: st.errori, punti: st.punti }));
    const preso = await page.evaluate(() => {
      GIOCO.avvia("A"); GIOCO.ferma();
      for (let i = 0; i < 40 && GIOCO.stato().punti === 0; i++) {
        const p = GIOCO.stato().pacchetti.sort((a, b) => b.r - a.r)[0];
        if (p) while (GIOCO.stato().pos !== p.l) GIOCO.tasto(p.l > GIOCO.stato().pos ? "destra" : "sinistra");
        GIOCO.passo();
      }
      GIOCO.ferma();
      return GIOCO.stato();
    });
    ok("cache-miss: un pacchetto preso fa punto", preso.punti >= 1, JSON.stringify({ punti: preso.punti, errori: preso.errori }));
    await page.close();
  }

  // 6. Bug Bash: frecce e colpo da tastiera
  {
    const { page } = await apri(pc, "giochi/bug-bash/");
    await page.keyboard.press("1");
    await page.evaluate(() => GIOCO.ferma());
    const st = await page.evaluate(async () => {
      for (let i = 0; i < 30 && GIOCO.stato().punti === 0; i++) {
        GIOCO.passo();
        const b = GIOCO.stato().bug[0];
        if (!b) continue;
        const muovi = (n) => document.dispatchEvent(new KeyboardEvent("keydown", { key: n, bubbles: true }));
        for (let k = 0; k < 4 && GIOCO.stato().pos !== b.i; k++) {
          const pos = GIOCO.stato().pos;
          if (pos % 3 < b.i % 3) muovi("ArrowRight"); else if (pos % 3 > b.i % 3) muovi("ArrowLeft");
          else muovi(Math.floor(pos / 3) < Math.floor(b.i / 3) ? "ArrowDown" : "ArrowUp");
        }
        muovi(" ");
      }
      GIOCO.ferma();
      return GIOCO.stato();
    });
    ok("bug-bash: frecce e Spazio schiacciano un bug", st.punti >= 1, JSON.stringify({ punti: st.punti }));
    await page.close();
  }

  // 7. FPS dell'arcade con la CPU rallentata 4 volte
  {
    const { page } = await apri(tel, "giochi/fascia-asteroidi/");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => GIOCO.avvia());
    await page.waitForTimeout(6000);
    const st = await page.evaluate(() => GIOCO.stato());
    esito.note.push(`FPS di Fascia d'Asteroidi con CPU rallentata 4x in Chromium headless (WebGL software): ${st?.fps}`);
    ok("asteroidi: FPS con CPU 4x (informativo, headless senza GPU)", true, `${st?.fps} fps`);
    await page.close();
  }

  // 8. offline: dopo una visita, senza rete la home e un gioco LCD si aprono lo stesso
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    let home = false, lcd = false;
    try { await page.goto(BASE); home = await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 }).then(() => true); } catch { /* resta false */ }
    try { await page.goto(new URL("giochi/cache-miss/", BASE).href); lcd = await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 }).then(() => true); } catch { /* resta false */ }
    ok("offline: la home si apre senza rete", home);
    ok("offline: Cache Miss si apre senza rete", lcd);
    await ctx.close();
  }
  await tel.close(); await pc.close();
}

// 9. anteprime delle cartucce (640x360)
if (ANTEPRIME) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, serviceWorkers: "block" });
  const scene = {
    "incastro": async (p) => p.evaluate(() => GIOCO.prepara(["", "", "", "...##...", "..####.#", ".######.", "##.#####", "########"], [17, 9, 3])),
    "fascia-asteroidi": async (p) => { await p.evaluate(() => GIOCO.avvia()); await p.waitForTimeout(4500); },
    "cache-miss": async (p) => { await p.evaluate(() => { GIOCO.avvia("A"); GIOCO.ferma(); for (let i = 0; i < 7; i++) GIOCO.passo(); GIOCO.ferma(); }); },
    "bug-bash": async (p) => { await p.evaluate(() => { GIOCO.avvia("A"); GIOCO.ferma(); for (let i = 0; i < 5; i++) GIOCO.passo(); GIOCO.ferma(); }); },
    "il-25": async (p) => { await p.waitForTimeout(1500); },
    "grande-circo": async (p) => { await p.waitForTimeout(2500); },
  };
  for (const g of locali) {
    const { page } = await apri(ctx, g.url + (g.slug === "grande-circo" ? "?k=1" : ""));
    await scene[g.slug]?.(page);
    await page.evaluate(() => document.querySelector(".torna")?.remove());
    if (g.categoria === "lcd") {
      // dei portatili si mostra solo lo schermo a cristalli liquidi
      await page.setViewportSize({ width: 900, height: 560 });
      await page.waitForTimeout(200);
      await page.locator("svg.lcd").screenshot({ path: `anteprime/${g.slug}.jpg`, type: "jpeg", quality: 72 });
      await page.setViewportSize({ width: 640, height: 360 });
    } else {
      await page.screenshot({ path: `anteprime/${g.slug}.jpg`, type: "jpeg", quality: 72 });
    }
    await page.close();
    console.log(`anteprima: anteprime/${g.slug}.jpg`);
  }
  await ctx.close();
}

await browser.close();
esito.falliti = falliti;
await writeFile("_scatti/esito.json", JSON.stringify(esito, null, 2));
console.log(`\n${esito.prove.length - falliti}/${esito.prove.length} prove passate · dettagli in _scatti/esito.json`);
process.exit(falliti ? 1 : 0);
