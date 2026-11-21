// Reperibile — arcade.nerd. Phaser 4.2.1 (vendor/) disegna la sala server; il mondo sta in regole.js,
// orologio, barre e scelte dei potenziamenti sono HTML. Canvas a tutto schermo alla risoluzione vera,
// telecamera che segue il sistemista e ingrandisce in modo che il lato corto mostri circa LATO unità.
import { finePartita, record } from "../../comune/classifica.js";
import * as M from "./regole.js";

const Phaser = window.Phaser;
const SLUG = "reperibile";
const LATO = 170;
const NEON = 0x39ff88, AMBRA = 0xffb000;
const MONO = "ui-monospace, Consolas, monospace";
const TOCCO = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
if (TOCCO) document.body.classList.add("tocco");
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// --- suoni sintetizzati
let ac = null;
let ultimoSuono = {};
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
// con centinaia di nemici i suoni si accavallano: ognuno al massimo ogni tot millisecondi
function suona(k, ms, f) { const ora = performance.now(); if ((ultimoSuono[k] ?? 0) + ms > ora) return; ultimoSuono[k] = ora; f(); }
const SUONI = {
  tazza: () => suona("tazza", 90, () => nota("triangle", 520, 380, 0.05, 0.015)),
  danno: () => suona("danno", 45, () => nota("square", 180, 120, 0.03, 0.012)),
  morte: () => suona("morte", 50, () => nota("square", 300, 90, 0.07, 0.016)),
  byte: () => suona("byte", 40, () => nota("square", 1200 + Math.random() * 300, 1600, 0.04, 0.012)),
  frusta: () => nota("sawtooth", 900, 200, 0.1, 0.012),
  colpito: () => nota("sawtooth", 160, 60, 0.18, 0.05),
  livello: () => [523, 659, 784, 1047].forEach((f, i) => nota("square", f, f, 0.08, 0.03, i * 0.06)),
  scelto: () => nota("square", 784, 1568, 0.12, 0.025),
  ondata: () => [220, 196, 175].forEach((f, i) => nota("sawtooth", f, f * 0.98, 0.18, 0.03, i * 0.16)),
  boss: () => [440, 440, 440].forEach((f, i) => nota("square", f, f, 0.12, 0.035, i * 0.22)),
  cura: () => [392, 523, 659].forEach((f, i) => nota("triangle", f, f, 0.1, 0.04, i * 0.07)),
  fine: (e) => e.alba ? [523, 659, 784, 1047, 1319].forEach((f, i) => nota("square", f, f, 0.15, 0.04, i * 0.12)) : nota("sawtooth", 300, 40, 1, 0.05),
};

// --- pixel art: una riga di caratteri per riga, un carattere = un'unità
const COLORI = {
  h: 0x3b2414, s: 0xf2c08a, k: 0x111111, g: 0x23a86b, G: 0x167a4b, a: AMBRA, w: 0xf4f4f4, b: 0x2b3a5c, n: 0x15151a,
  r: 0xc04a1c, R: 0xf07a3c, z: 0x8a95a0, Z: 0x5d6770, p: 0xe58ca0, y: 0xffd23f, o: 0xff8a1f, c: 0x5a3416,
  v: NEON, V: 0xd6ffe4, t: 0xd9a35a, l: 0x4cbf4c, m: 0xe58a8a,
};
const ARTE = {
  "sis-fermo": ["....hhhhh...", "...hhhhhhh..", "...hssssss..", "..wsskssks..", "..wssssss...", "...ssssss...", "....gggg....", "..gggggggg..",
    ".gggaggggg..", ".sggggggggs.", ".s.gggggg.s.", "...bbbbbb...", "...bb..bb...", "...bb..bb...", "...bb..bb...", "..nnn..nnn.."],
  "sis-passo0": ["....hhhhh...", "...hhhhhhh..", "...hssssss..", "..wsskssks..", "..wssssss...", "...ssssss...", "....gggg....", "..gggggggg..",
    ".gggaggggg..", "sGgggggggg.s", "...gggggg...", "...bbbbbb...", "..bb....bb..", ".bb......bb.", ".bb......bb.", "nnn.....nnn."],
  "sis-passo1": ["....hhhhh...", "...hhhhhhh..", "...hssssss..", "..wsskssks..", "..wssssss...", "...ssssss...", "....gggg....", "..gggggggg..",
    ".gggaggggg..", "s.gggggggGs.", "...gggggg...", "...bbbbbb...", "....bbbb....", "....bb.bb...", "...bb..bb...", "..nnn.nnn..."],
  "bug0": [".k.....k.", "..k...k..", "..RRRRR..", ".rrrRrrr.", "krrrkrrrk", ".rrrrrrr.", "k.k...k.k"],
  "bug1": [".k.....k.", "...k.k...", "..RRRRR..", ".rrrRrrr.", "rrrrkrrrr", "krrrrrrrk", ".k.k.k.k."],
  "topo0": ["..........pp..", "...zzzzzzzzp..", "..zzzzzzzzzzk.", "tzzzzzzzzzzzzp", "t.ZZZZZZZZZZz.", "..zz.....zz...", "..k......k...."],
  "topo1": ["..........pp..", "...zzzzzzzzp..", "..zzzzzzzzzzk.", "tzzzzzzzzzzzzp", ".tZZZZZZZZZZz.", "...zz...zz....", "...k....k....."],
  "tazza": ["wwwww..", "wcccwww", "wwwww.w", "wwwwwww", ".www..."],
  "paperella": [".....yy..", "....ykyoo", "y...yyyy.", "yyyyyyyy.", ".yyyyyy.."],
  "byte": [".vv.", "vVVv", "vVvv", ".vv."],
  "panino": [".tttttt.", "tttttttt", "llllllll", "mmmmmmmm", ".tttttt."],
};

// --- levetta: si appoggia il dito dove si vuole, si trascina
const tocco = { ax: 0, ay: 0 };
let alTocco = () => {};
function levetta() {
  const box = $("#gioco"), leva = $("#leva"), pomo = leva.querySelector("i");
  let id = null, ox = 0, oy = 0;
  box.addEventListener("pointerdown", (e) => {
    alTocco();
    if (e.pointerType === "mouse") return;
    id = e.pointerId; ox = e.clientX; oy = e.clientY;
    leva.style.left = `${ox}px`; leva.style.top = `${oy}px`; leva.hidden = false;
    try { box.setPointerCapture(id); } catch { /* sintetico */ }
  });
  box.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    let dx = (e.clientX - ox) / 40, dy = (e.clientY - oy) / 40;
    const n = Math.hypot(dx, dy);
    if (n > 1) { dx /= n; dy /= n; }
    tocco.ax = n < 0.15 ? 0 : dx; tocco.ay = n < 0.15 ? 0 : dy;
    pomo.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
  });
  const lascia = (e) => { if (e.pointerId !== id) return; id = null; tocco.ax = tocco.ay = 0; leva.hidden = true; pomo.style.transform = ""; };
  box.addEventListener("pointerup", lascia);
  box.addEventListener("pointercancel", lascia);
  box.addEventListener("contextmenu", (e) => e.preventDefault());
}
levetta();

// --- HTML: barra in alto, banner, scelta dei potenziamenti
const ultimo = {};
function scrivi(sel, k, v) { if (ultimo[sel + k] === v) return; ultimo[sel + k] = v; const el = $(sel); if (k === "w") el.style.width = v; else el.textContent = v; }
let tBanner = 0;
function dici(testo, durata = 1400, colore = "#39ff88") {
  const b = $("#banner");
  b.textContent = testo; b.style.color = colore; b.hidden = false;
  b.classList.remove("entra"); void b.offsetWidth; b.classList.add("entra");
  clearTimeout(tBanner);
  tBanner = setTimeout(() => { b.hidden = true; }, durata);
}
function ahi() { const a = $("#ahi"); a.classList.add("su"); requestAnimationFrame(() => requestAnimationFrame(() => a.classList.remove("su"))); }

class Gioco extends Phaser.Scene {
  constructor() { super("gioco"); }

  init() {
    this.s = M.nuovaPartita();
    this.acc = 0; this.ultimo = 0; this.fermo = false; this.finito = false;
  }

  create() {
    this.texture();
    this.add.image(0, 0, this.pavimento()).setOrigin(0).setScale(0.5);
    this.gemme = []; this.nemici = []; this.tazze = []; this.paperelle = []; this.numeri = [];
    this.nube = this.add.image(0, 0, "nube").setVisible(false).setDepth(1);
    this.strato = { gemme: 2, nemici: 3, sis: 4, armi: 5, numeri: 8 };
    this.sis = this.add.image(0, 0, "sis-fermo").setDepth(4).setOrigin(0.5, 0.85);
    this.ombra = this.add.ellipse(0, 0, 12, 4, 0x000000, 0.35).setDepth(3.5);
    this.frusta = this.add.graphics().setDepth(5);
    this.barraBoss = this.add.graphics().setDepth(7);
    this.scintille = this.add.particles(0, 0, "scintilla", {
      speed: { min: 20, max: 70 }, lifespan: 380, scale: { start: 1, end: 0 }, emitting: false,
    }).setDepth(6);
    this.titolo();
    this.comandi();
    this.inquadra();
    this.scale.on("resize", () => this.inquadra());
    this.disegna(0);
    window.__ready = true;
  }

  inquadra() {
    const cam = this.cameras.main, w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    cam.setZoom(Math.max(1, Math.min(w, h) / LATO));
    cam.setRoundPixels(false);
  }

  texture() {
    if (this.textures.exists("byte")) return;
    const NEAREST = Phaser.Textures?.FilterMode?.NEAREST;
    const g = this.make.graphics({}, false);
    for (const [k, righe] of Object.entries(ARTE)) {
      g.clear();
      righe.forEach((riga, y) => [...riga].forEach((c, x) => { if (COLORI[c] !== undefined) g.fillStyle(COLORI[c]).fillRect(x, y, 1, 1); }));
      g.generateTexture(k, righe[0].length, righe.length);
      if (NEAREST !== undefined) this.textures.get(k).setFilter(NEAREST);
    }
    g.destroy();
    // glitch: blocchi di colore a caso, tre pose che si alternano
    for (let f = 0; f < 3; f++) {
      const cv = document.createElement("canvas"); cv.width = 22; cv.height = 22;
      const c = cv.getContext("2d");
      const tinte = ["#ff3df0", "#35f2ff", "#ffffff", "#7a2cff", "#111111"];
      for (let y = 0; y < 22; y += 2) for (let x = 0; x < 22; x += 2) {
        const d = Math.hypot(x - 10, y - 10);
        if (d > 10 + Math.random() * 2) continue;
        c.fillStyle = tinte[Math.floor(Math.random() * (d < 5 ? 5 : 4))];
        c.fillRect(x + (Math.random() < 0.15 ? 2 : 0), y, 2, 2);
      }
      c.fillStyle = "#111"; c.fillRect(6, 8, 3, 3); c.fillRect(13, 8, 3, 3);
      this.textures.addCanvas(`glitch${f}`, cv);
      if (NEAREST !== undefined) this.textures.get(`glitch${f}`).setFilter(NEAREST);
    }
    // ticket urgente: un foglio rosso con il punto esclamativo
    for (let f = 0; f < 2; f++) {
      const cv = document.createElement("canvas"); cv.width = 34 * 4; cv.height = 40 * 4;
      const c = cv.getContext("2d"); c.scale(4, 4);
      c.translate(17, 20); c.rotate(f ? 0.06 : -0.06); c.translate(-17, -20);
      c.fillStyle = "#f2f2ee"; c.fillRect(3, 2, 28, 36);
      c.fillStyle = "#d8343a"; c.fillRect(3, 2, 28, 9);
      c.fillStyle = "#fff"; c.font = `bold 5px ${MONO}`; c.textAlign = "center"; c.fillText("URGENTE", 17, 9);
      c.fillStyle = "#d8343a"; c.font = `bold 20px ${MONO}`; c.fillText("!", 17, 32);
      c.fillStyle = "#aab"; for (let y = 14; y < 36; y += 4) c.fillRect(7, y, f ? 8 : 6, 1);
      c.strokeStyle = "#222"; c.lineWidth = 0.8; c.strokeRect(3, 2, 28, 36);
      c.fillStyle = "#111"; c.fillRect(9, 15, 4, 4); c.fillRect(21, 15, 4, 4);
      this.textures.addCanvas(`ticket${f}`, cv);
    }
    // nube dell'estintore, scintilla
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d"), gr = c.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, "rgba(220,240,255,0.55)"); gr.addColorStop(0.7, "rgba(200,230,255,0.35)"); gr.addColorStop(1, "rgba(200,230,255,0)");
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    this.textures.addCanvas("nube", cv);
    const sc = document.createElement("canvas"); sc.width = sc.height = 2;
    sc.getContext("2d").fillStyle = "#fff"; sc.getContext("2d").fillRect(0, 0, 2, 2);
    this.textures.addCanvas("scintilla", sc);
  }

  // pavimento flottante della sala server, armadi lungo le pareti: disegnato una volta, 2 pixel per unità
  pavimento() {
    if (this.textures.exists("pavimento")) return "pavimento";
    const R = 2, cv = document.createElement("canvas");
    cv.width = M.W * R; cv.height = M.H * R;
    const c = cv.getContext("2d");
    c.scale(R, R);
    c.fillStyle = "#1a2328"; c.fillRect(0, 0, M.W, M.H);
    for (let y = 0; y < M.H; y += 40) for (let x = 0; x < M.W; x += 40) {
      const forata = ((x / 40) * 7 + (y / 40) * 3) % 9 === 0;
      c.fillStyle = forata ? "#222f36" : "#1e282e"; c.fillRect(x + 1, y + 1, 38, 38);
      c.strokeStyle = "#0b1013"; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, 39, 39);
      if (forata) { c.fillStyle = "#0c1215"; for (let i = 6; i < 36; i += 5) for (let j = 6; j < 36; j += 5) c.fillRect(x + i, y + j, 2, 2); }
    }
    // nastro giallo e nero a terra, corsie di passaggio
    const nastro = (x0, y0, x1, y1) => {
      c.save(); c.lineWidth = 3; c.setLineDash([6, 6]);
      c.strokeStyle = "#c9a100"; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.lineDashOffset = 6; c.strokeStyle = "#151515"; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
    };
    for (const v of [360, 700, 1040]) { nastro(v, 60, v, M.H - 60); nastro(60, v, M.W - 60, v); }
    // armadi rack lungo le pareti, con le spie
    const rack = (x, y, w, h) => {
      c.fillStyle = "#0a0f12"; c.fillRect(x, y, w, h);
      c.strokeStyle = "#26343c"; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      for (let i = 4; i < Math.max(w, h) - 4; i += 6) {
        const verde = (i * 13 + x + y) % 5 < 2;
        c.fillStyle = verde ? "rgba(57,255,136,0.7)" : "rgba(255,176,0,0.5)";
        if (w > h) c.fillRect(x + i, y + h / 2, 2, 2); else c.fillRect(x + w / 2, y + i, 2, 2);
      }
    };
    for (let x = 30; x < M.W - 60; x += 64) { rack(x, 2, 56, 16); rack(x, M.H - 18, 56, 16); }
    for (let y = 30; y < M.H - 60; y += 64) { rack(2, y, 16, 56); rack(M.W - 18, y, 16, 56); }
    this.textures.addCanvas("pavimento", cv);
    return "pavimento";
  }

  titolo() {
    const rec = record(SLUG);
    $("#titolo .via").textContent = TOCCO ? "tocca per iniziare" : "premi un tasto per iniziare";
    $("#titolo .rec").textContent = rec ? `record ${rec.punti} (${rec.nome})` : "";
    $("#titolo").hidden = false;
    $("#titolo").onclick = () => this.avvia();
  }

  comandi() {
    this.tasti = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,ONE,TWO,THREE,ENTER,SPACE");
    this.input.keyboard.on("keydown", (e) => {
      if (this.s.fase === "attesa") { this.avvia(); return; }
      if (this.s.fase === "scelta") {
        const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
        if (i !== undefined) this.scegli(i);
        if (e.code === "ArrowDown" || e.code === "ArrowUp") this.evidenzia(e.code === "ArrowDown" ? 1 : -1);
        if (e.code === "Enter" || e.code === "Space") this.scegli(this.su ?? 0);
      }
    });
    alTocco = () => this.avvia();
  }

  avvia() {
    if (this.s.fase !== "attesa") return;
    nota("square", 440, 880, 0.1, 0.02);
    M.avvia(this.s);
    $("#titolo").hidden = true;
  }

  mostraScelte() {
    if (this.s.fase !== "scelta" || !this.s.scelte.length) return;
    const carte = $("#carte");
    carte.innerHTML = "";
    this.su = 0;
    this.s.scelte.forEach((o, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "carta" + (i === 0 ? " su" : "");
      const livello = o.tipo === "cura" ? "" : o.nuova ? "nuova" : `liv ${o.liv}`;
      b.innerHTML = `<kbd>${i + 1}</kbd><b></b><span></span>`;
      b.querySelector("b").textContent = o.nome;
      if (livello) { const em = document.createElement("em"); em.textContent = livello; b.querySelector("b").append(em); }
      b.querySelector("span").textContent = o.testo;
      b.addEventListener("click", () => this.scegli(i));
      carte.append(b);
    });
    $("#scelta").hidden = false;
  }
  evidenzia(d) {
    const l = [...document.querySelectorAll(".carta")];
    this.su = (this.su + d + l.length) % l.length;
    l.forEach((c, i) => c.classList.toggle("su", i === this.su));
  }
  scegli(i) {
    if (this.s.fase !== "scelta") return;
    M.scegli(this.s, i);
    $("#scelta").hidden = true;
  }

  leggi() {
    const t = this.tasti;
    return { sx: t.LEFT.isDown || t.A.isDown, dx: t.RIGHT.isDown || t.D.isDown, su: t.UP.isDown || t.W.isDown, giu: t.DOWN.isDown || t.S.isDown, ax: tocco.ax, ay: tocco.ay };
  }

  avanza(n, inp) {
    for (let i = 0; i < n && this.s.fase === "gioco"; i++) M.passo(this.s, inp ? { ...inp } : this.leggi());
  }

  eventi() {
    const s = this.s;
    let numeri = 0;
    for (const e of s.eventi) {
      SUONI[e.tipo]?.(e);
      switch (e.tipo) {
        case "danno":
          if (numeri++ < 6) this.numero(e.x, e.y, e.n);
          break;
        case "morte": this.scintille.setParticleTint?.(e.nem === "glitch" ? 0xff3df0 : e.nem === "topo" ? 0x8a95a0 : 0xc0582a); this.scintille.explode(e.nem === "ticket" ? 40 : 6, e.x, e.y); if (e.nem === "ticket") { this.cameras.main.shake(300, 0.01); dici("TICKET CHIUSO!", 1400, "#ffb000"); } break;
        case "colpito": this.cameras.main.shake(120, 0.006); ahi(); navigator.vibrate?.(30); break;
        case "livello": this.mostraScelte(); break;
        case "ondata": dici(`${e.ora}\narriva lo sciame`, 1300, "#ff8a8a"); break;
        case "boss": dici("TICKET URGENTE!\nchiudilo prima che chiuda te", 1800, "#ff6b6b"); break;
        case "cura": dici("+50 vita", 700); break;
        case "fine":
          if (e.alba) dici("06:00 — ALBA!\nturno finito, +3000", 2400, "#ffb000");
          this.fine(e.alba);
          break;
      }
    }
    s.eventi.length = 0;
  }

  numero(x, y, n) {
    let t = this.numeri.find((q) => !q.visible);
    if (!t) {
      if (this.numeri.length >= 30) return;
      t = this.add.text(0, 0, "", { fontFamily: MONO, fontSize: "40px", color: "#ffffff", stroke: "#000000", strokeThickness: 8 }).setOrigin(0.5).setScale(0.12).setDepth(8);
      this.numeri.push(t);
    }
    t.setText(String(n)).setPosition(x, y).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 500, onComplete: () => t.setVisible(false) });
  }

  async fine(alba) {
    if (this.finito) return;
    this.finito = true;
    await new Promise((r) => setTimeout(r, alba ? 2400 : 900));
    await finePartita({ slug: SLUG, punti: this.s.punti, titolo: alba ? "TURNO FINITO" : "CROLLATO ALLE " + M.ora(this.s) });
    this.scene.restart();
  }

  pool(arr, n, crea) {
    while (arr.length < n) arr.push(crea());
    for (let i = 0; i < arr.length; i++) arr[i].setVisible(i < n);
  }

  disegna(time) {
    const s = this.s, p = s.p, cam = this.cameras.main;
    cam.centerOn(p.x, p.y);

    // sistemista
    const corre = Math.hypot(p.vx, p.vy) > 5;
    this.sis.setTexture(corre ? (Math.floor(p.passo / 9) % 2 ? "sis-passo0" : "sis-passo1") : "sis-fermo")
      .setPosition(p.x, p.y).setFlipX(p.fx < 0).setAlpha(p.inv > 0 && Math.floor(time / 60) % 2 ? 0.45 : 1);
    this.ombra.setPosition(p.x, p.y + 2);

    // nemici
    this.pool(this.nemici, s.nemici.length, () => this.add.image(0, 0, "bug0").setDepth(3));
    s.nemici.forEach((e, i) => {
      const im = this.nemici[i];
      const f = Math.floor(e.passo / 5) % 2;
      const k = e.tipo === "glitch" ? `glitch${Math.floor(time / 120 + e.id) % 3}` : e.tipo === "ticket" ? `ticket${Math.floor(time / 300) % 2}` : `${e.tipo}${f}`;
      im.setTexture(k).setPosition(e.x, e.y).setFlipX(e.fx < 0);
      im.setScale(e.tipo === "ticket" ? 0.25 * 1.2 : 1);
      if (e.lampo > 0) { im.setTint(0xffffff); if (Phaser.TintModes) im.setTintMode(Phaser.TintModes.FILL); }
      else if (e.lento > 0) { im.setTint(0x9fd8ff); if (Phaser.TintModes) im.setTintMode(Phaser.TintModes.MULTIPLY); }
      else { im.clearTint(); if (Phaser.TintModes) im.setTintMode(Phaser.TintModes.MULTIPLY); }
    });
    // barra della vita del ticket
    this.barraBoss.clear();
    for (const e of s.nemici) if (e.boss) {
      this.barraBoss.fillStyle(0x000000, 0.7).fillRect(e.x - 16, e.y - 30, 32, 4);
      this.barraBoss.fillStyle(0xff4f4f).fillRect(e.x - 15.5, e.y - 29.5, 31 * Math.max(0, e.hp / e.max), 3);
    }

    // byte e panini
    this.pool(this.gemme, s.gemme.length, () => this.add.image(0, 0, "byte").setDepth(2));
    s.gemme.forEach((g, i) => this.gemme[i].setTexture(g.cura ? "panino" : "byte").setPosition(g.x, g.y + Math.sin(time / 200 + i) * 0.8).setScale(g.v >= 5 ? 1.6 : 1));

    // tazze, paperelle, frustate, nube
    this.pool(this.tazze, s.tazze.length, () => this.add.image(0, 0, "tazza").setDepth(5));
    s.tazze.forEach((t, i) => this.tazze[i].setPosition(t.x, t.y).setRotation(t.ang));
    const pap = s.paperelle ?? [];
    this.pool(this.paperelle, pap.length, () => this.add.image(0, 0, "paperella").setDepth(5));
    pap.forEach((q, i) => this.paperelle[i].setPosition(q.x, q.y).setFlipX(Math.sin(q.a) > 0));
    this.frusta.clear();
    for (const f of s.frustate) {
      const ux = Math.cos(f.a), uy = Math.sin(f.a), nx = -uy, ny = ux, al = f.vita / 0.2;
      this.frusta.lineStyle(3, 0x2f7bff, al).beginPath();
      for (let i = 0; i <= 12; i++) {
        const d = (i / 12) * f.L, o = Math.sin(i * 1.3 + time / 30) * 4 * (i / 12);
        const x = p.x + ux * d + nx * o, y = p.y + uy * d + ny * o;
        if (i) this.frusta.lineTo(x, y); else this.frusta.moveTo(x, y);
      }
      this.frusta.strokePath();
      this.frusta.fillStyle(0xd9d9d9, al).fillRect(p.x + ux * f.L - 2, p.y + uy * f.L - 2, 4, 4);
    }
    const est = s.armi.estintore;
    if (est) {
      const R = M.ARMI.estintore.raggio[est - 1];
      this.nube.setVisible(true).setPosition(p.x, p.y).setDisplaySize(R * 2.3, R * 2.3).setAlpha(0.55 + Math.sin(time / 140) * 0.15).setRotation(time / 900);
    } else this.nube.setVisible(false);

    // il pannello di scelta esiste solo durante la scelta
    const scelta = $("#scelta");
    if (s.fase !== "scelta" && !scelta.hidden) scelta.hidden = true;
    // barra in alto
    scrivi("#ora", "t", M.ora(s));
    scrivi("#vita i", "w", `${Math.max(0, (p.hp / p.max) * 100).toFixed(1)}%`);
    scrivi("#exp i", "w", `${Math.min(100, (p.xp / p.prossimo) * 100).toFixed(1)}%`);
    scrivi("#livello", "t", `liv ${p.liv}`);
    scrivi("#uccisi", "t", `${s.uccisi} ✝ · ${s.punti}`);
  }

  update(time) {
    // tempo vero fra due fotogrammi (vedi Mainframe): sui telefoni lenti niente rallentatore
    const ora = performance.now();
    const trascorso = this.ultimo ? (ora - this.ultimo) / 1000 : M.DT;
    this.ultimo = ora;
    if (!this.fermo) {
      this.acc = Math.min(this.acc + trascorso, 0.25);
      const n = Math.floor(this.acc / M.DT);
      this.acc -= n * M.DT;
      if (n) this.avanza(n);
    }
    this.eventi();
    this.disegna(time);
  }
}

// canvas alla risoluzione vera dello schermo (fino a 2x), grande quanto lo spazio libero
const box = $("#gioco");
const DPR = Math.min(2, devicePixelRatio || 1);
const misura = () => { const r = box.getBoundingClientRect(); return [Math.max(1, Math.round(r.width * DPR)), Math.max(1, Math.round(r.height * DPR))]; };
const [W0, H0] = misura();
const game = new Phaser.Game({
  fps: { smoothStep: false },
  type: Phaser.AUTO,
  parent: "gioco",
  backgroundColor: "#05080a",
  pixelArt: false,
  scale: { mode: Phaser.Scale.NONE, width: W0, height: H0, zoom: 1 / DPR },
  input: { activePointers: 2 },
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
    return { fase: s.fase, t: +s.t.toFixed(2), ora: M.ora(s), hp: +s.p.hp.toFixed(1), liv: s.p.liv, xp: s.p.xp, x: +s.p.x.toFixed(1), y: +s.p.y.toFixed(1),
      nemici: s.nemici.length, uccisi: s.uccisi, punti: s.punti, armi: { ...s.armi }, scelte: s.scelte.map((o) => o.k), fps: Math.round(game.loop.actualFps) };
  },
  avvia: () => scena().avvia(),
  ferma: () => { scena().fermo = true; },
  riprendi: () => { scena().fermo = false; },
  passo: (n = 1, inp = {}) => scena().avanza(n, inp),
  scegli: (i) => scena().scegli(i),
  xp: (n) => { scena().s.p.xp += n; },
  livello: () => { const p = scena().s.p; p.xp = p.prossimo; },
  tempo: (t) => { scena().s.t = t; },
  vita: (hp) => { scena().s.p.hp = hp; },
  svuota: () => { scena().s.nemici = []; },
};
