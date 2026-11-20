// Prepara dist/ con i soli file da pubblicare, timbra la versione del service worker e stampa i pesi.
// Uso: node strumenti/prepara_dist.mjs   poi   npx wrangler pages deploy dist --project-name codecraft-arcade-games --branch main
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(RADICE, "dist");
const FILE = ["index.html", "stile.css", "hub.js", "catalogo.json", "manifest.webmanifest", "sw.js", "_headers"];
const CARTELLE = ["comune", "lcd", "giochi", "anteprime", "icone", "vendor"];

// controlli prima di pubblicare
const catalogo = JSON.parse(await readFile(join(RADICE, "catalogo.json"), "utf8"));
for (const g of catalogo.giochi.filter((x) => x.stato === "pronto" && !x.esterno)) {
  await stat(join(RADICE, g.url, "index.html")).catch(() => { throw new Error(`manca ${g.url}index.html (catalogo: ${g.slug})`); });
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);
for (const f of FILE) await cp(join(RADICE, f), join(DIST, f));
for (const c of CARTELLE) await cp(join(RADICE, c), join(DIST, c), { recursive: true });

async function* tutti(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* tutti(p); else yield p;
  }
}

// versione = impronta di tutti i file pubblicati: ogni modifica aggiorna la cache del telefono
const h = createHash("sha256");
const elenco = [];
for await (const p of tutti(DIST)) {
  if (p.endsWith("sw.js")) continue;
  const dati = await readFile(p);
  h.update(relative(DIST, p)).update(dati);
  elenco.push({ file: relative(DIST, p).replaceAll("\\", "/"), kb: dati.length / 1024 });
}
const versione = h.digest("hex").slice(0, 10);
const sw = join(DIST, "sw.js");
await writeFile(sw, (await readFile(sw, "utf8")).replace('const VERSIONE = "sviluppo";', `const VERSIONE = "${versione}";`));

// pesi per gruppo
const gruppi = {};
for (const { file, kb } of elenco) {
  const g = file.startsWith("giochi/") ? file.split("/").slice(0, 2).join("/") : file.includes("/") ? file.split("/")[0] : "home";
  gruppi[g] = (gruppi[g] ?? 0) + kb;
}
for (const [g, kb] of Object.entries(gruppi).sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(28)} ${kb.toFixed(1).padStart(8)} KB`);
const totale = elenco.reduce((a, b) => a + b.kb, 0);
console.log(`totale: ${(totale / 1024).toFixed(2)} MB in ${elenco.length + 1} file · versione cache ${versione}`);
