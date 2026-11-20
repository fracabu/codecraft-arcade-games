// Incastro 8x8 — arcade.nerd. Puzzle a blocchi su griglia, canvas semplice, niente motore.
// Trascina i tre pezzi sulla griglia; righe e colonne piene si svuotano. Finisce quando nessun pezzo entra.
import { finePartita, record } from "../../comune/classifica.js";

const SLUG = "incastro";
const N = 8;
const COLORI = ["#39ff88", "#ffb000", "#ff4fb3", "#4fc3ff", "#c58bff", "#ff7a45"];

// pezzi: celle [riga, colonna]
const FORME = [
  [[0, 0]],
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [1, 0], [2, 0]],
];
// i pezzi grandi escono un po' meno spesso
const PESI = FORME.map((f) => (f.length >= 9 ? 0.5 : f.length === 5 ? 0.8 : 1));

// --- regole pure
function nuovaPartita() {
  return { griglia: Array.from({ length: N }, () => Array(N).fill(null)), pezzi: tris(), punti: 0, combo: 0, finita: false };
}
function pesca() {
  const tot = PESI.reduce((a, b) => a + b, 0);
  let x = Math.random() * tot;
  for (let i = 0; i < FORME.length; i++) { x -= PESI[i]; if (x <= 0) return i; }
  return 0;
}
function tris() {
  return [0, 1, 2].map(() => ({ forma: FORME[pesca()], colore: COLORI[Math.floor(Math.random() * COLORI.length)] }));
}
function entra(g, forma, r, c) {
  return forma.every(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    return rr >= 0 && rr < N && cc >= 0 && cc < N && !g[rr][cc];
  });
}
function entraDaQualche(g, forma) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (entra(g, forma, r, c)) return true;
  return false;
}
/** piazza il pezzo i in (r,c). Ritorna le celle svuotate, o null se non entra. */
function piazza(S, i, r, c) {
  const p = S.pezzi[i];
  if (!p || !entra(S.griglia, p.forma, r, c)) return null;
  for (const [dr, dc] of p.forma) S.griglia[r + dr][c + dc] = p.colore;
  S.punti += p.forma.length;
  S.pezzi[i] = null;
  const righe = [], colonne = [];
  for (let k = 0; k < N; k++) {
    if (S.griglia[k].every(Boolean)) righe.push(k);
    if (S.griglia.every((riga) => riga[k])) colonne.push(k);
  }
  const via = new Set();
  for (const rr of righe) for (let k = 0; k < N; k++) via.add(`${rr},${k}`);
  for (const cc of colonne) for (let k = 0; k < N; k++) via.add(`${k},${cc}`);
  const linee = righe.length + colonne.length;
  if (linee) {
    S.combo++;
    S.punti += via.size * 2 * linee * S.combo;       // più linee insieme e combo di fila valgono di più
  } else {
    S.combo = 0;
  }
  const celle = [...via].map((s) => s.split(",").map(Number));
  for (const [rr, cc] of celle) S.griglia[rr][cc] = null;
  if (S.pezzi.every((x) => !x)) S.pezzi = tris();
  S.finita = !S.pezzi.some((x) => x && entraDaQualche(S.griglia, x.forma));
  return { celle, linee };
}

// --- disegno e input
const tela = document.getElementById("tela");
const ctx = tela.getContext("2d");
const hudPunti = document.getElementById("punti");
const hudRecord = document.getElementById("record");
const hudCombo = document.getElementById("combo");

let S = nuovaPartita();
let L = {};                 // misure del layout
let presa = null;           // { i, x, y, dx, dy } pezzo trascinato
let scelto = 0, cursore = { r: 3, c: 3 }, daTastiera = false;
let lampi = [];             // celle che si svuotano: { r, c, colore, t }

function misura() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = tela.clientWidth, h = tela.clientHeight;
  tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lato = Math.floor(Math.min(w - 24, (h - 20) / 1.5, 560));
  const cella = Math.floor(lato / N);
  const griglia = cella * N;
  const x0 = Math.floor((w - griglia) / 2);
  const altoTot = griglia + cella * 3.6;
  const y0 = Math.max(10, Math.floor((h - altoTot) / 2));
  L = { w, h, cella, griglia, x0, y0, vassoioY: y0 + griglia + cella * 0.6, mini: cella * 0.55 };
  disegna();
}

function rettangolo(x, y, s, colore, alfa = 1) {
  const r = Math.max(2, s * 0.14);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = colore;
  ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, r); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(x + 4, y + 4, s - 8, Math.max(2, s * 0.12));
  ctx.globalAlpha = 1;
}

function postoVassoio(i) {
  const larg = L.griglia / 3;
  return { cx: L.x0 + larg * i + larg / 2, cy: L.vassoioY + L.cella * 1.4 };
}
function misuraForma(forma) {
  const h = Math.max(...forma.map(([r]) => r)) + 1, w = Math.max(...forma.map(([, c]) => c)) + 1;
  return { w, h };
}
function dovePoggia() {
  // cella della griglia sotto l'angolo in alto a sinistra del pezzo trascinato
  if (!presa) return null;
  const p = S.pezzi[presa.i];
  const x = presa.x - presa.dx, y = presa.y - presa.dy;
  const c = Math.round((x - L.x0) / L.cella), r = Math.round((y - L.y0) / L.cella);
  return entra(S.griglia, p.forma, r, c) ? { r, c } : null;
}

function disegna() {
  const { w, h, cella, griglia, x0, y0 } = L;
  ctx.clearRect(0, 0, w, h);
  // griglia
  ctx.fillStyle = "#0b130d";
  ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, griglia + 12, griglia + 12, 8); ctx.fill();
  ctx.strokeStyle = "#1d3524"; ctx.lineWidth = 1;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    ctx.strokeRect(x0 + c * cella + 0.5, y0 + r * cella + 0.5, cella - 1, cella - 1);
    if (S.griglia[r][c]) rettangolo(x0 + c * cella, y0 + r * cella, cella, S.griglia[r][c]);
  }
  // anteprima di dove cade il pezzo
  const posa = presa ? dovePoggia() : daTastiera && S.pezzi[scelto] && entra(S.griglia, S.pezzi[scelto].forma, cursore.r, cursore.c) ? cursore : null;
  const pezzoPosa = presa ? S.pezzi[presa.i] : S.pezzi[scelto];
  if (posa && pezzoPosa) for (const [dr, dc] of pezzoPosa.forma) rettangolo(x0 + (posa.c + dc) * cella, y0 + (posa.r + dr) * cella, cella, pezzoPosa.colore, 0.32);
  if (daTastiera && !posa && pezzoPosa) {
    ctx.strokeStyle = "#ff4fb3"; ctx.lineWidth = 2;
    for (const [dr, dc] of pezzoPosa.forma) {
      const rr = cursore.r + dr, cc = cursore.c + dc;
      if (rr < N && cc < N) ctx.strokeRect(x0 + cc * cella + 3, y0 + rr * cella + 3, cella - 6, cella - 6);
    }
  }
  // celle che si svuotano
  const ora = performance.now();
  lampi = lampi.filter((l) => ora - l.t < 280);
  for (const l of lampi) {
    const k = 1 - (ora - l.t) / 280;
    ctx.globalAlpha = k;
    ctx.fillStyle = "#ffffff";
    const s = cella * (0.6 + 0.4 * k);
    ctx.fillRect(x0 + l.c * cella + (cella - s) / 2, y0 + l.r * cella + (cella - s) / 2, s, s);
    ctx.globalAlpha = 1;
  }
  // vassoio
  S.pezzi.forEach((p, i) => {
    if (!p || (presa && presa.i === i)) return;
    const { cx, cy } = postoVassoio(i);
    const { w: fw, h: fh } = misuraForma(p.forma);
    const s = L.mini;
    const ok = entraDaQualche(S.griglia, p.forma);
    for (const [r, c] of p.forma) rettangolo(cx - (fw * s) / 2 + c * s, cy - (fh * s) / 2 + r * s, s, ok ? p.colore : "#3a4a3e");
    if (daTastiera && i === scelto) {
      ctx.strokeStyle = "#ffb000"; ctx.lineWidth = 2;
      ctx.strokeRect(cx - L.griglia / 6 + 6, cy - L.cella * 1.3, L.griglia / 3 - 12, L.cella * 2.6);
    }
  });
  // pezzo in mano: grande come sulla griglia, sopra il dito
  if (presa) {
    const p = S.pezzi[presa.i];
    for (const [r, c] of p.forma) rettangolo(presa.x - presa.dx + c * cella, presa.y - presa.dy + r * cella, cella, p.colore, 0.92);
  }
  if (lampi.length) requestAnimationFrame(disegna);
  hudPunti.textContent = String(S.punti).padStart(5, "0");
  hudCombo.textContent = S.combo > 1 ? `combo x${S.combo}` : "";
}

function pezzoSotto(x, y) {
  for (let i = 0; i < 3; i++) {
    if (!S.pezzi[i]) continue;
    const { cx, cy } = postoVassoio(i);
    if (Math.abs(x - cx) < L.griglia / 6 && Math.abs(y - cy) < L.cella * 1.6) return i;
  }
  return -1;
}

function dopoMossa(esito) {
  if (esito?.celle.length) {
    const t = performance.now();
    for (const [r, c] of esito.celle) lampi.push({ r, c, t });
    navigator.vibrate?.(25);
  }
  disegna();
  if (S.finita) setTimeout(fine, 500);
}

async function fine() {
  await finePartita({ slug: SLUG, punti: S.punti, titolo: "GRIGLIA PIENA" });
  S = nuovaPartita();
  aggiornaRecord();
  disegna();
}

function aggiornaRecord() {
  const r = record(SLUG);
  hudRecord.textContent = r ? `record ${r.punti}` : "";
}

tela.addEventListener("pointerdown", (e) => {
  const i = pezzoSotto(e.offsetX, e.offsetY);
  if (i < 0) return;
  daTastiera = false;
  tela.setPointerCapture(e.pointerId);
  const { w: fw, h: fh } = misuraForma(S.pezzi[i].forma);
  // il pezzo si alza sopra il dito: su telefono il dito non lo copre
  const sopra = e.pointerType === "touch" ? L.cella * 1.8 : 0;
  presa = { i, x: e.offsetX, y: e.offsetY, dx: (fw * L.cella) / 2, dy: (fh * L.cella) / 2 + sopra };
  disegna();
});
tela.addEventListener("pointermove", (e) => {
  if (!presa) return;
  presa.x = e.offsetX; presa.y = e.offsetY;
  disegna();
});
const lascia = () => {
  if (!presa) return;
  const posa = dovePoggia();
  const i = presa.i;
  presa = null;
  dopoMossa(posa ? piazza(S, i, posa.r, posa.c) : null);
};
tela.addEventListener("pointerup", lascia);
tela.addEventListener("pointercancel", () => { presa = null; disegna(); });

// tastiera: 1 2 3 scelgono il pezzo, frecce lo muovono, Invio lo posa
document.addEventListener("keydown", (e) => {
  if (document.querySelector(".fp") || e.ctrlKey || e.metaKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 3) { scelto = n - 1; daTastiera = true; disegna(); return; }
  const mosse = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (mosse[e.key]) {
    e.preventDefault();
    daTastiera = true;
    if (!S.pezzi[scelto]) scelto = S.pezzi.findIndex(Boolean);
    cursore.r = Math.max(0, Math.min(N - 1, cursore.r + mosse[e.key][0]));
    cursore.c = Math.max(0, Math.min(N - 1, cursore.c + mosse[e.key][1]));
    disegna();
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && daTastiera) {
    e.preventDefault();
    const esito = piazza(S, scelto, cursore.r, cursore.c);
    if (esito && !S.pezzi[scelto]) scelto = Math.max(0, S.pezzi.findIndex(Boolean));
    dopoMossa(esito);
  }
});

new ResizeObserver(misura).observe(tela);
aggiornaRecord();

window.GIOCO = {
  stato: () => ({ punti: S.punti, combo: S.combo, finita: S.finita, piene: S.griglia.flat().filter(Boolean).length, pezzi: S.pezzi.map((p) => (p ? p.forma.length : 0)) }),
  piazza: (i, r, c) => { const e = piazza(S, i, r, c); dopoMossa(e); return e; },
  // per le prove: imposta una griglia e i pezzi
  prepara: (righe, forme) => {
    S = nuovaPartita();
    righe.forEach((riga, r) => [...riga].forEach((ch, c) => { if (ch === "#") S.griglia[r][c] = "#4fc3ff"; }));
    if (forme) S.pezzi = forme.map((k) => ({ forma: FORME[k], colore: COLORI[k % COLORI.length] }));
    disegna();
  },
  posizioneVassoio: (i) => { const p = postoVassoio(i); const b = tela.getBoundingClientRect(); return { x: b.left + p.cx, y: b.top + p.cy }; },
  posizioneCella: (r, c) => { const b = tela.getBoundingClientRect(); return { x: b.left + L.x0 + (c + 0.5) * L.cella, y: b.top + L.y0 + (r + 0.5) * L.cella, cella: L.cella }; },
};
window.__ready = true;
