// Luna Park — arcade.nerd. Tiro al bersaglio a volo nel baraccone di un luna park nerd, di notte.
// I bersagli (floppy volanti, piccioni di latta, chiavetta d'oro) si alzano da dietro il bancone e
// svolazzano; 3 colpi per volo, 10 bersagli per round, per passare ne servono almeno 6, poi 7, poi 8.
// Phaser 4.2.1 (vendor/), grafica e suoni fatti dal codice.
import { finePartita, record } from "../../comune/classifica.js";

const Phaser = window.Phaser;
const SLUG = "luna-park";
const NEON = 0x39ff88, AMBRA = 0xffb000, MAGENTA = 0xff4fb3, CIANO = 0x4fc3ff;

// --- regole, senza Phaser
const TIPI = {
  floppy:   { punti: 100, vel: 1.0, raggio: 30 },
  piccione: { punti: 150, vel: 1.15, raggio: 30 },
  usb:      { punti: 500, vel: 1.5, raggio: 24 },
};
const regole = {
  richiesti: (round) => (round <= 2 ? 6 : round <= 5 ? 7 : 8),
  perVolo: (round) => (round <= 2 ? 1 : 2),
  durata: (round) => Math.max(3.0, 6.4 - round * 0.35),           // secondi prima che scappi
  velocita: (round, lato) => lato * 0.34 * Math.min(2.3, 1 + (round - 1) * 0.13),
  tipo: () => { const x = Math.random(); return x < 0.05 ? "usb" : x < 0.35 ? "piccione" : "floppy"; },
  valore: (tipo, round) => Math.round(TIPI[tipo].punti * (1 + (round - 1) * 0.5)),
};

// --- suoni
let ac = null;
function suono(tipo) {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    const nota = (forma, f1, f2, dur, vol, ritardo = 0) => {
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = forma;
      o.frequency.setValueAtTime(f1, t + ritardo);
      o.frequency.exponentialRampToValueAtTime(f2, t + ritardo + dur);
      v.gain.setValueAtTime(vol, t + ritardo);
      v.gain.exponentialRampToValueAtTime(0.0001, t + ritardo + dur);
      o.connect(v).connect(ac.destination);
      o.start(t + ritardo); o.stop(t + ritardo + dur + 0.02);
    };
    if (tipo === "sparo") { nota("square", 220, 55, 0.12, 0.07); nota("sawtooth", 1800, 300, 0.05, 0.03); }
    if (tipo === "latta") { nota("triangle", 1250, 900, 0.25, 0.08); nota("square", 2500, 1800, 0.08, 0.02); }
    if (tipo === "colpito") { nota("square", 660, 1320, 0.09, 0.05); }
    if (tipo === "oro") { [988, 1319, 1568, 1976].forEach((f, i) => nota("square", f, f, 0.08, 0.04, i * 0.07)); }
    if (tipo === "fuga") { nota("triangle", 500, 1400, 0.35, 0.05); }
    if (tipo === "round") { [523, 659, 784, 1047].forEach((f, i) => nota("square", f, f, 0.1, 0.04, i * 0.1)); }
    if (tipo === "fine") { [392, 330, 262, 196].forEach((f, i) => nota("triangle", f, f * 0.98, 0.22, 0.06, i * 0.2)); }
  } catch { /* niente audio */ }
}

class Baraccone extends Phaser.Scene {
  constructor() { super("baraccone"); }

  init() {
    this.S = { fase: "attesa", round: 1, k: 0, esiti: Array(10).fill(null), colpi: 3, punti: 0, timer: 0, colpitiRound: 0 };
    this.bersagli = [];
    this.fermo = 0;           // hit-stop: per qualche centesimo i bersagli si fermano
  }

  create() {
    this.texture();
    this.fondo = this.add.graphics().setDepth(0);
    this.luci = [];
    this.bancone = this.add.graphics().setDepth(20);

    const stile = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "18px", color: "#b9f5c1" };
    this.stile = stile;
    this.hudPunti = this.add.text(0, 0, "", { ...stile, fontSize: "20px", color: "#ffb000" }).setOrigin(1, 0.5).setDepth(31);
    this.hudRound = this.add.text(0, 0, "", { ...stile, fontSize: "16px" }).setOrigin(0, 0.5).setDepth(31);
    this.hudColpi = this.add.container(0, 0).setDepth(31);
    this.hudEsiti = this.add.container(0, 0).setDepth(31);
    this.cartello = this.add.text(0, 0, "", { ...stile, fontSize: "30px", color: "#39ff88", align: "center", stroke: "#05080a", strokeThickness: 6 })
      .setOrigin(0.5).setDepth(40);

    this.robot = this.creaRobot().setDepth(19);
    this.fumetto = this.add.text(0, 0, "", { ...stile, fontSize: "15px", color: "#05080a", backgroundColor: "#d6ffd9", padding: { x: 8, y: 5 } })
      .setOrigin(1, 1).setDepth(25).setVisible(false);

    this.coriandoli = this.add.particles(0, 0, "punto", {
      speed: { min: 90, max: 280 }, lifespan: 700, gravityY: 500, scale: { start: 1.1, end: 0.3 },
      tint: [NEON, AMBRA, MAGENTA, CIANO], emitting: false,
    }).setDepth(15);
    this.polvere = this.add.particles(0, 0, "punto", {
      speed: { min: 20, max: 70 }, lifespan: 380, scale: { start: 0.9, end: 0 }, alpha: { start: 0.6, end: 0 }, tint: 0x8fa3b0, emitting: false,
    }).setDepth(15);

    // mirino: segue il mouse; col dito compare dove si tocca
    this.mirino = this.add.image(0, 0, "mirino").setDepth(50).setVisible(false);
    this.touch = this.sys.game.device.input.touch && !window.matchMedia("(pointer: fine)").matches;
    this.input.on("pointermove", (p) => { if (p.pointerType !== "touch") { this.mirino.setVisible(true).setPosition(p.x, p.y); } });
    this.input.on("pointerdown", (p) => this.tocco(p.x, p.y, p.pointerType === "touch"));
    // tastiera: frecce spostano il mirino, Spazio spara
    this.tasti = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,SPACE,ENTER");
    this.input.keyboard.on("keydown-SPACE", () => { this.mirino.setVisible(true); this.tocco(this.mirino.x, this.mirino.y, false); });
    this.input.keyboard.on("keydown-ENTER", () => { if (this.S.fase === "attesa") this.inizia(); });

    this.scale.on("resize", this.impagina, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.impagina, this));
    this.impagina();
    this.mirino.setPosition(this.scale.width / 2, this.scale.height * 0.45);

    const rec = record(SLUG);
    this.mostraCartello(`LUNA PARK\n\n${this.touch ? "tocca i bersagli" : "mira col mouse e clicca\n(o frecce + Spazio)"}\n3 colpi per volo · servono 6 su 10\n\n${rec ? `record ${rec.punti} · ${rec.nome}\n\n` : ""}${this.touch ? "tocca per iniziare" : "clicca o premi Invio"}`, 0, 22);
    if (this.cielo > 360) this.parla("Avanti, avanti! Tre colpi e un premio!", 0);   // su schermi bassi coprirebbe il cartello
    window.__ready = true;
  }

  // --- disegni
  texture() {
    if (this.textures.exists("floppy")) return;
    const g = this.make.graphics({}, false);
    // floppy 3,5": corpo, otturatore di metallo, etichetta
    g.fillStyle(0x1b3a6b).fillRoundedRect(4, 4, 48, 48, 4);
    g.lineStyle(2, 0x0a1830).strokeRoundedRect(4, 4, 48, 48, 4);
    g.fillStyle(0xc9d3dc).fillRect(16, 4, 22, 16);
    g.fillStyle(0x1b3a6b).fillRect(30, 7, 5, 10);
    g.fillStyle(0xf2f2e6).fillRect(10, 27, 36, 22);
    g.lineStyle(1, 0xb03a3a).lineBetween(13, 33, 43, 33).lineBetween(13, 39, 43, 39);
    g.generateTexture("floppy", 56, 56);
    g.clear();
    // piccione di latta, di profilo, con i rivetti
    g.fillStyle(0x9aa6ad).fillPoints([{ x: 4, y: 26 }, { x: 18, y: 16 }, { x: 34, y: 14 }, { x: 44, y: 6 }, { x: 54, y: 8 }, { x: 58, y: 14 }, { x: 50, y: 16 },
      { x: 48, y: 26 }, { x: 40, y: 36 }, { x: 22, y: 40 }, { x: 10, y: 36 }], true);
    g.lineStyle(2, 0x4b565c).strokePoints([{ x: 4, y: 26 }, { x: 18, y: 16 }, { x: 34, y: 14 }, { x: 44, y: 6 }, { x: 54, y: 8 }, { x: 58, y: 14 }, { x: 50, y: 16 },
      { x: 48, y: 26 }, { x: 40, y: 36 }, { x: 22, y: 40 }, { x: 10, y: 36 }], true, true);
    g.fillStyle(0xff4fb3).fillTriangle(58, 12, 64, 13, 58, 15);
    g.fillStyle(0x05080a).fillCircle(51, 11, 2);
    g.fillStyle(0x6f7b80).fillCircle(20, 30, 2).fillCircle(30, 30, 2).fillCircle(40, 27, 2);
    g.lineStyle(3, 0x4b565c).lineBetween(28, 40, 28, 48);
    g.fillStyle(0x4b565c).fillRect(20, 46, 16, 4);
    g.generateTexture("piccione", 66, 52);
    g.clear();
    // chiavetta USB d'oro
    g.fillStyle(0xffc531).fillRoundedRect(4, 10, 30, 18, 4);
    g.lineStyle(2, 0x9c6b00).strokeRoundedRect(4, 10, 30, 18, 4);
    g.fillStyle(0xd9dde0).fillRect(34, 13, 12, 12);
    g.fillStyle(0x6f7b80).fillRect(38, 16, 3, 3).fillRect(38, 20, 3, 3);
    g.fillStyle(0xffffff, 0.6).fillRect(8, 13, 18, 3);
    g.generateTexture("usb", 50, 38);
    g.clear();
    // ala (si sbatte scalandola in verticale)
    g.fillStyle(0xeaf3ff).fillPoints([{ x: 0, y: 20 }, { x: 14, y: 2 }, { x: 30, y: 0 }, { x: 22, y: 10 }, { x: 28, y: 12 }, { x: 16, y: 20 }], true);
    g.lineStyle(1.5, 0x8aa0b8).strokePoints([{ x: 0, y: 20 }, { x: 14, y: 2 }, { x: 30, y: 0 }, { x: 22, y: 10 }, { x: 28, y: 12 }, { x: 16, y: 20 }], true, true);
    g.generateTexture("ala", 31, 22);
    g.clear();
    // mirino
    g.lineStyle(3, NEON).strokeCircle(24, 24, 15);
    g.lineStyle(2, NEON).lineBetween(24, 0, 24, 14).lineBetween(24, 34, 24, 48).lineBetween(0, 24, 14, 24).lineBetween(34, 24, 48, 24);
    g.fillStyle(MAGENTA).fillCircle(24, 24, 2.5);
    g.generateTexture("mirino", 48, 48);
    g.clear();
    g.fillStyle(0xffffff).fillRect(0, 0, 6, 6);
    g.generateTexture("punto", 6, 6);
    g.clear();
    // cartuccia per l'HUD
    g.fillStyle(0xd33a3a).fillRoundedRect(0, 6, 12, 22, 2);
    g.fillStyle(0xc9a227).fillRect(0, 22, 12, 8);
    g.generateTexture("cartuccia", 12, 30);
    g.destroy();
  }

  creaRobot() {
    // il gestore del baraccone: un robottino dietro il bancone, nostro
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x2d3237).fillRoundedRect(-26, -48, 52, 42, 8);
    g.lineStyle(2, NEON).strokeRoundedRect(-26, -48, 52, 42, 8);
    g.fillStyle(0x0a0f0b).fillRoundedRect(-19, -40, 38, 20, 4);
    g.lineStyle(2, NEON).lineBetween(0, -48, 0, -60);
    g.fillStyle(MAGENTA).fillCircle(0, -62, 4);
    g.fillStyle(0x2d3237).fillRect(-18, -6, 36, 30);
    c.add(g);
    this.occhi = this.add.text(0, -30, "^ ^", { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "15px", color: "#39ff88" }).setOrigin(0.5);
    c.add(this.occhi);
    return c;
  }

  impagina() {
    const { width: w, height: h } = this.scale;
    this.lato = Math.min(w, h);
    this.altoBancone = Math.max(96, Math.round(h * 0.2));
    this.cielo = h - this.altoBancone;
    this.physics?.world?.setBounds?.(0, 0, w, h);

    // fondo: cielo di notte, tendone a strisce, lucine
    const f = this.fondo.clear();
    f.fillGradientStyle(0x0b1022, 0x0b1022, 0x1a0f2a, 0x1a0f2a, 1).fillRect(0, 0, w, h);
    f.fillStyle(0xffffff, 0.35);
    for (let i = 0; i < 40; i++) f.fillRect((i * 9973) % w, ((i * 7919) % Math.max(1, this.cielo * 0.7)), 1.5, 1.5);
    const tenda = Math.max(28, h * 0.07), strisce = Math.ceil(w / 60);
    for (let i = 0; i < strisce; i++) {
      f.fillStyle(i % 2 ? 0x1f8a52 : 0xe8e3d0).fillRect(i * 60, 0, 60, tenda);
      f.fillStyle(i % 2 ? 0x1f8a52 : 0xe8e3d0).fillTriangle(i * 60, tenda, i * 60 + 60, tenda, i * 60 + 30, tenda + 16);
    }
    for (const l of this.luci) l.destroy();
    this.luci = [];
    const n = Math.ceil(w / 46);
    for (let i = 0; i < n; i++) {
      const x = i * 46 + 23;
      const l = this.add.circle(x, tenda + 26 + Math.sin(i * 0.9) * 6, 4, [AMBRA, MAGENTA, NEON, CIANO][i % 4]).setDepth(1);
      this.tweens.add({ targets: l, alpha: 0.25, duration: 500 + (i % 5) * 120, yoyo: true, repeat: -1, delay: i * 60 });
      this.luci.push(l);
    }
    // scaffale dei premi sullo sfondo
    f.fillStyle(0x2a1d14).fillRect(0, this.cielo - 34, w, 10);
    for (let x = 30; x < w; x += 70) {
      f.fillStyle([0x7a4fd1, 0x2f9d6a, 0xc0433d, 0x2b6cb0][Math.floor(x / 70) % 4], 0.8).fillCircle(x, this.cielo - 46, 12).fillCircle(x, this.cielo - 62, 8);
    }

    // bancone di legno
    const b = this.bancone.clear();
    b.fillStyle(0x5b3a22).fillRect(0, this.cielo, w, this.altoBancone);
    b.fillStyle(0x7a5032).fillRect(0, this.cielo, w, 12);
    b.lineStyle(1, 0x3d2616, 0.8);
    for (let y = this.cielo + 26; y < h; y += 16) b.lineBetween(0, y, w, y);
    b.fillStyle(0x0b130d, 0.88).fillRoundedRect(10, this.cielo + 22, w - 20, Math.min(70, this.altoBancone - 34), 8);

    const yHud = this.cielo + 22 + Math.min(70, this.altoBancone - 34) / 2;
    this.hudRound.setPosition(24, yHud - 14);
    this.hudPunti.setPosition(w - 24, yHud - 14);
    this.hudColpi.setPosition(24, yHud + 4);
    this.hudEsiti.setPosition(Math.max(150, w / 2 - 125), yHud + 18);
    this.robot.setPosition(w - 70, this.cielo + 2);
    this.fumetto.setPosition(w - 12, this.cielo - 76).setWordWrapWidth(Math.min(280, w - 40));
    this.cartello.setPosition(w / 2, this.cielo * 0.52);
    this.cartello.setFontSize(this.misuraCartello(30));
    this.aggiornaHud();
  }

  aggiornaHud() {
    const S = this.S;
    this.hudPunti.setText(String(S.punti).padStart(6, "0"));
    this.hudRound.setText(`R${S.round}  serve ${regole.richiesti(S.round)}/10`);
    this.hudColpi.removeAll(true);
    for (let i = 0; i < 3; i++) this.hudColpi.add(this.add.image(i * 16, 8, "cartuccia").setOrigin(0, 0.5).setAlpha(i < S.colpi ? 1 : 0.18));
    this.hudEsiti.removeAll(true);
    const passo = Math.min(25, (this.scale.width - 220) / 10);
    S.esiti.forEach((e, i) => {
      const col = e === "ok" ? NEON : e === "no" ? 0xd33a3a : 0x3a4a3e;
      const q = this.add.rectangle(i * passo, 0, passo - 5, 12, col).setOrigin(0, 0.5);
      if (i === regole.richiesti(S.round) - 1) q.setStrokeStyle(2, AMBRA);
      this.hudEsiti.add(q);
    });
  }

  // il cartello sta nel cielo anche su un telefono in orizzontale
  misuraCartello(massimo) {
    return Math.round(Math.max(13, Math.min(massimo, this.scale.width / 22, this.cielo / 13)));
  }

  mostraCartello(testo, durata = 1400, dimensione) {
    this.cartello.setText(testo).setVisible(true).setScale(0.6).setAlpha(1);
    this.cartello.setFontSize(this.misuraCartello(dimensione ?? 30));
    this.tweens.add({ targets: this.cartello, scale: 1, duration: 260, ease: "Back.Out" });
    if (durata) this.time.delayedCall(durata, () => this.tweens.add({ targets: this.cartello, alpha: 0, duration: 200, onComplete: () => this.cartello.setVisible(false) }));
  }

  parla(frase, durata = 1300) {
    this.fumetto.setText(frase).setVisible(true);
    this.tweens.killTweensOf(this.robot);
    this.tweens.add({ targets: this.robot, y: this.cielo - 26, duration: 160, ease: "Back.Out" });
    if (durata) this.time.delayedCall(durata, () => {
      this.fumetto.setVisible(false);
      this.tweens.add({ targets: this.robot, y: this.cielo + 2, duration: 200 });
    });
  }

  // --- partita
  inizia() {
    if (this.S.fase !== "attesa") return;
    this.cartello.setVisible(false);
    this.fumetto.setVisible(false);
    this.tweens.add({ targets: this.robot, y: this.cielo + 2, duration: 200 });
    this.S.fase = "pausa";
    this.mostraCartello(`ROUND ${this.S.round}`, 900);
    suono("round");
    this.time.delayedCall(1100, () => this.volo());
  }

  volo() {
    const S = this.S;
    const n = Math.min(regole.perVolo(S.round), 10 - S.k);
    S.colpi = 3;
    S.timer = regole.durata(S.round);
    S.fase = "volo";
    const { width: w } = this.scale;
    for (let i = 0; i < n; i++) {
      const tipo = regole.tipo();
      const x = Phaser.Math.Between(w * 0.2, w * 0.8);
      const c = this.add.container(x, this.cielo + 30).setDepth(10);
      const corpo = this.add.image(0, 0, tipo);
      if (tipo !== "piccione") {
        const sx = this.add.image(-6, -10, "ala").setOrigin(1, 1).setFlipX(true);
        const dx = this.add.image(6, -10, "ala").setOrigin(0, 1);
        if (tipo === "usb") { sx.setTint(0xffe08a); dx.setTint(0xffe08a); }
        c.add([sx, dx]);
        this.tweens.add({ targets: [sx, dx], scaleY: -0.4, duration: 110, yoyo: true, repeat: -1 });
      }
      c.add(corpo);
      const v = regole.velocita(S.round, this.lato) * TIPI[tipo].vel;
      const ang = Phaser.Math.FloatBetween(-2.4, -0.75);     // verso l'alto, a destra o a sinistra
      const b = { c, tipo, indice: S.k + i, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, v, stato: "vola", svolta: Phaser.Math.FloatBetween(0.5, 1.1) };
      c.setScale(b.vx < 0 ? -1 : 1, 1);
      this.bersagli.push(b);
    }
    this.aggiornaHud();
  }

  tocco(x, y, dito) {
    if (this.S.fase === "attesa") { this.inizia(); return; }
    if (this.S.fase !== "volo" || this.S.colpi <= 0) return;
    if (y > this.cielo + 4) return;            // sul bancone non si spara
    this.S.colpi--;
    suono("sparo");
    // lampo dello sparo
    const lampo = this.add.circle(x, y, 22, 0xffffff, 0.55).setDepth(45);
    this.tweens.add({ targets: lampo, scale: 1.8, alpha: 0, duration: 140, onComplete: () => lampo.destroy() });
    if (dito) { this.mirino.setVisible(true).setPosition(x, y); this.time.delayedCall(260, () => { if (this.touch) this.mirino.setVisible(false); }); }

    const tolleranza = dito ? 16 : 6;   // col dito si è meno precisi
    const colpito = this.bersagli
      .filter((b) => b.stato === "vola" || b.stato === "fugge")
      .find((b) => Phaser.Math.Distance.Between(x, y, b.c.x, b.c.y) < TIPI[b.tipo].raggio + tolleranza);
    if (colpito) this.abbatti(colpito);
    else { this.polvere.explode(5, x, y); }
    if (this.S.colpi <= 0) for (const b of this.bersagli) if (b.stato === "vola") this.time.delayedCall(250, () => this.scappa(b));
    this.aggiornaHud();
  }

  abbatti(b) {
    const S = this.S;
    b.stato = "colpito";
    S.esiti[b.indice] = "ok";
    S.colpitiRound++;
    const val = regole.valore(b.tipo, S.round);
    S.punti += val;
    // feedback medio (grande per la chiavetta d'oro): hit-stop, coriandoli, numero che sale
    const grande = b.tipo === "usb";
    this.fermo = grande ? 0.12 : 0.05;
    this.coriandoli.explode(grande ? 30 : 10, b.c.x, b.c.y);
    this.cameras.main.shake(grande ? 200 : 90, grande ? 0.012 : 0.004);
    suono(grande ? "oro" : b.tipo === "piccione" ? "latta" : "colpito");
    navigator.vibrate?.(grande ? 60 : 25);
    const num = this.add.text(b.c.x, b.c.y - 20, `+${val}`, { ...this.stile, fontSize: grande ? "26px" : "18px", color: grande ? "#ffc531" : "#39ff88", stroke: "#05080a", strokeThickness: 4 })
      .setOrigin(0.5).setDepth(46);
    this.tweens.add({ targets: num, y: num.y - 50, alpha: 0, duration: 800, ease: "Cubic.Out", onComplete: () => num.destroy() });
    // il bersaglio si ferma un attimo, poi gira e cade dietro il bancone
    b.vx = 0; b.vy = 0;
    this.tweens.killTweensOf(b.c.list);
    this.time.delayedCall(220, () => {
      this.tweens.add({ targets: b.c, angle: 540, y: this.cielo + 60, duration: 650, ease: "Quad.In", onComplete: () => this.chiudi(b) });
    });
    this.aggiornaHud();
  }

  scappa(b) {
    if (b.stato !== "vola") return;
    b.stato = "fugge";
    b.vx = 0; b.vy = -b.v * 1.6;
    suono("fuga");
  }

  chiudi(b) {
    if (b.stato === "chiuso") return;
    if (b.stato === "fugge") this.S.esiti[b.indice] = "no";
    b.stato = "chiuso";
    b.c.destroy();
    this.aggiornaHud();
    if (this.bersagli.every((x) => x.stato === "chiuso")) this.fineVolo();
  }

  fineVolo() {
    const S = this.S;
    const presi = this.bersagli.filter((b) => S.esiti[b.indice] === "ok").length;
    const tot = this.bersagli.length;
    S.k += tot;
    this.bersagli = [];
    S.fase = "pausa";
    this.occhi.setText(presi === tot ? "^ ^" : presi ? "o o" : "- -");
    this.parla(presi === tot ? (tot > 1 ? "Doppietta!" : "Colpito!") : presi ? "Uno su due." : ["Mancato!", "Il floppy è salvo.", "Riprova, campione."][Math.floor(Math.random() * 3)], 900);
    this.time.delayedCall(1000, () => (S.k >= 10 ? this.fineRound() : this.volo()));
  }

  fineRound() {
    const S = this.S;
    const presi = S.esiti.filter((e) => e === "ok").length;
    if (presi < regole.richiesti(S.round)) { this.fine(presi); return; }
    let bonus = 0;
    if (presi === 10) { bonus = 1000 * S.round; S.punti += bonus; this.coriandoli.explode(40, this.scale.width / 2, this.cielo * 0.5); }
    suono("round");
    this.mostraCartello(`ROUND ${S.round} SUPERATO\n${presi}/10${bonus ? `\nPERFETTO! +${bonus}` : ""}`, 1500);
    this.time.delayedCall(1700, () => {
      S.round++; S.k = 0; S.colpitiRound = 0; S.esiti = Array(10).fill(null);
      this.aggiornaHud();
      this.mostraCartello(`ROUND ${S.round}\nservono ${regole.richiesti(S.round)} su 10`, 1100);
      this.time.delayedCall(1300, () => this.volo());
    });
  }

  async fine(presi) {
    this.S.fase = "fine";
    suono("fine");
    this.occhi.setText("x x");
    this.parla(`${presi} su 10. Il baraccone chiude!`, 0);
    await new Promise((r) => setTimeout(r, 1300));
    await finePartita({ slug: SLUG, punti: this.S.punti, titolo: "BARACCONE CHIUSO" });
    this.scene.restart();
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const { width: w } = this.scale;
    // mirino da tastiera
    const t = this.tasti;
    const mx = (t.RIGHT.isDown ? 1 : 0) - (t.LEFT.isDown ? 1 : 0), my = (t.DOWN.isDown ? 1 : 0) - (t.UP.isDown ? 1 : 0);
    if (mx || my) {
      this.mirino.setVisible(true);
      this.mirino.x = Phaser.Math.Clamp(this.mirino.x + mx * 520 * dt, 0, w);
      this.mirino.y = Phaser.Math.Clamp(this.mirino.y + my * 520 * dt, 0, this.cielo);
    }
    if (this.fermo > 0) { this.fermo -= dt; return; }
    if (this.S.fase !== "volo") return;

    this.S.timer -= dt;
    if (this.S.timer <= 0) for (const b of this.bersagli) this.scappa(b);

    for (const b of this.bersagli) {
      if (b.stato !== "vola" && b.stato !== "fugge") continue;
      b.c.x += b.vx * dt;
      b.c.y += b.vy * dt;
      if (b.stato === "fugge") {
        if (b.c.y < -60) this.chiudi(b);
        continue;
      }
      // svolazza: rimbalza sui bordi e cambia direzione ogni tanto
      const r = TIPI[b.tipo].raggio;
      const alto = Math.max(60, this.scale.height * 0.1);
      if (b.c.x < r && b.vx < 0) b.vx *= -1;
      if (b.c.x > w - r && b.vx > 0) b.vx *= -1;
      if (b.c.y < alto && b.vy < 0) b.vy *= -1;
      if (b.c.y > this.cielo - r && b.vy > 0) b.vy *= -1;
      b.svolta -= dt;
      if (b.svolta <= 0) {
        const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
        b.vx = Math.cos(ang) * b.v; b.vy = Math.sin(ang) * b.v * 0.8;
        b.svolta = Phaser.Math.FloatBetween(0.45, 1.1);
      }
      b.c.setScale(b.vx < 0 ? -1 : 1, 1);
    }
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "gioco",
  backgroundColor: "#0b1022",
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  input: { activePointers: 2 },
  scene: [Baraccone],
  banner: false,
});

window.game = game;
const scena = () => game.scene.getScene("baraccone");
window.GIOCO = {
  stato: () => {
    const s = scena(); if (!s?.S) return null;
    return { fase: s.S.fase, round: s.S.round, k: s.S.k, colpi: s.S.colpi, punti: s.S.punti, esiti: s.S.esiti.join(","), volanti: s.bersagli.filter((b) => b.stato === "vola").length, fps: Math.round(game.loop.actualFps) };
  },
  avvia: () => scena().inizia(),
  // posizione dei bersagli in volo, in coordinate della pagina
  bersagli: () => { const r = game.canvas.getBoundingClientRect(); return scena().bersagli.filter((b) => b.stato === "vola").map((b) => ({ x: r.left + b.c.x, y: r.top + b.c.y, tipo: b.tipo })); },
};
