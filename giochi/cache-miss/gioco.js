// Cache Miss — portatile LCD di arcade.nerd.
// Quattro server sputano pacchetti; il sistemista li prende col vassoio. Tre persi: game over.
import { avviaLCD } from "../../lcd/motore.js";

const CORSIE = [70, 160, 250, 340];
const RIGHE = [92, 114, 136, 158, 180];        // l'ultima è all'altezza del vassoio
const ULTIMA = RIGHE.length - 1;

const S = { pos: 1, pacchetti: [], tick: 0, crash: -1 };

const pacchetto = `<path fill-rule="evenodd" d="M-9 -6.5 H9 V6.5 H-9 Z M-6.5 -4.2 L0 0.8 L6.5 -4.2 Z"/>`;

function sistemista(g, x, el) {
  const t = el("g", { transform: `translate(${x} 0)` }, g);
  el("path", { d: "M-15 190 H15 L11 196 H-11 Z" }, t);                    // vassoio
  el("path", { class: "linea", d: "M-6 212 L-12 197 M6 212 L12 197" }, t); // braccia alzate
  el("circle", { cx: 0, cy: 205, r: 5.5 }, t);                             // testa
  el("rect", { x: -7, y: 211, width: 14, height: 13, rx: 3 }, t);          // corpo (felpa)
  el("path", { class: "linea", d: "M-4 224 L-5 233 M4 224 L5 233" }, t);  // gambe
}

function rotto(g, x, el) {
  const t = el("g", { transform: `translate(${x} 0)` }, g);
  el("path", { d: "M-14 232 L-9 223 L-4 230 Z M-2 233 L3 222 L8 231 Z M9 232 L14 226 L16 233 Z" }, t);
  el("path", { class: "linea", d: "M-10 214 L-4 219 M10 213 L4 219 M0 210 L0 217" }, t);  // scintille
}

function disegna({ fondo, strato, el, seg }) {
  // stampato sul vetro: i server, il pavimento flottante, le etichette
  CORSIE.forEach((x, i) => {
    el("rect", { x: x - 24, y: 46, width: 48, height: 26, rx: 2 }, fondo);
    el("path", { d: `M${x - 20} 54 H${x + 6} M${x - 20} 60 H${x + 6} M${x - 20} 66 H${x + 6}` }, fondo);
    el("circle", { cx: x + 14, cy: 54, r: 1.8, class: "pieno" }, fondo);
    el("circle", { cx: x + 14, cy: 61, r: 1.8, class: "pieno" }, fondo);
    el("text", { x: x - 12, y: 80 }, fondo).textContent = `SRV${i + 1}`;
  });
  el("path", { d: "M8 234 H392" }, fondo);
  el("path", { d: "M8 238 H392", "stroke-dasharray": "3 5" }, fondo);

  CORSIE.forEach((x, l) => {
    RIGHE.forEach((y, r) => seg(strato, `p-${l}-${r}`, (g) => {
      const t = el("g", { transform: `translate(${x} ${y}) scale(${1 + r * 0.06})` }, g);
      t.innerHTML = pacchetto;
    }));
    seg(strato, `adm-${l}`, (g) => sistemista(g, x, el));
    seg(strato, `rotto-${l}`, (g) => rotto(g, x, el));
  });
}

function disegnaStato(api) {
  api.spegniTutto("p-");
  for (const p of S.pacchetti) api.accendi(`p-${p.l}-${p.r}`);
  api.spegniTutto("adm-");
  api.accendi(`adm-${S.pos}`);
  api.spegniTutto("rotto-");
  if (S.crash >= 0) api.accendi(`rotto-${S.crash}`);
}

function velocita(api) {
  const base = api.modo === "B" ? 430 : 580;
  const min = api.modo === "B" ? 170 : 210;
  api.intervallo = Math.max(min, base - api.punti * 1.8);
}

// un nuovo pacchetto deve essere prendibile: niente arrivi in contemporanea,
// e se le corsie sono lontane serve almeno uno scatto in più per spostarsi
function corsieLibere() {
  const arrivo = S.tick + ULTIMA;
  return [0, 1, 2, 3].filter((l) => S.pacchetti.every((p) => {
    const suo = S.tick - p.r + ULTIMA;
    const dt = Math.abs(suo - arrivo);
    const dl = Math.abs(p.l - l);
    if (p.l === l) return p.r > 1;           // non due pacchetti incollati nella stessa corsia
    return dt >= (dl >= 2 ? 2 : 1);
  }));
}

function prendi(api) {
  const i = S.pacchetti.findIndex((p) => p.r === ULTIMA && p.l === S.pos);
  if (i < 0) return false;
  S.pacchetti.splice(i, 1);
  api.segna(1);
  velocita(api);
  return true;
}

const gioco = {
  slug: "cache-miss",
  titolo: "Cache Miss",
  sottotitolo: "arcade.nerd · lcd-01",
  tasti: ["sinistra", "destra"],
  aiuto: `<span class="tastiera">Frecce ◀ ▶ per muoverti · 1 = GAME A, 2 = GAME B (veloce) · </span>Prendi i pacchetti col vassoio: tre persi e il datacenter va giù. A 200 e 500 punti gli errori si azzerano.`,
  disegna,

  nuovaPartita(api) {
    S.pos = 1; S.pacchetti = []; S.tick = 0; S.crash = -1;
    velocita(api);
    disegnaStato(api);
  },

  passo(api) {
    S.tick++;
    S.crash = -1;
    prendi(api);   // un pacchetto arrivato sul vassoio durante una pausa è preso
    // i pacchetti sul vassoio non presi cadono
    const persi = S.pacchetti.filter((p) => p.r === ULTIMA);
    S.pacchetti = S.pacchetti.filter((p) => p.r !== ULTIMA);
    for (const p of S.pacchetti) p.r++;
    if (persi.length) {
      S.crash = persi[0].l;
      disegnaStato(api);
      if (api.sbaglia()) return;
      api.pausa(1100);
      return;
    }
    // nuovi pacchetti
    const quanti = api.modo === "B" ? Math.min(5, 2 + Math.floor(api.punti / 20)) : Math.min(4, 1 + Math.floor(api.punti / 25));
    if (S.pacchetti.length < quanti && (S.pacchetti.length === 0 || Math.random() < 0.55)) {
      const libere = corsieLibere();
      if (libere.length) S.pacchetti.push({ l: libere[Math.floor(Math.random() * libere.length)], r: 0 });
    }
    // un pacchetto appena arrivato dove c'è già il vassoio è preso subito
    prendi(api);
    disegnaStato(api);
    api.bip("muovi");
  },

  tasto(nome, api) {
    const prima = S.pos;
    if (nome === "sinistra") S.pos = Math.max(0, S.pos - 1);
    if (nome === "destra") S.pos = Math.min(3, S.pos + 1);
    if (S.pos === prima) return;
    if (!prendi(api)) api.bip("muovi");
    disegnaStato(api);
  },

  stato: () => ({ pos: S.pos, pacchetti: S.pacchetti.map((p) => ({ ...p })) }),
};

avviaLCD(gioco);
