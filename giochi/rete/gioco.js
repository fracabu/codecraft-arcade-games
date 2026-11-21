// Rete! — arcade.nerd. Phaser 4.2.1 (vendor/) disegna il campo; il mondo sta in regole.js, punteggio e titoli in HTML.
// Il canvas riempie lo spazio libero (verticale o orizzontale) alla risoluzione vera dello schermo; la telecamera
// ingrandisce in modo che il lato corto mostri circa 210 unità di campo, e segue la palla.
import { finePartita, record } from "../../comune/classifica.js";
import * as M from "./regole.js";

const Phaser = window.Phaser;
const SLUG = "rete";
const LATO = 210;                 // unità di campo sul lato corto dello schermo
const TS = 8;                     // pixel di texture per unità: i disegni restano netti anche ingranditi
const MARGINE = 34;
const GRANDE = 1.3;               // i giocatori si disegnano un po' più grandi del loro ingombro
const NEON = 0x39ff88, AMBRA = 0xffb000;
const MONO = "ui-monospace, Consolas, monospace";
const TOCCO = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
if (TOCCO) document.body.classList.add("tocco");
const css = (n, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const $ = (s) => document.querySelector(s);

// --- suoni sintetizzati (niente file da scaricare)
let ac = null, rumore = null;
function audio() {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch { return null; }
}
function nota(forma, f1, f2, dur, vol, ritardo = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + ritardo;
  const o = a.createOscillator(), v = a.createGain();
  o.type = forma;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(v).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
// la folla: rumore filtrato che sale e scende
function folla(dur, vol) {
  const a = audio();
  if (!a) return;
  if (!rumore) {
    rumore = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = rumore.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain(), t = a.currentTime;
  src.buffer = rumore; src.loop = true;
  f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.7;
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(vol, t + 0.15);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(v).connect(a.destination);
  src.start(t); src.stop(t + dur + 0.05);
}
function fischio(volte = 1, lungo = 0.28) {
  for (let i = 0; i < volte; i++) {
    const r = i * (lungo + 0.12), d = i === volte - 1 ? lungo * 1.6 : lungo;
    nota("sine", 2900, 2700, d, 0.05, r);
    nota("square", 2950, 2750, d, 0.008, r);
  }
}
const SUONI = {
  calcio: (e) => nota("triangle", 200, 55, 0.09, Math.min(0.09, 0.03 + e.forza / 4000)),
  tocco: () => nota("triangle", 150, 90, 0.04, 0.02),
  rubata: () => nota("square", 260, 520, 0.08, 0.025),
  perde: () => nota("triangle", 180, 120, 0.06, 0.025),
  sponda: (e) => nota("square", 95, 45, 0.08, Math.min(0.04, e.forza / 5000)),
  palo: () => { nota("square", 1250, 980, 0.18, 0.035); nota("triangle", 2500, 2100, 0.25, 0.02); },
  traversa: () => { nota("square", 1150, 900, 0.2, 0.035); nota("triangle", 2300, 1900, 0.25, 0.02); },
  rimbalzo: () => nota("triangle", 110, 70, 0.05, 0.02),
  parata: () => nota("triangle", 160, 70, 0.12, 0.06),
  respinta: () => nota("square", 220, 90, 0.1, 0.04),
  scivolata: () => nota("sawtooth", 300, 120, 0.2, 0.012),
  contrasto: () => nota("square", 120, 60, 0.12, 0.04),
  fischio: () => fischio(1, 0.22),
  gol: (e) => {
    if (e.sq === 0) { [523, 659, 784, 1047, 1319].forEach((f, i) => nota("square", f, f, 0.12, 0.035, i * 0.09)); folla(2.2, 0.07); }
    else { nota("sawtooth", 330, 110, 0.7, 0.04); folla(1.2, 0.025); }
  },
  finale: () => fischio(3, 0.2),
  golden: () => fischio(2, 0.16),
  turno: () => [392, 523, 659].forEach((f, i) => nota("square", f, f, 0.1, 0.03, i * 0.1)),
  fine: (e) => { if (e.coppa) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => nota("square", f, f, 0.14, 0.04, i * 0.13)); },
};

// --- comandi a schermo: levetta a sinistra, TIRO e PASSA a destra
const tocco = { ax: 0, ay: 0, tiro: false, passa: false };
let alTocco = { avvia() {}, tiro() {}, passa() {} };
function comandiASchermo() {
  const leva = $(".leva"), pomo = leva.querySelector("span");
  let id = null;
  const leggi = (e) => {
    const r = leva.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.36);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.36);
    const n = Math.hypot(dx, dy);
    if (n > 1) { dx /= n; dy /= n; }
    const morto = n < 0.18;
    tocco.ax = morto ? 0 : dx;
    tocco.ay = morto ? 0 : dy;
    pomo.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
  };
  const lascia = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    tocco.ax = tocco.ay = 0;
    pomo.style.transform = "";
  };
  leva.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    id = e.pointerId;
    try { leva.setPointerCapture(id); } catch { /* puntatore sintetico */ }
    leggi(e);
    alTocco.avvia();
  });
  leva.addEventListener("pointermove", (e) => { if (e.pointerId === id) leggi(e); });
  leva.addEventListener("pointerup", lascia);
  leva.addEventListener("pointercancel", lascia);
  leva.addEventListener("contextmenu", (e) => e.preventDefault());
  for (const [sel, k] of [[".tiro", "tiro"], [".passa", "passa"]]) {
    const el = $(sel);
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.classList.add("premuto"); tocco[k] = true; alTocco[k](); });
    for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, () => { el.classList.remove("premuto"); tocco[k] = false; });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}
comandiASchermo();

// --- HUD in HTML: si riscrive solo quello che cambia
const hud = { tempo: $("#tempo"), ris: $("#ris"), turno: $("#turno"), punti: $("#punti") };
const ultimo = {};
function scriviHud(k, html, classe = "") {
  if (ultimo[k] === html + classe) return;
  ultimo[k] = html + classe;
  hud[k].innerHTML = html;
  hud[k].className = classe;
}
let tBanner = 0;
function dici(testo, durata = 1400, colore = "#39ff88") {
  const b = $("#banner");
  b.textContent = testo;
  b.style.color = colore;
  b.hidden = false;
  b.classList.remove("entra");
  void b.offsetWidth;
  b.classList.add("entra");
  clearTimeout(tBanner);
  tBanner = setTimeout(() => { b.hidden = true; }, durata);
}
const radar = $("#radar"), rctx = radar.getContext("2d");
function disegnaRadar(s) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = 60, h = 100;
  if (radar.width !== w * dpr) { radar.width = w * dpr; radar.height = h * dpr; }
  rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rctx.clearRect(0, 0, w, h);
  rctx.fillStyle = "rgba(57,255,136,0.25)";
  rctx.fillRect(0, h / 2, w, 1);
  rctx.fillRect(w / 2 - 8, 0, 16, 2); rctx.fillRect(w / 2 - 8, h - 2, 16, 2);
  const avv = s.avv.maglia === 0x23232c ? AMBRA : s.avv.maglia;
  for (const p of s.gioc) {
    rctx.fillStyle = p.sq === 0 ? (p.id === s.umano ? "#ffffff" : hex(NEON)) : hex(avv);
    rctx.fillRect((p.x / M.W) * w - 2, (p.y / M.H) * h - 2, 4, 4);
  }
  rctx.fillStyle = "#ffffff";
  rctx.beginPath(); rctx.arc((s.palla.x / M.W) * w, (s.palla.y / M.H) * h, 1.6, 0, Math.PI * 2); rctx.fill();
}

// --- disegni su canvas 2D a TS pixel per unità, poi texture
function tela(w, h) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * TS); cv.height = Math.ceil(h * TS);
  const c = cv.getContext("2d");
  c.scale(TS, TS);
  return [cv, c];
}
const PELLI = [0xf2c08a, 0xc98c5a, 0x8d5a34, 0xf5d3b0, 0xa86f44];
const CAPELLI = [0x3b2414, 0x111111, 0xd9b05a, 0x7a3a16, 0x2a2a2a];
const POSE = ["fermo", "passo0", "passo1", "scivolata", "terra"];

// giocatore visto dall'alto, rivolto verso destra (angolo 0): la texture si ruota con la direzione
function disegnaGiocatore(c, col, posa) {
  c.translate(9, 9);
  const ovale = (x, y, rx, ry, colore, bordo = true) => {
    c.fillStyle = css(colore);
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    if (bordo) { c.lineWidth = 0.45; c.strokeStyle = "rgba(0,0,0,0.75)"; c.stroke(); }
  };
  if (posa === "terra") {
    ovale(-6, -2, 2, 1.2, col.scarpe); ovale(-6, 2.2, 2, 1.2, col.scarpe);
    ovale(-2.8, 0, 3, 2.8, col.pantaloni);
    ovale(0.8, 0, 3.4, 4.6, col.maglia);
    ovale(0.5, -5.2, 1.3, 1.3, col.pelle); ovale(0.5, 5.2, 1.3, 1.3, col.pelle);
    ovale(5, 0, 2.6, 2.6, col.pelle); ovale(4.2, 0, 2.3, 2.3, col.capelli, false);
    return;
  }
  const piedi = { fermo: [[1.6, -2.5], [1.6, 2.5]], passo0: [[5.2, -2.5], [-3.6, 2.5]], passo1: [[-3.6, -2.5], [5.2, 2.5]], scivolata: [[7.6, 1], [-3, 3.6]] }[posa];
  const corpo = posa === "scivolata" ? -1.5 : 0;
  c.lineWidth = 1.7; c.strokeStyle = css(col.pelle); c.lineCap = "round";
  for (const [x, y] of piedi) { c.beginPath(); c.moveTo(corpo, y * 0.7); c.lineTo(x, y); c.stroke(); }
  for (const [x, y] of piedi) ovale(x, y, 2, 1.25, col.scarpe);
  ovale(corpo - 0.5, 0, 2.4, 3.6, col.pantaloni);
  // braccia che oscillano al contrario delle gambe
  const bx = posa === "passo0" ? -1.7 : posa === "passo1" ? 1.7 : 0;
  if (col.guanti) { ovale(corpo + 2.4, -4.8, 1.5, 1.5, col.guanti); ovale(corpo + 2.4, 4.8, 1.5, 1.5, col.guanti); }
  else { ovale(corpo + bx, -5.3, 1.35, 1.35, col.pelle); ovale(corpo - bx, 5.3, 1.35, 1.35, col.pelle); }
  ovale(corpo, 0, 3.1, 5, col.maglia);
  c.fillStyle = css(col.banda); c.fillRect(corpo - 2.6, -0.9, 5.2, 1.8);
  ovale(corpo + 0.7, 0, 2.6, 2.6, col.pelle);
  ovale(corpo - 0.3, 0, 2.35, 2.35, col.capelli, false);
}

class Gioco extends Phaser.Scene {
  constructor() { super("gioco"); }

  init() {
    this.s = M.nuovaPartita();
    this.acc = 0;
    this.ultimo = 0;
    this.fermo = false;
    this.pausaFino = 0;
    this.finito = false;
    this.latch = { tiro: false, passa: false };
    this.cam = { x: M.W / 2, y: M.H / 2 + 40 };
  }

  create() {
    this.texture();
    this.add.image(-MARGINE, -MARGINE, this.fondo()).setOrigin(0).setScale(1 / 6);
    this.ombre = this.s.gioc.map(() => this.add.image(0, 0, "ombra").setScale(0.5 * GRANDE / TS).setAlpha(0.22));
    this.anello = this.add.image(0, 0, "anello").setScale(GRANDE / TS);
    this.ombraPalla = this.add.image(0, 0, "ombra").setScale(0.42 / TS).setAlpha(0.4);
    this.figure = this.s.gioc.map(() => this.add.image(0, 0, "ombra").setScale(GRANDE / TS));
    this.palla = this.add.image(0, 0, "palla0").setScale(1.3 / TS);
    this.add.image(M.W / 2, -M.PROF / 2 - 1, "rete-alto").setScale(1 / TS);
    this.add.image(M.W / 2, M.H + M.PROF / 2 + 1, "rete-basso").setScale(1 / TS);
    this.freccia = this.add.image(0, 0, "freccia").setScale(1 / TS);
    this.coriandoli = this.add.particles(0, 0, "coriandolo", {
      speed: { min: 30, max: 120 }, angle: { min: 200, max: 340 }, lifespan: 1300, gravityY: 90,
      scale: { start: 1, end: 0.4 }, rotate: { min: 0, max: 360 }, emitting: false,
    }).setDepth(10);
    this.vestiSquadre();
    this.hudTitolo();
    this.comandi();
    this.inquadra();
    this.scale.on("resize", () => this.inquadra());
    this.disegna(0, 0);
    window.__ready = true;
  }

  // zoom: il lato corto del canvas mostra LATO unità di campo
  inquadra() {
    const cam = this.cameras.main, w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(Math.max(1, Math.min(w, h) / LATO));
  }

  texture() {
    if (this.textures.exists("ombra")) return;
    let [cv, c] = tela(18, 18);
    c.fillStyle = "rgba(0,0,0,0.9)"; c.beginPath(); c.ellipse(9, 9, 6, 6, 0, 0, Math.PI * 2); c.fill();
    this.textures.addCanvas("ombra", cv);
    [cv, c] = tela(18, 18);
    c.strokeStyle = css(NEON, 0.95); c.lineWidth = 0.9; c.beginPath(); c.ellipse(9, 9, 7.6, 7.6, 0, 0, Math.PI * 2); c.stroke();
    this.textures.addCanvas("anello", cv);
    [cv, c] = tela(8, 7);
    c.fillStyle = css(NEON); c.strokeStyle = "rgba(0,0,0,0.7)"; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(0.6, 0.6); c.lineTo(7.4, 0.6); c.lineTo(4, 6.4); c.closePath(); c.fill(); c.stroke();
    this.textures.addCanvas("freccia", cv);
    // palla: quattro pose della rotazione, macchie che scorrono
    for (let f = 0; f < 4; f++) {
      [cv, c] = tela(6, 6);
      c.save();
      c.beginPath(); c.arc(3, 3, 2.6, 0, Math.PI * 2); c.clip();
      c.fillStyle = "#f4f6f8"; c.fillRect(0, 0, 6, 6);
      c.fillStyle = "#15151a";
      for (const [x, y] of [[1.2, 1.4], [4.4, 2.2], [2.4, 4.6], [5.2, 5]]) { const xx = (x + f * 0.75) % 6; c.beginPath(); c.arc(xx, y, 0.8, 0, Math.PI * 2); c.fill(); }
      c.restore();
      c.strokeStyle = "rgba(0,0,0,0.6)"; c.lineWidth = 0.35; c.beginPath(); c.arc(3, 3, 2.45, 0, Math.PI * 2); c.stroke();
      this.textures.addCanvas(`palla${f}`, cv);
    }
    // reti delle porte, sopra la palla e i giocatori
    for (const alto of [true, false]) {
      [cv, c] = tela(M.PORTA + 6, M.PROF + 2);
      const y0 = alto ? 0 : 2, linea = alto ? M.PROF + 1 : 1;
      c.strokeStyle = "rgba(230,240,245,0.35)"; c.lineWidth = 0.3;
      for (let x = 3; x <= M.PORTA + 3; x += 2.5) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + M.PROF); c.stroke(); }
      for (let y = y0; y <= y0 + M.PROF; y += 2.5) { c.beginPath(); c.moveTo(3, y); c.lineTo(M.PORTA + 3, y); c.stroke(); }
      c.strokeStyle = "rgba(245,248,250,1)"; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(3, linea); c.lineTo(M.PORTA + 3, linea); c.stroke();
      c.lineWidth = 0.8; c.strokeStyle = "rgba(240,244,248,0.7)";
      c.beginPath(); c.moveTo(3, linea); c.lineTo(3, alto ? 0 : M.PROF + 2); c.moveTo(M.PORTA + 3, linea); c.lineTo(M.PORTA + 3, alto ? 0 : M.PROF + 2); c.stroke();
      this.textures.addCanvas(alto ? "rete-alto" : "rete-basso", cv);
    }
    // coriandolo: un pixel di schermo per unità di campo, la scala la dà lo zoom
    const cc = document.createElement("canvas");
    cc.width = 2; cc.height = 1;
    cc.getContext("2d").fillStyle = "#fff";
    cc.getContext("2d").fillRect(0, 0, 2, 2);
    this.textures.addCanvas("coriandolo", cc);
  }

  // texture delle due squadre in campo: una per ruolo (capelli e pelle cambiano) e per posa
  vestiSquadre() {
    const squadre = [M.NOI, this.s.avv];
    this.chiave = squadre.map((sq) => sq.sigla);
    squadre.forEach((sq, i) => {
      M.RUOLI.forEach((ruolo, r) => {
        const portiere = ruolo === "P";
        const col = {
          maglia: portiere ? sq.portiere : sq.maglia, banda: portiere ? 0x111111 : sq.banda,
          pantaloni: portiere ? 0x1a1a1a : (i === 0 ? 0x111111 : sq.banda), scarpe: 0x0c0c0c,
          pelle: PELLI[(r + i * 2) % PELLI.length], capelli: CAPELLI[(r * 3 + i) % CAPELLI.length], guanti: portiere ? 0xf0f0f0 : 0,
        };
        for (const posa of POSE) {
          const k = `${sq.sigla}-${ruolo}-${posa}`;
          if (this.textures.exists(k)) continue;
          const [cv, c] = tela(18, 18);
          disegnaGiocatore(c, col, posa);
          this.textures.addCanvas(k, cv);
        }
      });
    });
  }

  // prato, linee, gabbia e cartelloni: disegnati una volta (a 6 pixel per unità: il campo è grande)
  fondo() {
    if (this.textures.exists("campo")) return "campo";
    const m = MARGINE, R = 6;
    const cv = document.createElement("canvas");
    cv.width = (M.W + 2 * m) * R; cv.height = (M.H + 2 * m) * R;
    const c = cv.getContext("2d");
    c.scale(R, R);
    c.translate(m, m);
    // fuori dalla gabbia: il tetto del datacenter
    c.fillStyle = "#0a1410"; c.fillRect(-m, -m, M.W + 2 * m, M.H + 2 * m);
    c.fillStyle = "rgba(57,255,136,0.05)";
    for (let x = -m; x < M.W + m; x += 8) for (let y = -m; y < M.H + m; y += 8) if ((x + y) % 16 === 0) c.fillRect(x, y, 4, 4);
    // erba a strisce, con un velo di rumore
    for (let y = 0, i = 0; y < M.H; y += 25, i++) { c.fillStyle = i % 2 ? "#2a7d3f" : "#257238"; c.fillRect(0, y, M.W, 25); }
    let seme = 7;
    const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
    for (let i = 0; i < 2600; i++) { c.fillStyle = caso() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)"; c.fillRect(caso() * M.W, caso() * M.H, 0.6, 1.4); }
    // linee
    c.strokeStyle = "rgba(245,250,245,0.9)"; c.lineWidth = 0.9;
    c.strokeRect(0.5, 0.5, M.W - 1, M.H - 1);
    c.beginPath(); c.moveTo(0, M.H / 2); c.lineTo(M.W, M.H / 2); c.stroke();
    c.beginPath(); c.arc(M.W / 2, M.H / 2, 30, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "rgba(245,250,245,0.9)";
    c.beginPath(); c.arc(M.W / 2, M.H / 2, 1.2, 0, Math.PI * 2); c.fill();
    for (const alto of [true, false]) {
      const prof = 44, y = alto ? 0.5 : M.H - 0.5 - prof;
      c.strokeRect(M.PX0 - 26, y, M.PORTA + 52, prof);
      c.beginPath(); c.arc(M.W / 2, alto ? 32 : M.H - 32, 1.1, 0, Math.PI * 2); c.fill();
      // fondo della porta, sotto la rete
      c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(M.PX0, alto ? -M.PROF : M.H, M.PORTA, M.PROF);
      c.fillStyle = "rgba(245,250,245,0.9)";
    }
    // gabbia: muretto basso tutto attorno, montanti e rete metallica
    c.fillStyle = "#33424b";
    c.fillRect(-4, -4, M.PX0 + 4, 4); c.fillRect(M.PX1, -4, M.W - M.PX1 + 4, 4);
    c.fillRect(-4, M.H, M.PX0 + 4, 4); c.fillRect(M.PX1, M.H, M.W - M.PX1 + 4, 4);
    c.fillRect(-4, 0, 4, M.H); c.fillRect(M.W, 0, 4, M.H);
    c.strokeStyle = "rgba(170,190,200,0.28)"; c.lineWidth = 0.35;
    for (let y = -m; y < M.H + m; y += 3) {
      c.beginPath(); c.moveTo(-m + 3, y); c.lineTo(-5, y + 3); c.moveTo(-m + 3, y + 3); c.lineTo(-5, y); c.stroke();
      c.beginPath(); c.moveTo(M.W + 5, y); c.lineTo(M.W + m - 3, y + 3); c.moveTo(M.W + 5, y + 3); c.lineTo(M.W + m - 3, y); c.stroke();
    }
    c.fillStyle = "#9fb3bf";
    for (let y = 0; y <= M.H; y += 50) { c.fillRect(-5, y - 1.2, 2.4, 2.4); c.fillRect(M.W + 2.6, y - 1.2, 2.4, 2.4); }
    // cartelloni sulle sponde, letti di lato
    const cartelli = ["sudo gol", "404: difesa not found", "ctrl+alt+gol", "arcade.nerd", "git push --force", "rete! rete! rete!"];
    c.font = `bold 5.5px ${MONO}`; c.textAlign = "center"; c.textBaseline = "middle";
    cartelli.forEach((t, i) => {
      const y = 38 + i * 65;
      for (const [x, rot] of [[-m / 2 - 2, -Math.PI / 2], [M.W + m / 2 + 2, Math.PI / 2]]) {
        c.save(); c.translate(x, y); c.rotate(rot);
        c.fillStyle = "#0b1216"; c.fillRect(-29, -5, 58, 10);
        c.strokeStyle = css(i % 2 ? AMBRA : NEON, 0.8); c.lineWidth = 0.5; c.strokeRect(-29, -5, 58, 10);
        c.fillStyle = css(i % 2 ? AMBRA : NEON, 0.95); c.fillText(t, 0, 0.4);
        c.restore();
      }
    });
    this.textures.addCanvas("campo", cv);
    return "campo";
  }

  hudTitolo() {
    const rec = record(SLUG);
    $(".via").textContent = TOCCO ? "tocca per iniziare" : "premi un tasto per iniziare";
    $(".rec").textContent = rec ? `record ${rec.punti} (${rec.nome})` : "";
    $("#titolo").hidden = false;
    $("#titolo").onclick = () => this.avvia();
  }

  comandi() {
    this.tasti = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Z,X,C,SHIFT,ENTER");
    this.input.keyboard.on("keydown", (e) => {
      if (this.s.fase === "attesa") { this.avvia(); return; }
      if (e.repeat) return;
      if (["Space", "KeyZ"].includes(e.code)) this.latch.tiro = true;
      if (["KeyX", "KeyC", "ShiftLeft", "ShiftRight"].includes(e.code)) this.latch.passa = true;
    });
    this.input.on("pointerdown", () => this.avvia());
    alTocco = {
      avvia: () => this.avvia(),
      tiro: () => { if (this.s.fase === "attesa") this.avvia(); else this.latch.tiro = true; },
      passa: () => { if (this.s.fase === "attesa") this.avvia(); else this.latch.passa = true; },
    };
  }

  avvia() {
    if (this.s.fase !== "attesa") return;
    audio();
    M.avvia(this.s);
    $("#titolo").hidden = true;
  }

  leggi() {
    const t = this.tasti;
    return {
      sx: t.LEFT.isDown || t.A.isDown, dx: t.RIGHT.isDown || t.D.isDown,
      su: t.UP.isDown || t.W.isDown, giu: t.DOWN.isDown || t.S.isDown,
      ax: tocco.ax, ay: tocco.ay,
      tiro: t.SPACE.isDown || t.Z.isDown || tocco.tiro,
      passa: t.X.isDown || t.C.isDown || t.SHIFT.isDown || tocco.passa,
    };
  }

  avanza(n, inp) {
    for (let i = 0; i < n; i++) {
      const x = inp ? { ...inp } : this.leggi();
      // una pressione nuova conta anche se il tasto è già stato lasciato prima di questo passo
      if (this.latch.tiro) { x.tiro = true; this.s.tiroPrima = false; }
      if (this.latch.passa) { x.passa = true; this.s.passaPrima = false; }
      M.passo(this.s, x);
      this.latch.tiro = this.latch.passa = false;
      if (this.s.eventi.some((e) => e.tipo === "gol")) { this.eventi(); if (!inp) { this.pausaFino = performance.now() + 140; break; } }
    }
  }

  eventi() {
    const s = this.s;
    for (const e of s.eventi) {
      SUONI[e.tipo]?.(e);
      switch (e.tipo) {
        case "turno":
          this.vestiSquadre();
          dici(`PARTITA ${e.turno + 1} DI ${M.AVVERSARI.length}\n${M.NOI.nome} contro ${e.avv}`, 1900, "#ffb000");
          break;
        case "fischio": if (s.tempo >= M.DURATA - 0.1) dici("VIA!", 500); break;
        case "tiro": if (e.sq === 0) this.cameras.main.shake(80, 0.003); break;
        case "rubata": if (e.sq === 0) navigator.vibrate?.(15); break;
        case "gol": {
          const nostro = e.sq === 0;
          this.coriandoli.setParticleTint?.(nostro ? NEON : s.avv.maglia);
          this.coriandoli.explode(nostro ? 70 : 26, e.x, e.y < M.H / 2 ? 0 : M.H);
          this.cameras.main.shake(nostro ? 320 : 200, nostro ? 0.01 : 0.005);
          navigator.vibrate?.(nostro ? [60, 40, 60] : 40);
          dici(nostro ? (e.golden ? "GOLDEN GOL!" : "RETE!  +100") : `gol ${s.avv.nome}`, 1600, nostro ? "#39ff88" : "#ff8a8a");
          break;
        }
        case "palo": case "traversa": dici(e.tipo.toUpperCase() + "!", 600, "#ffb000"); this.cameras.main.shake(80, 0.004); break;
        case "contrasto": this.cameras.main.shake(60, 0.003); break;
        case "golden": dici("PAREGGIO\nGOLDEN GOL: chi segna vince", 1900, "#ffb000"); break;
        case "finale": {
          const r = `${e.gol[0]} - ${e.gol[1]}`;
          const perTiri = e.pari ? `\npassa chi ha tirato di più in porta\ntiri in porta ${e.tiri[0]} - ${e.tiri[1]}` : "";
          dici(e.vinto ? `VITTORIA ${r}${perTiri}\n+${e.bonus}` : `SCONFITTA ${r}${perTiri}`, 2700, e.vinto ? "#39ff88" : "#ff8a8a");
          break;
        }
        case "fine":
          if (e.coppa) { dici("COPPA DEI SERVER VINTA!\n+2000", 2500, "#ffb000"); this.coriandoli.explode(100, s.palla.x, s.palla.y); }
          this.fine(e.coppa);
          break;
      }
    }
    s.eventi.length = 0;
  }

  async fine(coppa) {
    if (this.finito) return;
    this.finito = true;
    await new Promise((r) => setTimeout(r, coppa ? 2600 : 600));
    await finePartita({ slug: SLUG, punti: this.s.punti, titolo: coppa ? "COPPA VINTA" : "ELIMINATI" });
    this.scene.restart();
  }

  disegna(time, dt) {
    const s = this.s, b = s.palla, cam = this.cameras.main;
    // telecamera: segue la palla un po' in ritardo; se il campo entra tutto in larghezza resta al centro
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const avanti = s.cond >= 0 ? (s.gioc[s.cond].sq === 0 ? -18 : 18) : 0;
    const tx = vw >= M.W + 2 * MARGINE ? M.W / 2 : clamp(b.x, -MARGINE + vw / 2, M.W + MARGINE - vw / 2);
    const ty = vh >= M.H + 2 * MARGINE ? M.H / 2 : clamp(b.y + avanti, -MARGINE + vh / 2, M.H + MARGINE - vh / 2);
    const k = dt ? 1 - Math.pow(0.015, dt) : 1;
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    cam.centerOn(this.cam.x, this.cam.y);

    s.gioc.forEach((p, i) => {
      let posa = "fermo";
      if (p.stato === "scivolata") posa = "scivolata";
      else if (p.stato === "terra" || p.stato === "rialza") posa = "terra";
      else if (Math.hypot(p.vx, p.vy) > 10) posa = Math.floor(p.passo / 5) % 2 ? "passo0" : "passo1";
      this.figure[i].setTexture(`${this.chiave[p.sq]}-${p.ruolo}-${posa}`).setPosition(p.x, p.y).setRotation(p.dir);
      this.ombre[i].setPosition(p.x + 1, p.y + 1.4);
    });
    const h = s.gioc[s.umano];
    const gioca = s.fase === "gioco" || s.fase === "pronti";
    this.anello.setVisible(gioca).setPosition(h.x, h.y);
    this.freccia.setVisible(gioca).setPosition(h.x, h.y - 11 + Math.sin(time / 120));

    // palla: più in alto, più grande e più lontana dalla sua ombra
    this.palla.setTexture(`palla${Math.floor(b.ang / 1.5) % 4}`).setPosition(b.x, b.y - b.z * 0.8).setScale((1.3 + b.z / 30) / TS);
    this.ombraPalla.setPosition(b.x + b.z * 0.2, b.y + 0.5).setAlpha(Math.max(0.12, 0.45 - b.z / 70));

    // HUD
    const sec = Math.max(0, Math.ceil(s.tempo));
    const golden = s.golden && s.fase !== "finale";
    scriviHud("tempo", golden ? `GOLDEN ${sec}` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, golden ? "golden" : "");
    scriviHud("ris", `<b>${M.NOI.sigla}</b> ${s.gol[0]} - ${s.gol[1]} <span style="color:${hex(s.avv.maglia === 0x23232c ? AMBRA : s.avv.maglia)}">${s.avv.sigla}</span>`);
    scriviHud("turno", `partita ${s.turno + 1}/${M.AVVERSARI.length}`);
    scriviHud("punti", String(s.punti).padStart(5, "0"));
    disegnaRadar(s);
  }

  update(time) {
    // tempo vero fra due fotogrammi: il delta di Phaser è smussato e sui telefoni lenti il gioco rallenterebbe
    const ora = performance.now();
    const trascorso = this.ultimo ? (ora - this.ultimo) / 1000 : M.DT;
    this.ultimo = ora;
    if (!this.fermo && ora >= this.pausaFino) {
      this.acc = Math.min(this.acc + trascorso, 0.25);
      const n = Math.floor(this.acc / M.DT);
      this.acc -= n * M.DT;
      if (n) this.avanza(n);
    }
    this.eventi();
    this.disegna(time, Math.min(trascorso, 0.1));
  }
}

// canvas alla risoluzione vera dello schermo (fino a 2x), grande quanto lo spazio libero
const box = $("#gioco");
const DPR = Math.min(2, devicePixelRatio || 1);
const misura = () => { const r = box.getBoundingClientRect(); return [Math.max(1, Math.round(r.width * DPR)), Math.max(1, Math.round(r.height * DPR))]; };
const [W0, H0] = misura();
const game = new Phaser.Game({
  // senza smoothStep il delta è il tempo vero (vedi Mainframe): sui telefoni lenti niente rallentatore
  fps: { smoothStep: false },
  type: Phaser.AUTO,
  parent: "gioco",
  backgroundColor: "#05080a",
  scale: { mode: Phaser.Scale.NONE, width: W0, height: H0, zoom: 1 / DPR },
  input: { activePointers: 3 },
  scene: [Gioco],
  banner: false,
});
new ResizeObserver(() => {
  const [w, h] = misura();
  if (w !== game.scale.width || h !== game.scale.height) { game.scale.resize(w, h); game.scale.setZoom(1 / DPR); }
}).observe(box);

// per le prove automatiche (strumenti/prova.mjs)
const scena = () => game.scene.getScene("gioco");
window.game = game;
window.GIOCO = {
  stato: () => {
    const s = scena()?.s;
    if (!s) return null;
    const h = s.gioc[s.umano], b = s.palla;
    return {
      fase: s.fase, turno: s.turno, gol: [...s.gol], tiri: [...s.tiri], tempo: +s.tempo.toFixed(2), punti: s.punti, golden: s.golden,
      umano: s.umano, conPalla: s.cond === s.umano, cond: s.cond, x: +h.x.toFixed(1), y: +h.y.toFixed(1), stato: h.stato,
      palla: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1), v: +Math.hypot(b.vx, b.vy).toFixed(0) },
      fps: Math.round(game.loop.actualFps),
    };
  },
  avvia: () => scena().avvia(),
  ferma: () => { scena().fermo = true; },
  riprendi: () => { scena().fermo = false; },
  passo: (n = 1, inp = {}) => scena().avanza(n, { ...inp }),
  // il nostro giocatore comandato in (x, y), rivolto verso dir, con la palla al piede; tutti gli altri lontani
  metti: (x, y, dir = -Math.PI / 2, palla = true) => {
    const s = scena().s, h = s.gioc[s.umano];
    let i = 0, j = 0;
    for (const p of s.gioc) {
      if (p === h || p.ruolo === "P") continue;
      if (p.sq === 0) { p.x = M.W - 20 - 25 * i++; p.y = M.H - 50; } else { p.x = 20 + 25 * j++; p.y = M.H - 22; }
      p.vx = p.vy = 0;
    }
    Object.assign(h, { x, y, vx: 0, vy: 0, stato: "ok", cd: 0, dir });
    const r = M.PR + M.BR + 0.6;
    Object.assign(s.palla, { x: x + Math.cos(dir) * r, y: y + Math.sin(dir) * r, z: 0, vx: 0, vy: 0, vz: 0 });
    s.cond = palla ? h.id : -1;
    s.passaA = -1;
    if (s.fase === "pronti") s.fase = "gioco";
  },
  portiere: (x) => { const s = scena().s; const p = s.gioc.find((q) => q.sq === 1 && q.ruolo === "P"); p.x = x; p.mx = x; p.pensa = 99; },
  risultato: (a, b, tempo = 0.05) => { const s = scena().s; s.gol = [a, b]; s.tempo = tempo; },
};
