// Fascia d'Asteroidi — arcade.nerd. Phaser 4.2.1 (vendor/), grafica tutta disegnata dal codice.
// Una navetta schiva i sassi che cadono, raccoglie cristalli. Tre scudi. Il campo accelera.
import { finePartita, record } from "../../comune/classifica.js";

const Phaser = window.Phaser;
const SLUG = "fascia-asteroidi";
const NEON = 0x39ff88, AMBRA = 0xffb000, MAGENTA = 0xff4fb3, SASSO = 0x8fa3b0;

// --- suoni sintetizzati (niente file da scaricare)
let ac = null;
function suono(tipo) {
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime;
    const o = ac.createOscillator(), v = ac.createGain();
    const [forma, f1, f2, dur, vol] = {
      laser: ["square", 1400, 500, 0.07, 0.025],
      tic: ["square", 900, 700, 0.03, 0.03],
      botto: ["sawtooth", 180, 40, 0.25, 0.06],
    }[tipo];
    o.type = forma;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    v.gain.setValueAtTime(vol, t);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* niente audio */ }
}

// --- regole, senza Phaser: punteggio, difficoltà, scudi
const regole = {
  nuova() { return { tempo: 0, punti: 0, cristalli: 0, abbattuti: 0, bonus: 0, scudi: 3, fase: "attesa" }; },
  passo(r, dt) {
    r.tempo += dt;
    r.punti = Math.floor(r.tempo * 10) + r.cristalli * 50 + r.bonus;
  },
  // un sasso grande incassa più colpi e vale di più
  resistenza: [1, 2, 4],
  valore: [15, 30, 60],
  // velocità di caduta e frequenza crescono col tempo, poi si stabilizzano
  velocita(r, altezza) { return altezza * (0.32 + Math.min(0.55, r.tempo * 0.009)); },
  ogniQuanto(r, larghezza) {
    const base = Math.max(170, 640 - r.tempo * 7);
    return base * Math.min(1.4, Math.max(0.55, 480 / larghezza));   // schermi larghi: più sassi
  },
};

class Gioco extends Phaser.Scene {
  constructor() { super("gioco"); }

  init() {
    this.r = regole.nuova();
    this.prossimoSasso = 0;
    this.prossimoCristallo = 2500;
    this.invulnerabile = 0;
    this.bersaglio = null;
    this.offset = null;
    this.prossimoColpo = 0;
  }

  create() {
    this.physics.resume();
    this.texture();
    const { width: w, height: h } = this.scale;

    // stelle: tre strati di puntini che scorrono a velocità diverse (parallasse)
    this.stelle = [];
    for (let i = 0; i < 70; i++) {
      const strato = i % 3;
      const s = this.add.rectangle(Math.random() * w, Math.random() * h, strato + 1, strato + 1, 0xb9f5c1, 0.25 + strato * 0.25);
      s.v = 20 + strato * 35;
      this.stelle.push(s);
    }

    this.sassi = this.physics.add.group({ maxSize: 60 });
    this.cristalli = this.physics.add.group({ maxSize: 6 });
    this.laser = this.physics.add.group({ maxSize: 40 });

    this.nave = this.physics.add.image(w / 2, h * 0.8, "nave");
    this.nave.body.setCircle(11, 7, 9);
    this.nave.setCollideWorldBounds(true);
    this.nave.setDrag(1400, 1400);
    this.nave.setMaxVelocity(520, 520);
    this.scia = this.add.particles(0, 0, "scintilla", {
      follow: this.nave, followOffset: { x: 0, y: 16 }, speedY: { min: 60, max: 140 }, speedX: { min: -20, max: 20 },
      lifespan: 260, scale: { start: 0.9, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [NEON, AMBRA], frequency: 40,
    });
    this.scia.setDepth(-1);

    this.botto = this.add.particles(0, 0, "scintilla", {
      speed: { min: 80, max: 260 }, lifespan: 500, scale: { start: 1.2, end: 0 }, tint: [MAGENTA, AMBRA, 0xffffff], emitting: false,
    });

    this.physics.add.overlap(this.nave, this.sassi, (nave, sasso) => this.colpito(sasso));
    this.physics.add.overlap(this.nave, this.cristalli, (nave, c) => this.preso(c));
    this.physics.add.overlap(this.laser, this.sassi, (raggio, sasso) => this.centrato(raggio, sasso));

    // HUD
    const stile = { fontFamily: "ui-monospace, Consolas, monospace", fontSize: "18px", color: "#b9f5c1" };
    this.hudPunti = this.add.text(w / 2, 14, "", { ...stile, fontSize: "20px" }).setOrigin(0.5, 0).setDepth(10);
    this.hudScudi = this.add.text(w - 12, 16, "", { ...stile, color: "#ffb000" }).setOrigin(1, 0).setDepth(10);
    const rec = record(SLUG);
    this.titolo = this.add.text(w / 2, h * 0.36, "FASCIA D'ASTEROIDI", { ...stile, fontSize: "26px", color: "#39ff88" }).setOrigin(0.5).setDepth(10);
    this.invito = this.add.text(w / 2, h * 0.36 + 44,
      `${this.sys.game.device.input.touch ? "tocca e trascina per partire\ncol dito giù si spara da soli" : "frecce o WASD per muoverti\nSpazio per sparare\n(o trascina col mouse: spara da solo)"}\n\n${rec ? `record: ${rec.punti} (${rec.nome})` : ""}`,
      { ...stile, fontSize: "15px", align: "center", color: "#9fcfa8" }).setOrigin(0.5, 0).setDepth(10);
    this.tweens.add({ targets: this.invito, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    // comandi
    this.tasti = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Z,ENTER");
    this.input.keyboard.on("keydown", () => this.parti());
    // un colpo anche col tasto appena sfiorato (tenuto premuto: raffica, vedi update)
    const colpo = () => { if (this.r.fase === "gioco") this.spara(this.time.now, true); };
    this.input.keyboard.on("keydown-SPACE", colpo);
    this.input.keyboard.on("keydown-Z", colpo);
    this.input.addPointer(1);
    this.input.on("pointerdown", (p) => {
      this.parti();
      // trascinamento relativo: il dito non copre la navetta
      this.offset = { x: this.nave.x - p.x, y: this.nave.y - p.y };
    });
    this.input.on("pointermove", (p) => {
      if (!p.isDown || !this.offset) return;
      this.bersaglio = { x: p.x + this.offset.x, y: p.y + this.offset.y };
    });
    this.input.on("pointerup", () => { this.offset = null; this.bersaglio = null; });

    this.scale.on("resize", (size) => this.ridimensiona(size), this);
    this.events.once("shutdown", () => this.scale.off("resize", this.ridimensiona, this));
    this.aggiornaHud();
    window.__ready = true;
  }

  texture() {
    if (this.textures.exists("nave")) return;
    const g = this.make.graphics({}, false);
    // navetta: freccia con contorno neon
    g.fillStyle(0x0b130d).fillTriangle(16, 2, 30, 34, 2, 34);
    g.lineStyle(2.5, NEON).strokeTriangle(16, 2, 30, 34, 2, 34);
    g.fillStyle(AMBRA).fillRect(13, 22, 6, 6);
    g.generateTexture("nave", 32, 36);
    g.clear();
    // sassi: tre forme irregolari
    [22, 32, 46].forEach((r, k) => {
      g.clear();
      const pts = [];
      const n = 9 + k;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (0.78 + ((i * 7919 + k * 31) % 23) / 100);
        pts.push({ x: r + 2 + Math.cos(a) * rr, y: r + 2 + Math.sin(a) * rr });
      }
      g.fillStyle(0x1a2228).fillPoints(pts, true);
      g.lineStyle(2, SASSO).strokePoints(pts, true, true);
      g.fillStyle(SASSO, 0.35).fillCircle(r * 0.8, r * 0.9, r * 0.18).fillCircle(r * 1.3, r * 1.25, r * 0.12);
      g.generateTexture(`sasso${k}`, r * 2 + 4, r * 2 + 4);
    });
    g.clear();
    g.fillStyle(MAGENTA).fillPoints([{ x: 9, y: 0 }, { x: 18, y: 10 }, { x: 9, y: 22 }, { x: 0, y: 10 }], true);
    g.fillStyle(0xffffff, 0.7).fillPoints([{ x: 9, y: 3 }, { x: 13, y: 9 }, { x: 9, y: 9 }], true);
    g.generateTexture("cristallo", 18, 22);
    g.clear();
    g.fillStyle(0xffffff).fillCircle(3, 3, 3);
    g.generateTexture("scintilla", 6, 6);
    g.clear();
    g.fillStyle(NEON, 0.35).fillRoundedRect(0, 0, 8, 20, 4);
    g.fillStyle(0xeafff1).fillRoundedRect(2, 2, 4, 16, 2);
    g.generateTexture("laser", 8, 20);
    g.destroy();
  }

  parti() {
    if (this.r.fase !== "attesa") return;
    this.r.fase = "gioco";
    this.titolo.setVisible(false);
    this.invito.setVisible(false);
  }

  ridimensiona({ width: w, height: h }) {
    this.physics.world.setBounds(0, 0, w, h);
    this.hudScudi.setX(w - 12);
    this.hudPunti.setX(w / 2);
    this.titolo?.setPosition(w / 2, h * 0.36);
    this.invito?.setPosition(w / 2, h * 0.36 + 44);
    this.nave.setPosition(Math.min(this.nave.x, w - 20), Math.min(this.nave.y, h - 24));
  }

  sasso() {
    const { width: w } = this.scale;
    const k = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
    const s = this.sassi.get(Phaser.Math.Between(20, w - 20), -50, `sasso${k}`);
    if (!s) return;
    s.enableBody(true, s.x, -50, true, true);
    s.setTexture(`sasso${k}`);
    const r = [22, 32, 46][k];
    s.body.setCircle(r * 0.78, r * 0.22 + 2, r * 0.22 + 2);
    const v = regole.velocita(this.r, this.scale.height) * (1.25 - k * 0.15);
    s.setVelocity(Phaser.Math.Between(-40, 40), v);
    s.setAngularVelocity(Phaser.Math.Between(-90, 90));
    s.taglia = k;
    s.vita = regole.resistenza[k];
    s.clearTint();
  }

  spara(time, subito = false) {
    if (time < this.prossimoColpo - (subito ? 90 : 0)) return;
    this.prossimoColpo = time + 170;
    for (const dx of this.r.tempo > 45 ? [-9, 9] : [0]) {   // dopo 45 secondi: doppio raggio
      const l = this.laser.get(this.nave.x + dx, this.nave.y - 20, "laser");
      if (!l) continue;
      l.enableBody(true, this.nave.x + dx, this.nave.y - 20, true, true);
      l.body.setSize(6, 18);
      l.setVelocity(0, -950);
    }
    suono("laser");
  }

  centrato(raggio, sasso) {
    if (!raggio.active || !sasso.active) return;
    raggio.disableBody(true, true);
    sasso.vita--;
    if (sasso.vita > 0) {
      sasso.setTint(0xffffff);
      if (Phaser.TintModes) sasso.setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(60, () => { if (sasso.active) { sasso.clearTint(); if (Phaser.TintModes) sasso.setTintMode(Phaser.TintModes.MULTIPLY); } });
      this.botto.explode(4, raggio.x, raggio.y);
      suono("tic");
      return;
    }
    this.r.abbattuti++;
    this.r.bonus += regole.valore[sasso.taglia];
    this.botto.explode(8 + sasso.taglia * 8, sasso.x, sasso.y);
    if (sasso.taglia === 2) this.cameras.main.shake(90, 0.006);
    sasso.disableBody(true, true);
    suono("botto");
  }

  cristallo() {
    const c = this.cristalli.get(Phaser.Math.Between(30, this.scale.width - 30), -30, "cristallo");
    if (!c) return;
    c.enableBody(true, c.x, -30, true, true);
    c.setVelocity(0, regole.velocita(this.r, this.scale.height) * 0.7);
  }

  colpito(sasso) {
    if (this.invulnerabile > 0 || this.r.fase !== "gioco") return;
    sasso.disableBody(true, true);
    this.r.scudi--;
    this.botto.explode(18, this.nave.x, this.nave.y);
    this.cameras.main.shake(180, 0.012);
    this.invulnerabile = 1.4;
    navigator.vibrate?.(60);
    if (this.r.scudi <= 0) this.fine();
    this.aggiornaHud();
  }

  preso(c) {
    c.disableBody(true, true);
    this.r.cristalli++;
    this.botto.explode(10, c.x, c.y);
    this.aggiornaHud();
  }

  async fine() {
    this.r.fase = "fine";
    this.nave.setVisible(false);
    this.scia.stop();
    this.botto.explode(40, this.nave.x, this.nave.y);
    this.physics.pause();
    await new Promise((r) => setTimeout(r, 700));
    await finePartita({ slug: SLUG, punti: this.r.punti, titolo: "SCAFO PERSO" });
    this.scene.restart();
  }

  aggiornaHud() {
    this.hudPunti.setText(`${String(this.r.punti).padStart(6, "0")}`);
    this.hudScudi.setText("◆".repeat(Math.max(0, this.r.scudi)) + "◇".repeat(3 - Math.max(0, this.r.scudi)));
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const { width: w, height: h } = this.scale;
    for (const s of this.stelle) {
      s.y += s.v * dt * (this.r.fase === "gioco" ? 1 + this.r.tempo * 0.02 : 1);
      if (s.y > h) { s.y = -2; s.x = Math.random() * w; }
    }
    if (this.r.fase !== "gioco") {
      if (this.r.fase === "attesa") this.nave.setPosition(w / 2 + Math.sin(time / 600) * 30, h * 0.8);
      return;
    }

    regole.passo(this.r, dt);
    this.aggiornaHud();

    // movimento: tastiera con accelerazione, oppure inseguimento del dito
    const t = this.tasti;
    const ax = (t.RIGHT.isDown || t.D.isDown ? 1 : 0) - (t.LEFT.isDown || t.A.isDown ? 1 : 0);
    const ay = (t.DOWN.isDown || t.S.isDown ? 1 : 0) - (t.UP.isDown || t.W.isDown ? 1 : 0);
    if (this.bersaglio) {
      this.nave.setAcceleration(0, 0);
      const dx = this.bersaglio.x - this.nave.x, dy = this.bersaglio.y - this.nave.y;
      this.nave.setVelocity(Phaser.Math.Clamp(dx * 14, -700, 700), Phaser.Math.Clamp(dy * 14, -700, 700));
    } else {
      this.nave.setAcceleration(ax * 2400, ay * 2400);
    }
    this.nave.setAngle(Phaser.Math.Clamp(this.nave.body.velocity.x / 30, -14, 14));

    // sparo: Spazio sulla tastiera; col dito o il mouse premuto spara da solo
    if (t.SPACE.isDown || t.Z.isDown || this.offset) this.spara(time);

    if (this.invulnerabile > 0) {
      this.invulnerabile -= dt;
      this.nave.setAlpha(Math.floor(this.invulnerabile * 12) % 2 ? 0.3 : 1);
      if (this.invulnerabile <= 0) this.nave.setAlpha(1);
    }

    this.prossimoSasso -= delta;
    if (this.prossimoSasso <= 0) { this.sasso(); this.prossimoSasso = regole.ogniQuanto(this.r, w); }
    this.prossimoCristallo -= delta;
    if (this.prossimoCristallo <= 0) { this.cristallo(); this.prossimoCristallo = Phaser.Math.Between(3500, 6500); }

    for (const grp of [this.sassi, this.cristalli]) {
      grp.getChildren().forEach((o) => { if (o && o.active && o.y > h + 60) o.disableBody(true, true); });
    }
    this.laser.getChildren().forEach((o) => { if (o.active && o.y < -30) o.disableBody(true, true); });
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "gioco",
  backgroundColor: "#05080a",
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: "arcade", arcade: { debug: false } },
  input: { activePointers: 2 },
  scene: [Gioco],
  banner: false,
});

window.game = game;
window.GIOCO = {
  stato: () => {
    const s = game.scene.getScene("gioco");
    return s?.r ? { fase: s.r.fase, punti: s.r.punti, scudi: s.r.scudi, abbattuti: s.r.abbattuti, laser: s.laser.countActive(), tempo: +s.r.tempo.toFixed(2), sassi: s.sassi.countActive(), fps: Math.round(game.loop.actualFps) } : null;
  },
  avvia: () => game.scene.getScene("gioco").parti(),
  colpisci: () => { const s = game.scene.getScene("gioco"); s.invulnerabile = 0; s.colpito({ disableBody() {} }); },
};
