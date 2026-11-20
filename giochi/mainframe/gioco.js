// Mainframe — arcade.nerd. Phaser 4.2.1 (vendor/) disegna e suona; il mondo sta in regole.js.
// Schermo logico 480x640 disegnato a 960x1280 (K = 2) così testi e pixel restano netti anche sul telefono.
import { finePartita, record } from "../../comune/classifica.js";
import * as M from "./regole.js";

const Phaser = window.Phaser;
const SLUG = "mainframe";
const K = 2;
const NEON = 0x39ff88, AMBRA = 0xffb000, CIANO = 0x5fd7ff, ROSSO = 0xff4f4f, TRAVE = 0xd9531e;
const MONO = "ui-monospace, Consolas, monospace";
const TOCCO = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
if (TOCCO) document.body.classList.add("tocco");

// --- suoni sintetizzati (niente file da scaricare)
let ac = null;
function nota(forma, f1, f2, dur, vol, ritardo = 0) {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime + ritardo;
    const o = ac.createOscillator(), v = ac.createGain();
    o.type = forma;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    v.gain.setValueAtTime(vol, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* niente audio */ }
}
const SUONI = {
  salto: () => nota("square", 300, 640, 0.12, 0.03),
  atterra: () => nota("triangle", 160, 90, 0.05, 0.03),
  punti: () => { nota("square", 880, 880, 0.06, 0.03); nota("square", 1320, 1320, 0.08, 0.03, 0.06); },
  carica: () => nota("square", 180, 260, 0.2, 0.02),
  lancio: () => nota("sawtooth", 140, 50, 0.25, 0.05),
  tonfo: () => nota("triangle", 120, 60, 0.07, 0.04),
  morte: () => nota("sawtooth", 420, 40, 0.8, 0.06),
  usb: () => [523, 659, 784, 1047].forEach((f, i) => nota("square", f, f, 0.08, 0.03, i * 0.07)),
  formattata: () => nota("square", 1400, 180, 0.14, 0.04),
  preso: () => nota("square", 990, 1500, 0.12, 0.03),
  fiamma: () => nota("sawtooth", 90, 300, 0.3, 0.03),
  vinto: () => [392, 523, 659, 784, 1047].forEach((f, i) => nota("square", f, f, 0.12, 0.035, i * 0.11)),
  vita: () => [784, 988, 1175, 1568].forEach((f, i) => nota("triangle", f, f, 0.1, 0.04, i * 0.08)),
};

// --- pixel art: una riga di caratteri per riga di pixel
const COLORI = {
  h: 0x3b2414, s: 0xf2c08a, k: 0x111111, g: 0x23a86b, a: AMBRA, w: 0xffffff, p: 0x2b3a5c, b: 0x15151a,
  r: 0xff4f2f, o: 0xff9a1f, y: 0xffe14f, m: 0xc9d1d6, u: 0x2f7bff, n: 0x6b3f1e, z: 0x8a95a0, d: 0xd8343a,
};
const TESTA = ["....hhhhhh....", "...hhhhhhhh...", "...hhhhhhhhh..", "...hhsssssss..", "...hsskkskks..", "...hssssssss..", "....ssssss....", "......ss......"];
const BUSTO = ["....gggggg....", "...ggaggggg...", "..gggaggggggg.", "..ggwwgggg.gg.", "..ggwwgggg.gg.", "..gggggggg.ss.", "..ss.ggggg....", "....gggggg...."];
const ARTE = {
  "om-fermo": [...TESTA, ...BUSTO, "....pppppp....", "....pp..pp....", "....pp..pp....", "....pp..pp....", "....bb..bbb...", "...bbb..bbb..."],
  "om-passo0": [...TESTA, ...BUSTO, "....pppppp....", "....pp..pp....", "...pp....pp...", "..pp......pp..", "..pp......pp..", ".bbb......bbb."],
  "om-passo1": [...TESTA, ...BUSTO, "....pppppp....", ".....pppp.....", ".....pp.pp....", "....pp..pp....", "....pp...pp...", "...bbb...bbb.."],
  "om-salto": ["....hhhhhh....", "...hhhhhhhh...", "...hhhhhhhhh..", "...hhsssssss..", "...hsskkskks..", "...hssssssss..", ".s..ssssss..s.", ".g....ss....g.",
    ".gg.gggggg.gg.", "..gggaggggggg.", "...ggagggggg..", "...gwwgggggg..", "...gwwgggggg..", "...gggggggg...", "....gggggg....", "....gggggg....",
    "....pppppp....", "...pppppppp...", "..ppp....ppp..", "..bbb....bbb..", "..............", ".............."],
  "om-scala": ["....hhhhhh....", "...hhhhhhhh...", "..hhhhhhhhhh..", "..hhhhhhhhhh..", "..hhhhhhhhhh..", "...hhhhhhhh...", "..s.hhhhhh....", "..s...ss......",
    "..gggggggg....", "..ggggggggg...", "...gggggggggg.", "...ggggggggggg", "...gggggggg.ss", "...gggggggg...", "....gggggg....", "....gggggg....",
    "....pppppp....", "....pp..pp....", "....pp..pp....", "....pp...pp...", "....bb...pp...", "...bbb...bb..."],
  "fiamma0": [".....r......", "....rr..r...", "...rro..rr..", "..rroo.rro..", "..rooorroo..", ".rrooooooor.", ".roooyyooor.", "rrooyyyyoorr",
    "rooykyykyoor", "rooyyyyyyoor", "rooyyyyyyoor", ".rooyyyyyor.", "..rroooorr..", "....rrrr...."],
  "fiamma1": ["........r...", "..r....rr...", "..rr..orr...", "..orr.oorr..", "..oorroooor.", ".rooooooorr.", ".roooyyooor.", "rrooyyyyoorr",
    "rooykyykyoor", "rooyyyyyyoor", "rooyyyyyyoor", ".rooyyyyyor.", "..rroooorr..", "....rrrr...."],
  "usb": ["..mmmm..", "..mkkm..", "..mmmm..", ".uuuuuu.", ".uuuuuu.", ".uwuuuu.", ".uuuuuu.", ".uuuuuu.", ".uuuuuu.", ".uuuuuu.", ".uuuuuu.", ".uuuuuu.", "..uuuu..", "...uu..."],
  "caffe": ["..z..z......", "...z..z.....", "..z..z......", ".wwwwwwww...", ".wnnnnnnwww.", ".wwwwwwwww.w", ".wwkwwkwww.w", ".wwwkkwwwwww", ".wwwwwwwww..", ".wwwwwwwww..", "..wwwwwww...", "............"],
  "manuale": [".dddddddddd.", ".dwwwwwwwwd.", ".ddddddddddw", ".dyyyyyyyydw", ".ddddddddddw", ".ddddddddddw", ".ddkkddkkddw", ".ddddddddddw", ".ddddddddddw",
    ".ddddddddddw", ".ddddddddddw", ".ddddddddddw", ".dddddddddd.", "............"],
};

// --- comandi a schermo: croce a sinistra (otto direzioni, il dito può scivolare), SALTA a destra
const tocco = { sx: false, dx: false, su: false, giu: false };
let alTocco = { salto() {}, avvia() {} };
function comandiASchermo() {
  const croce = document.querySelector(".croce"), salta = document.querySelector(".salta");
  let id = null;
  const leggi = (e) => {
    const r = croce.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const z = r.width * 0.12, ax = Math.abs(dx), ay = Math.abs(dy);
    tocco.sx = dx < -z && ax > ay * 0.5;
    tocco.dx = dx > z && ax > ay * 0.5;
    tocco.su = dy < -z && ay > ax * 0.5;
    tocco.giu = dy > z && ay > ax * 0.5;
    for (const k of ["sx", "dx", "su", "giu"]) croce.classList.toggle(k, tocco[k]);
  };
  const lascia = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    tocco.sx = tocco.dx = tocco.su = tocco.giu = false;
    croce.classList.remove("sx", "dx", "su", "giu");
  };
  croce.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    id = e.pointerId;
    try { croce.setPointerCapture(id); } catch { /* puntatore sintetico o già rilasciato */ }
    leggi(e);
    alTocco.avvia();
  });
  croce.addEventListener("pointermove", (e) => { if (e.pointerId === id) leggi(e); });
  croce.addEventListener("pointerup", lascia);
  croce.addEventListener("pointercancel", lascia);
  salta.addEventListener("pointerdown", (e) => { e.preventDefault(); salta.classList.add("premuto"); alTocco.salto(); });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) salta.addEventListener(t, () => salta.classList.remove("premuto"));
  for (const el of [croce, salta]) el.addEventListener("contextmenu", (e) => e.preventDefault());
}
comandiASchermo();

// fotogramma della bobina per un angolo in radianti (periodo 120°, quattro pose da 30°)
const fotogramma = (a) => `bobina${((Math.floor(a / (Math.PI / 6)) % 4) + 4) % 4}`;

// cambia testo e colore solo se sono davvero cambiati: ogni setText/setColor ridisegna il testo
function scrivi(t, testo, colore) {
  if (t.text !== testo) t.setText(testo);
  if (colore && t.style.color !== colore) t.setColor(colore);
}

const MOTIVI = {
  bobina: "preso da una bobina",
  fiamma: "scottato dal surriscaldamento",
  caduta: "caduto dall'impalcatura",
  tempo: "tempo scaduto: il mainframe ha vinto",
};

class Gioco extends Phaser.Scene {
  constructor() { super("gioco"); }

  init() {
    this.s = M.nuovaPartita();
    this.acc = 0;
    this.ultimo = 0;
    this.fermo = false;
    this.saltoPremuto = false;
    this.finito = false;
  }

  create() {
    this.texture();
    this.add.image(0, 0, this.fondo()).setOrigin(0);
    this.mondo = this.add.container(0, 0).setScale(K);
    this.creaMainframe();

    this.imgOggetti = this.s.oggetti.map((o) => this.add.image(o.x, M.quota(M.TRAVI[o.g], o.x) - 12, o.tipo));
    this.mondo.add(this.imgOggetti);
    this.spina = this.add.image(290, 66, "spina");
    this.mondo.add(this.spina);
    this.ups = this.add.image(16, 594, "fiamma0").setScale(1.3);
    this.mondo.add(this.ups);

    this.sprBobine = [];
    this.sprFiamme = [];
    this.omino = this.add.image(60, 600, "om-fermo").setOrigin(0.5, 1);
    this.raggio = this.add.image(0, 0, "raggio").setVisible(false);
    this.mondo.add([this.omino, this.raggio]);

    this.scintille = this.add.particles(0, 0, "scintilla", {
      speed: { min: 60, max: 220 }, lifespan: 450, scale: { start: 1.4, end: 0 }, tint: [AMBRA, NEON, 0xffffff], emitting: false,
    });

    this.hud();
    this.comandi();
    this.disegna(0);
    window.__ready = true;
  }

  texture() {
    const NEAREST = Phaser.Textures?.FilterMode?.NEAREST;
    const nitida = (k) => { if (NEAREST !== undefined) this.textures.get(k).setFilter(NEAREST); };
    if (this.textures.exists("om-fermo")) return;
    const g = this.make.graphics({}, false);
    for (const [k, righe] of Object.entries(ARTE)) {
      g.clear();
      righe.forEach((riga, y) => [...riga].forEach((c, x) => { if (COLORI[c] !== undefined) g.fillStyle(COLORI[c]).fillRect(x, y, 1, 1); }));
      g.generateTexture(k, righe[0].length, righe.length);
      nitida(k);
    }
    // bobina di nastro, pixel per pixel: flangia chiara, nastro marrone, mozzo con tre fori.
    // Gira a fotogrammi (bobina0..3, 30° l'uno: i tre fori si ripetono ogni 120°) e non con la rotazione:
    // nel collaudo le immagini ruotate perdevano pezzi a certi angoli, e i cerchi di generateTexture uscivano a spicchio.
    for (let f = 0; f < 4; f++) {
      g.clear();
      const a0 = f * Math.PI / 6;
      const fori = [0, 1, 2].map((i) => ({ x: 9 + Math.cos(a0 + i * 2.094) * 2.3, y: 9 + Math.sin(a0 + i * 2.094) * 2.3 }));
      const lx = 9 + Math.cos(a0 + 3.6) * 6.3, ly = 9 + Math.sin(a0 + 3.6) * 6.3;   // riflesso sul nastro, gira con lui
      for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
        const px = x + 0.5, py = y + 0.5, d = Math.hypot(px - 9, py - 9);
        let c = null;
        if (d <= 8.6) c = 0xc9d1d6;
        if (d <= 7.4) c = Math.hypot(px - lx, py - ly) < 1.3 ? 0x9a6a3e : 0x6b4626;
        if (d <= 5.4) c = 0x4a2f19;
        if (d <= 3.9) c = fori.some((h) => Math.hypot(px - h.x, py - h.y) < 1.1) ? 0x0e1012 : 0xc9d1d6;
        if (d <= 1.1) c = 0x0e1012;
        if (c !== null) g.fillStyle(c).fillRect(x, y, 1, 1);
      }
      g.generateTexture(`bobina${f}`, 18, 18);
    }
    g.clear();
    g.fillStyle(0xe8edf0).fillRoundedRect(0, 1, 8, 7, 1.5);
    g.fillStyle(0x8a95a0).fillRect(8, 2, 3, 1).fillRect(8, 6, 3, 1);
    g.generateTexture("spina", 12, 9);
    g.clear();
    g.fillStyle(0xffffff).fillRect(1, 0, 2, 4).fillRect(0, 1, 4, 2);
    g.generateTexture("scintilla", 4, 4);
    g.clear();
    g.fillStyle(NEON, 0.25).fillRoundedRect(0, 0, 16, 10, 4);
    g.fillStyle(0xd6ffe4, 0.9).fillRect(2, 4, 12, 2);
    g.generateTexture("raggio", 16, 10);
    g.destroy();
  }

  // Tutto quello che non si muove (rack, UPS, cavo, presa, scale, travi, corpo del mainframe) si disegna una volta
  // sola su un canvas 2D a 960x1280 e diventa un'immagine: un Graphics di Phaser verrebbe ridisegnato a ogni fotogramma.
  fondo() {
    if (this.textures.exists("fondo")) return "fondo";
    const cv = document.createElement("canvas");
    cv.width = M.W * K; cv.height = M.H * K;
    const c = cv.getContext("2d");
    c.scale(K, K);
    const col = (n, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    const linea = (x0, y0, x1, y1, w, colore) => { c.lineWidth = w; c.strokeStyle = colore; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    // armadi rack del datacenter, in fondo, con le spie accese
    for (let x = 6; x < M.W; x += 60) {
      c.fillStyle = col(0x0b1216); c.fillRect(x, 40, 46, M.H - 40);
      c.lineWidth = 1; c.strokeStyle = col(0x15212a); c.strokeRect(x + 0.5, 40.5, 45, M.H - 41);
      for (let y = 52; y < M.H - 10; y += 14) {
        linea(x + 3, y + 10.5, x + 43, y + 10.5, 1, col(0x101b22));
        const h = (x * 31 + y * 17) % 7;
        if (h < 3) { c.fillStyle = col(h ? 0x1f7a48 : 0x7a5a10, 0.8); c.fillRect(x + 6 + h * 5, y + 4, 2, 2); }
      }
    }
    // gruppo di continuità in fiamme, dove finiscono le bobine
    c.fillStyle = col(0x283238); c.fillRect(3, 600, 27, 24);
    c.lineWidth = 1; c.strokeStyle = col(0x8fa3b0); c.strokeRect(3.5, 600.5, 26, 23);
    c.fillStyle = col(ROSSO); c.fillRect(7, 604, 4, 2);
    c.fillStyle = col(0x8fa3b0); c.font = `6px ${MONO}`; c.fillText("UPS", 9, 619);
    // cavo dal mainframe alla presa, sopra la piattaforma più alta
    c.lineWidth = 2; c.strokeStyle = col(0x2a2a2a); c.lineJoin = "round";
    c.beginPath(); c.moveTo(100, 94); c.lineTo(100, 56); c.lineTo(283, 56); c.lineTo(283, 66); c.stroke();
    c.fillStyle = col(0xe8edf0); c.fillRect(292, 60, 8, 14);
    c.fillStyle = col(0x222222); c.fillRect(294, 63, 1, 3); c.fillRect(297, 63, 1, 3);
    // prima le scale, così le travi ci passano sopra
    for (const L of M.SCALE) {
      const ya = M.cimaScala(L), yb = M.piedeScala(L);
      const pezzi = L.rotta ? [[ya, ya + 16], [yb - 14, yb]] : [[ya, yb]];
      for (const [a, b] of pezzi) {
        linea(L.x - 5, a, L.x - 5, b, 2, col(CIANO));
        linea(L.x + 5, a, L.x + 5, b, 2, col(CIANO));
        for (let y = a + 4; y < b; y += 7) linea(L.x - 5, y, L.x + 5, y, 1.5, col(CIANO, 0.85));
      }
    }
    // travi a traliccio
    for (const t of M.TRAVI) {
      const sp = 8;
      c.fillStyle = col(0x2a0f05);
      c.beginPath(); c.moveTo(t.x0, t.y0); c.lineTo(t.x1, t.y1); c.lineTo(t.x1, t.y1 + sp); c.lineTo(t.x0, t.y0 + sp); c.closePath(); c.fill();
      let su = true;
      for (let x = t.x0; x < t.x1; x += 8) {
        const x2 = Math.min(t.x1, x + 8);
        const a = M.quota(t, x), b = M.quota(t, x2);
        linea(x, su ? a : a + sp, x2, su ? b + sp : b, 1.2, col(TRAVE));
        su = !su;
      }
      linea(t.x0, t.y0 + 1, t.x1, t.y1 + 1, 2, col(0xff8a4c));
      linea(t.x0, t.y0 + sp, t.x1, t.y1 + sp, 1.5, col(TRAVE));
    }
    // corpo del mainframe: armadio, due finestre per le bobine, schermo per la faccia
    c.fillStyle = col(0x1d262d); c.fillRect(14, 92, 92, 68);
    c.lineWidth = 2; c.strokeStyle = col(0x8fa3b0); c.strokeRect(15, 93, 90, 66);
    for (const x of [38, 82]) {
      c.fillStyle = col(0x0a0d10); c.beginPath(); c.arc(x, 113, 13, 0, Math.PI * 2); c.fill();
      c.lineWidth = 1; c.strokeStyle = col(0x5a6670); c.stroke();
    }
    c.fillStyle = col(0x07140b); c.fillRect(26, 131, 68, 22);
    c.lineWidth = 1; c.strokeStyle = col(NEON, 0.7); c.strokeRect(26.5, 131.5, 67, 21);
    c.fillStyle = col(0x8fa3b0); c.font = `6px ${MONO}`; c.textAlign = "right"; c.fillText("MF/0", 103, 158);
    this.textures.addCanvas("fondo", cv);
    return "fondo";
  }

  creaMainframe() {
    this.mfBobine = [38, 82].map((x) => { const b = this.add.image(x, 113, "bobina0").setScale(1.4); this.mondo.add(b); return b; });
    this.mfGiro = 0;
    this.mfLed = [];
    for (let i = 0; i < 7; i++) { const r = this.add.rectangle(22 + i * 6, 97, 3, 2, NEON); this.mondo.add(r); this.mfLed.push(r); }
    this.mfFaccia = this.add.text(60 * K, 142 * K, ">:(", { fontFamily: MONO, fontSize: "26px", color: "#39ff88" }).setOrigin(0.5);
  }

  hud() {
    const st = { fontFamily: MONO, fontSize: "26px", color: "#b9f5c1" };
    this.hudPunti = this.add.text(16, 12, "", st);
    this.hudLiv = this.add.text(480, 12, "", { ...st, color: "#ffb000" }).setOrigin(0.5, 0);
    this.hudBonus = this.add.text(944, 12, "", { ...st, color: "#ffb000" }).setOrigin(1, 0);
    this.hudVite = [0, 1, 2, 3, 4].map((i) => this.add.image(26 + i * 26, 72, "om-fermo").setScale(1.4).setOrigin(0.5, 1));
    this.hudFormato = this.add.text(480, 48, "", { ...st, fontSize: "20px", color: "#39ff88" }).setOrigin(0.5, 0);
    this.banner = this.add.text(480, 640, "", { fontFamily: MONO, fontSize: "34px", color: "#39ff88", align: "center", backgroundColor: "#05080acc", padding: { x: 18, y: 12 } })
      .setOrigin(0.5).setDepth(20).setVisible(false);

    const rec = record(SLUG);
    const comandi = TOCCO ? "croce a sinistra · SALTA a destra\n▲ e ▼ sulle scale" : "frecce o WASD · Spazio salta\n▲ e ▼ sulle scale";
    this.titolo = this.add.container(480, 610).setDepth(30);
    const testo = [
      this.add.text(0, -150, "MAINFRAME", { fontFamily: MONO, fontSize: "64px", color: "#39ff88" }).setOrigin(0.5),
      this.add.text(0, -40, "il mainframe del piano -2 è impazzito\ne fa rotolare bobine giù per l'impalcatura.\nsalta le bobine, prendi la chiavetta,\nin cima stacca la spina.", { fontFamily: MONO, fontSize: "22px", color: "#b9f5c1", align: "center", lineSpacing: 6 }).setOrigin(0.5),
      this.add.text(0, 75, comandi, { fontFamily: MONO, fontSize: "22px", color: "#ffb000", align: "center", lineSpacing: 6 }).setOrigin(0.5),
      this.add.text(0, 150, `${TOCCO ? "tocca" : "premi un tasto"} per iniziare${rec ? `\nrecord ${rec.punti} (${rec.nome})` : ""}`, { fontFamily: MONO, fontSize: "22px", color: "#9fcfa8", align: "center", lineSpacing: 6 }).setOrigin(0.5),
    ];
    const fondo = this.add.rectangle(0, 0, 820, 420, 0x05080a, 0.88).setStrokeStyle(2, NEON);
    this.titolo.add([fondo, ...testo]);
    this.tweens.add({ targets: testo[3], alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
  }

  comandi() {
    this.tasti = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Z,X,ENTER");
    this.input.keyboard.on("keydown", (e) => {
      if (this.s.fase === "attesa") { this.avvia(); return; }
      if (["Space", "KeyZ", "KeyX"].includes(e.code)) this.saltoPremuto = true;
    });
    this.input.on("pointerdown", () => this.avvia());
    alTocco = {
      avvia: () => this.avvia(),
      salto: () => { if (this.s.fase === "attesa") this.avvia(); else this.saltoPremuto = true; },
    };
  }

  avvia() {
    if (this.s.fase !== "attesa") return;
    M.avvia(this.s);
    this.titolo.setVisible(false);
  }

  leggi() {
    const t = this.tasti;
    return {
      sx: t.LEFT.isDown || t.A.isDown || tocco.sx,
      dx: t.RIGHT.isDown || t.D.isDown || tocco.dx,
      su: t.UP.isDown || t.W.isDown || tocco.su,
      giu: t.DOWN.isDown || t.S.isDown || tocco.giu,
      salto: false,
    };
  }

  avanza(n, inp) {
    for (let i = 0; i < n; i++) {
      const x = inp ? { ...inp } : this.leggi();
      if (this.saltoPremuto) { x.salto = true; this.saltoPremuto = false; }
      M.passo(this.s, x);
      if (inp) inp.salto = false;
    }
  }

  dici(testo, durata = 1400, colore = "#39ff88") {
    this.banner.setText(testo).setColor(colore).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: durata, duration: 300, onComplete: () => this.banner.setVisible(false) });
  }

  galleggia(testo, x, y, colore = "#ffb000") {
    const t = this.add.text(x * K, y * K, testo, { fontFamily: MONO, fontSize: "22px", color: colore }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  eventi() {
    const s = this.s;
    for (const e of s.eventi) {
      SUONI[e.tipo]?.();
      switch (e.tipo) {
        case "punti": this.galleggia(`+${e.punti}`, e.x, e.y); break;
        case "atterra":
          this.tweens.add({ targets: this.omino, scaleY: 0.82, scaleX: 1.15, duration: 60, yoyo: true });
          break;
        case "lancio": this.cameras.main.shake(70, 0.003); break;
        case "formattata": this.scintille.explode(14, e.x * K, e.y * K); break;
        case "usb": this.dici("FORMATTAZIONE!\nle bobine si cancellano al tocco", 1100); break;
        case "fiamma": this.scintille.explode(10, e.x * K, e.y * K); break;
        case "morte":
          this.cameras.main.shake(260, 0.012);
          this.scintille.explode(24, e.x * K, (e.y - 10) * K);
          navigator.vibrate?.(80);
          this.dici(`${MOTIVI[e.motivo] ?? "ahi"}\n${s.vite > 0 ? `vite: ${s.vite}` : "fine dei giochi"}`, 1200, "#ff8a8a");
          break;
        case "vinto": this.dici(`SPINA STACCATA!\nbonus +${e.bonus}`, 2000, "#ffb000"); this.scintille.explode(30, 284 * K, 66 * K); break;
        case "livello": this.dici(`LIVELLO ${e.livello}\nil mainframe si è riavviato da solo`, 1600); break;
        case "vita": this.dici("+1 VITA", 1000, "#ffb000"); break;
        case "fine": this.fine(); break;
      }
    }
    s.eventi.length = 0;
  }

  async fine() {
    if (this.finito) return;
    this.finito = true;
    await new Promise((r) => setTimeout(r, 700));
    await finePartita({ slug: SLUG, punti: this.s.punti, titolo: "KERNEL PANIC" });
    this.scene.restart();
  }

  disegna(time) {
    const s = this.s, o = s.omino;
    // sistemista
    let tex = "om-fermo";
    if (o.stato === "aria") tex = "om-salto";
    else if (o.stato === "scala") tex = "om-scala";
    else if (o.vx) tex = Math.floor(o.passo / 7) % 2 ? "om-passo0" : "om-passo1";
    this.omino.setTexture(tex).setPosition(o.x, o.y);
    this.omino.setFlipX(o.stato === "scala" ? Math.floor(o.passo / 6) % 2 === 1 : o.verso < 0);
    if (s.fase === "morto") {
      this.omino.setAngle(o.verso < 0 ? -90 : 90).setTint(ROSSO);
    } else {
      this.omino.setAngle(0);
      if (o.formato && Math.floor(time / 90) % 2) this.omino.setTint(0xb9ffd0); else this.omino.clearTint();
    }
    const fmt = o.formato > 0 && s.fase === "gioco";
    this.raggio.setVisible(fmt && (o.formato > 2 || Math.floor(time / 120) % 2 === 0));
    if (fmt) this.raggio.setPosition(o.x + o.verso * 13, o.y - 10).setFlipX(o.verso < 0).setAlpha(0.6 + Math.sin(time / 50) * 0.4);

    // bobine e fiamme: un pool di immagini riusate
    const pool = (arr, n, crea) => { while (arr.length < n) { const im = crea(); this.mondo.add(im); arr.push(im); } arr.forEach((im, i) => im.setVisible(i < n)); };
    pool(this.sprBobine, s.bobine.length, () => this.add.image(0, 0, "bobina0"));
    s.bobine.forEach((b, i) => {
      const im = this.sprBobine[i];
      im.setPosition(b.x, b.y - M.R).setTexture(fotogramma(b.ang));
      if (b.rossa) im.setTint(0xff6060); else im.clearTint();
    });
    pool(this.sprFiamme, s.fiamme.length, () => this.add.image(0, 0, "fiamma0").setOrigin(0.5, 1));
    s.fiamme.forEach((f, i) => this.sprFiamme[i].setTexture(Math.floor(time / 140 + i) % 2 ? "fiamma1" : "fiamma0").setPosition(f.x, f.y).setFlipX(f.dir < 0));
    this.ups.setTexture(Math.floor(time / 160) % 2 ? "fiamma1" : "fiamma0");

    s.oggetti.forEach((it, i) => this.imgOggetti[i].setVisible(!it.preso).setY(M.quota(M.TRAVI[it.g], it.x) - 12 + Math.sin(time / 300 + i) * 1.5));

    // mainframe: bobine che girano, spie, faccia sullo schermo
    const spento = s.fase === "vinto";
    if (!spento) this.mfGiro += s.carica > 0 ? 0.35 : 0.08;
    this.mfBobine.forEach((b, i) => b.setTexture(fotogramma(i ? -this.mfGiro : this.mfGiro)));
    this.mfLed.forEach((l, i) => l.setFillStyle(spento ? 0x1a1a1a : ((Math.floor(time / 180) * 7 + i * 13) % 5 < 2 ? AMBRA : NEON)));
    scrivi(this.mfFaccia, spento ? "x_x" : s.fase === "morto" ? ":)" : s.carica > 0 ? ">:O" : ">:(", spento ? "#2a4a33" : s.carica > 0 ? "#ff6b6b" : "#39ff88");
    this.spina.setPosition(spento ? 276 : 290, spento ? 74 : 66);

    // HUD
    scrivi(this.hudPunti, String(s.punti).padStart(6, "0"));
    scrivi(this.hudLiv, `LIV ${s.livello}`);
    scrivi(this.hudBonus, `BONUS ${String(s.bonus).padStart(4, "0")}`, s.bonus <= 1000 && Math.floor(time / 250) % 2 ? "#ff6b6b" : "#ffb000");
    this.hudVite.forEach((v, i) => v.setVisible(i < s.vite - (s.fase === "morto" ? 0 : 1)));
    scrivi(this.hudFormato, fmt ? `FORMAT ${"▮".repeat(Math.ceil(o.formato))}` : "");
  }

  update(time) {
    // tempo vero fra due fotogrammi: il delta di Phaser è smussato e resta ~17 ms anche a 20 fps,
    // e col delta di Phaser il gioco andrebbe al rallentatore sui telefoni lenti
    const ora = performance.now();
    const trascorso = this.ultimo ? (ora - this.ultimo) / 1000 : M.DT;
    this.ultimo = ora;
    if (!this.fermo) {
      this.acc = Math.min(this.acc + trascorso, 0.25);   // un telefono lento recupera il tempo, senza salti enormi
      const n = Math.floor(this.acc / M.DT);
      this.acc -= n * M.DT;
      if (n) this.avanza(n);
    }
    this.eventi();
    this.disegna(time);
  }
}

const game = new Phaser.Game({
  // senza smoothStep il delta di update è il tempo vero: con smoothStep resta ~17 ms anche a 30 fps
  // e su un telefono lento il gioco va al rallentatore (misurato: 29% della velocità con la CPU rallentata)
  fps: { smoothStep: false },
  type: Phaser.AUTO,
  parent: "gioco",
  backgroundColor: "#05080a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: M.W * K, height: M.H * K },
  input: { activePointers: 3 },
  scene: [Gioco],
  banner: false,
});

// per le prove automatiche (strumenti/prova.mjs)
const scena = () => game.scene.getScene("gioco");
window.game = game;
window.GIOCO = {
  stato: () => {
    const s = scena()?.s;
    if (!s) return null;
    const o = s.omino;
    return { fase: s.fase, punti: s.punti, vite: s.vite, livello: s.livello, bonus: s.bonus, x: +o.x.toFixed(1), y: +o.y.toFixed(1), g: o.g, omino: o.stato, formato: +o.formato.toFixed(1), bobine: s.bobine.length, fiamme: s.fiamme.length, fps: Math.round(game.loop.actualFps) };
  },
  avvia: () => scena().avvia(),
  ferma: () => { scena().fermo = true; },
  riprendi: () => { scena().fermo = false; },
  passo: (n = 1, inp = {}) => scena().avanza(n, { ...inp }),
  quieto: () => { scena().s.tLancio = 1e9; scena().s.carica = 0; },
  metti: (x, g) => { const o = scena().s.omino; Object.assign(o, { x, g, y: M.quota(M.TRAVI[g], x), stato: "terra", vx: 0, vy: 0, scala: null }); },
  bobina: (x, g, dir, v = 70) => { const s = scena().s; s.bobine.push({ id: ++s.id, x, y: M.quota(M.TRAVI[g], x), g, dir, stato: "rotola", v, viste: [], ang: 0 }); },
  distanza: () => { const s = scena().s; const b = s.bobine[0]; return b ? Math.abs(b.x - s.omino.x) : null; },
  colpisci: () => { const s = scena().s; GIOCO.bobina(s.omino.x + 2, s.omino.g, -1, 1); },
  tempo: (v = 1e6) => { scena().s.bonus = v; },
};
