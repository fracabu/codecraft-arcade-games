// arcade.nerd — la home: legge catalogo.json, disegna cartelle e cartucce, ricerca e tasti.
import { record } from "./comune/classifica.js";

const $ = (s) => document.querySelector(s);
const cartelleEl = $("#cartelle");
const cartucceEl = $("#cartucce");
const cercaEl = $("#cerca");
const vuotoEl = $("#vuoto");
const rigaCat = $("#riga-cat");
const doveEl = $("#dove");
const comandoEl = $("#comando");

const ASCII_IN_ARRIVO = String.raw`
  .------------.
  |  ________  |
  | |  ????  | |
  | |________| |
  |   ::  ::   |
  '------------'`;

let catalogo = { categorie: [], giochi: [] };
let categoria = leggiCategoria();
let scelta = -1;

function leggiCategoria() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return h || "tutti";
}

function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function disegnaCartelle() {
  const conta = (id) => catalogo.giochi.filter((g) => g.stato === "pronto" && (id === "tutti" || g.categoria === id)).length;
  const voci = [{ id: "tutti", nome: "tutti" }, ...catalogo.categorie];
  cartelleEl.innerHTML = voci.map((c, i) => `
    <li><button type="button" data-cat="${esc(c.id)}" aria-pressed="${c.id === categoria}" title="tasto ${i + 1}">
      /${esc(c.nome)}<span class="n">${conta(c.id)}</span>
    </button></li>`).join("");
}

function filtrati() {
  const q = cercaEl.value.trim().toLowerCase();
  return catalogo.giochi
    .filter((g) => categoria === "tutti" || g.categoria === categoria)
    .filter((g) => !q || `${g.titolo} ${g.descrizione} ${g.categoria}`.toLowerCase().includes(q))
    .sort((a, b) => (a.stato === "pronto" ? 0 : 1) - (b.stato === "pronto" ? 0 : 1));
}

function cartuccia(g) {
  const pronto = g.stato === "pronto";
  const rec = pronto ? record(g.slug) : null;
  const etichetta = pronto
    ? `<img src="anteprime/${esc(g.slug)}.jpg" alt="" loading="lazy" width="320" height="180" data-titolo="${esc(g.titolo)}">`
    : `<pre aria-hidden="true">${ASCII_IN_ARRIVO}</pre>`;
  const segni = pronto ? [
    g.telefono ? `<span class="segno si">touch</span>` : "",
    g.offline ? `<span class="segno si">offline</span>` : `<span class="segno">serve rete</span>`,
    g.esterno ? `<span class="segno fuori">sito esterno ↗</span>` : "",
  ].join("") : `<span class="segno">in arrivo</span>`;
  const link = pronto
    ? `<a class="apri" href="${esc(g.url)}"${g.esterno ? ' target="_blank" rel="noopener"' : ""} aria-label="Gioca a ${esc(g.titolo)}"></a>`
    : "";
  return `<li class="cartuccia${pronto ? "" : " in-arrivo"}" data-slug="${esc(g.slug)}">
    ${link}
    <div class="etichetta">${etichetta}</div>
    <div class="corpo">
      <span class="cat">/${esc(g.categoria)}</span>
      <h2>${esc(g.titolo)}</h2>
      <p>${esc(g.descrizione)}</p>
      ${rec ? `<span class="record">record: ${rec.punti} · ${esc(rec.nome)}</span>` : ""}
      ${pronto && g.comandi ? `<p class="dim">${esc(g.comandi)}</p>` : ""}
      <div class="segni">${segni}</div>
    </div>
  </li>`;
}

function disegna() {
  const lista = filtrati();
  cartucceEl.innerHTML = lista.map(cartuccia).join("");
  vuotoEl.hidden = lista.length > 0;
  const cat = catalogo.categorie.find((c) => c.id === categoria);
  rigaCat.textContent = cat ? `# ${cat.riga}` : `# ${catalogo.giochi.filter((g) => g.stato === "pronto").length} giochi pronti, altri in arrivo`;
  doveEl.textContent = categoria === "tutti" ? "~/giochi" : `~/giochi/${categoria}`;
  comandoEl.textContent = cercaEl.value.trim() ? `ls | grep ${cercaEl.value.trim()}` : "ls";
  scelta = -1;
  for (const b of cartelleEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.cat === categoria));
}

function vaiCategoria(id) {
  categoria = id;
  history.replaceState(null, "", id === "tutti" ? location.pathname : `#/${id}`);
  disegna();
}

function evidenzia(i) {
  const voci = [...cartucceEl.querySelectorAll(".cartuccia:not(.in-arrivo)")];
  if (!voci.length) return;
  scelta = (i + voci.length) % voci.length;
  voci.forEach((v, k) => v.classList.toggle("scelta", k === scelta));
  voci[scelta].scrollIntoView({ block: "nearest", behavior: "smooth" });
  voci[scelta].querySelector("a.apri")?.focus({ preventScroll: true });
}

cartelleEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cat]");
  if (b) vaiCategoria(b.dataset.cat);
});
cercaEl.addEventListener("input", disegna);
// anteprima mancante: al suo posto il titolo in testo
cartucceEl.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG") return;
  const pre = document.createElement("pre");
  pre.textContent = `[ ${img.dataset.titolo} ]`;
  img.replaceWith(pre);
}, true);
$("#azzera").addEventListener("click", () => { cercaEl.value = ""; vaiCategoria("tutti"); cercaEl.focus(); });
window.addEventListener("hashchange", () => { categoria = leggiCategoria(); disegna(); });

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const inCerca = document.activeElement === cercaEl;
  if (e.key === "/" && !inCerca) { e.preventDefault(); cercaEl.focus(); cercaEl.select(); return; }
  if (e.key === "Escape") { cercaEl.value = ""; cercaEl.blur(); disegna(); return; }
  if (inCerca) { if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); evidenzia(0); } return; }
  const n = Number(e.key);
  if (n >= 1 && n <= catalogo.categorie.length + 1) {
    vaiCategoria(n === 1 ? "tutti" : catalogo.categorie[n - 2].id);
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); evidenzia(scelta + 1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); evidenzia(scelta - 1); }
});

// installazione come app (Chrome e Android; su iPhone si usa "Aggiungi a Home")
let richiesta = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  richiesta = e;
  $("#installa").hidden = false;
});
$("#installa").addEventListener("click", async () => {
  if (!richiesta) return;
  richiesta.prompt();
  await richiesta.userChoice;
  richiesta = null;
  $("#installa").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

try {
  const r = await fetch("catalogo.json", { cache: "no-cache" });
  catalogo = await r.json();
} catch {
  rigaCat.textContent = "# errore: catalogo.json non letto. Ricarica la pagina.";
}
if (categoria !== "tutti" && !catalogo.categorie.some((c) => c.id === categoria)) categoria = "tutti";
disegnaCartelle();
disegna();
window.__ready = true;
