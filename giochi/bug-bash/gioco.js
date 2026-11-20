// Bug Bash — portatile LCD di arcade.nerd.
// Sei moduli; i bug spuntano, escono e scappano in produzione. La ciabatta li schiaccia.
import { avviaLCD } from "../../lcd/motore.js";

const COLONNE = [110, 200, 290];
const FILE_Y = [112, 192];
const BUCHI = FILE_Y.flatMap((y) => COLONNE.map((x) => ({ x, y })));

const S = { pos: 4, bug: [], effetti: [], colpo: null };

function insetto(g, x, y, el, intero) {
  const t = el("g", { transform: `translate(${x} ${y})` }, g);
  if (!intero) {
    // spunta: antenne e mezza testa sopra il buco
    el("path", { d: "M-7 -6 A7 6 0 0 1 7 -6 Z" }, t);
    el("path", { class: "linea", d: "M-3 -10 L-7 -18 M3 -10 L7 -18" }, t);
    return;
  }
  el("ellipse", { cx: 0, cy: -16, rx: 10, ry: 8 }, t);                         // corpo
  el("circle", { cx: 0, cy: -27, r: 5 }, t);                                    // testa
  el("path", { class: "linea", d: "M-3 -31 L-8 -38 M3 -31 L8 -38" }, t);       // antenne
  el("path", { class: "linea", d: "M-9 -20 L-16 -24 M-10 -15 L-17 -15 M-9 -10 L-16 -6 M9 -20 L16 -24 M10 -15 L17 -15 M9 -10 L16 -6" }, t);
}

function ciabatta(g, x, y, el, giu) {
  const t = el("g", { transform: `translate(${x} ${y})` }, g);
  if (giu) {
    el("rect", { x: -17, y: -12, width: 34, height: 9, rx: 4.5 }, t);              // suola sul buco
    el("path", { class: "linea", d: "M8 -12 L20 -34" }, t);                        // braccio
  } else {
    el("rect", { x: 14, y: -52, width: 9, height: 32, rx: 4.5, transform: "rotate(28 18 -36)" }, t);  // ciabatta alzata
    el("path", { class: "linea", d: "M24 -40 L36 -54" }, t);
  }
}

function schiacciato(g, x, y, el) {
  const t = el("g", { transform: `translate(${x} ${y})` }, g);
  el("path", { d: "M0 -16 L4 -8 L13 -11 L8 -4 L16 0 L7 2 L10 9 L2 4 L-2 11 L-4 3 L-13 7 L-8 0 L-16 -5 L-7 -6 L-10 -14 L-3 -8 Z" }, t);
}

function fuga(g, x, y, el) {
  const t = el("g", { transform: `translate(${x + 34} ${y + 2})` }, g);
  el("ellipse", { cx: 0, cy: -6, rx: 6, ry: 4.5 }, t);
  el("circle", { cx: 7, cy: -8, r: 3 }, t);
  el("path", { class: "linea", d: "M-10 -10 L-18 -10 M-10 -5 L-20 -5 M-10 0 L-16 0" }, t);
}

function disegna({ fondo, strato, el, seg }) {
  BUCHI.forEach(({ x, y }, i) => {
    el("rect", { x: x - 30, y: y, width: 60, height: 24, rx: 3 }, fondo);
    el("path", { d: `M${x - 24} ${y + 24} V${y + 30} M${x - 12} ${y + 24} V${y + 30} M${x} ${y + 24} V${y + 30} M${x + 12} ${y + 24} V${y + 30} M${x + 24} ${y + 24} V${y + 30}` }, fondo);
    el("ellipse", { cx: x, cy: y, rx: 22, ry: 6, class: "pieno" }, fondo);
    el("text", { x: x - 16, y: y + 16 }, fondo).textContent = `mod_${i + 1}`;
  });
  el("text", { x: 340, y: 160 }, fondo).textContent = "→PROD";
  el("path", { d: "M338 166 H392 V214 H338 Z" }, fondo);

  BUCHI.forEach(({ x, y }, i) => {
    seg(strato, `b1-${i}`, (g) => insetto(g, x, y, el, false));
    seg(strato, `b2-${i}`, (g) => insetto(g, x, y, el, true));
    seg(strato, `sp-${i}`, (g) => schiacciato(g, x, y, el));
    seg(strato, `fu-${i}`, (g) => fuga(g, x, y, el));
    seg(strato, `ci-${i}`, (g) => ciabatta(g, x, y, el, false));
    seg(strato, `cg-${i}`, (g) => ciabatta(g, x, y, el, true));
  });
}

function disegnaStato(api) {
  api.spegniTutto("b1-"); api.spegniTutto("b2-");
  for (const b of S.bug) api.accendi(`b${b.fase}-${b.i}`);
  api.spegniTutto("sp-"); api.spegniTutto("fu-");
  for (const e of S.effetti) api.accendi(`${e.tipo}-${e.i}`);
  api.spegniTutto("ci-"); api.spegniTutto("cg-");
  api.accendi(`${S.colpo ? "cg" : "ci"}-${S.pos}`);
}

function velocita(api) {
  const base = api.modo === "B" ? 470 : 620;
  const min = api.modo === "B" ? 190 : 240;
  api.intervallo = Math.max(min, base - api.punti * 2.5);
}

const gioco = {
  slug: "bug-bash",
  titolo: "Bug Bash",
  sottotitolo: "arcade.nerd · lcd-02",
  tasti: ["su", "giu", "sinistra", "destra", "colpo"],
  aiuto: `<span class="tastiera">Frecce per muoverti, Spazio o Z per colpire · 1 = GAME A, 2 = GAME B (veloce) · </span>Un bug preso mentre spunta vale 2, fuori vale 1. Tre bug in produzione e il rilascio salta.`,
  disegna,

  nuovaPartita(api) {
    S.pos = 4; S.bug = []; S.effetti = []; S.colpo = null;
    velocita(api);
    disegnaStato(api);
  },

  passo(api) {
    S.effetti = [];
    let scappato = -1;
    for (const b of S.bug) {
      b.t--;
      if (b.t > 0) continue;
      if (b.fase === 1) { b.fase = 2; b.t = api.modo === "B" ? 2 : 3; }
      else if (scappato < 0) scappato = b.i;
    }
    if (scappato >= 0) {
      S.bug = S.bug.filter((b) => b.i !== scappato);
      S.effetti.push({ tipo: "fu", i: scappato });
      disegnaStato(api);
      if (api.sbaglia()) return;
      api.pausa(1000);
      return;
    }
    const quanti = api.modo === "B" ? Math.min(4, 2 + Math.floor(api.punti / 12)) : Math.min(3, 1 + Math.floor(api.punti / 15));
    if (S.bug.length < quanti && (S.bug.length === 0 || Math.random() < 0.5)) {
      const liberi = BUCHI.map((_, i) => i).filter((i) => !S.bug.some((b) => b.i === i) && i !== S.pos);
      if (liberi.length) S.bug.push({ i: liberi[Math.floor(Math.random() * liberi.length)], fase: 1, t: 2 });
    }
    disegnaStato(api);
    api.bip("muovi");
  },

  tasto(nome, api) {
    if (nome === "colpo") {
      clearTimeout(S.colpo);
      S.colpo = setTimeout(() => { S.colpo = null; disegnaStato(api); }, 180);
      const k = S.bug.findIndex((b) => b.i === S.pos);
      if (k >= 0) {
        const b = S.bug.splice(k, 1)[0];
        S.effetti.push({ tipo: "sp", i: b.i });
        api.segna(b.fase === 1 ? 2 : 1);
        velocita(api);
      } else {
        api.bip("muovi");
      }
      disegnaStato(api);
      return;
    }
    const c = S.pos % 3, r = Math.floor(S.pos / 3);
    const nc = Math.max(0, Math.min(2, c + (nome === "destra") - (nome === "sinistra")));
    const nr = Math.max(0, Math.min(1, r + (nome === "giu") - (nome === "su")));
    const nuovo = nr * 3 + nc;
    if (nuovo === S.pos) return;
    S.pos = nuovo;
    api.bip("muovi");
    disegnaStato(api);
  },

  stato: () => ({ pos: S.pos, bug: S.bug.map((b) => ({ ...b })) }),
};

avviaLCD(gioco);
