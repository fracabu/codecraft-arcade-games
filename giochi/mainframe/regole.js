// Mainframe — arcade.nerd. Il mondo senza Phaser: travi inclinate, scale, bobine, fiamme, punti.
// Unità logiche: schermo 480x640, y verso il basso. Un passo fisso = 1/60 s.
// Il sistemista sale l'impalcatura del datacenter, salta le bobine che il mainframe fa rotolare
// e in cima stacca la spina. Il mainframe si riavvia da solo e si ricomincia, più veloce.

export const W = 480, H = 640, DT = 1 / 60;
export const R = 7;                       // raggio della bobina
const VC = 80, VS = 200, G = 560;         // camminata, spinta del salto, gravità (px/s, px/s²)
const VSCALA = 45;                        // salita e discesa sulle scale
const CADUTA_MAX = 34;                    // oltre questo dislivello l'atterraggio è fatale
const MF_X = 112;                         // dove esce la bobina, e muro del mainframe sulla trave in cima
const CESTINO = 30;                       // il gruppo di continuità in fiamme in basso a sinistra
export const PRESA_X = 278;               // toccata questa x sulla piattaforma più alta, la spina è staccata

// travi: estremi x, quota y all'estremo sinistro e destro, verso in cui rotolano le bobine
export const TRAVI = [
  { x0: 0, x1: 480, y0: 624, y1: 624, dir: -1 },   // 0 pavimento
  { x0: 0, x1: 440, y0: 530, y1: 546, dir: 1 },    // 1
  { x0: 40, x1: 480, y0: 452, y1: 436, dir: -1 },  // 2
  { x0: 0, x1: 440, y0: 342, y1: 358, dir: 1 },    // 3
  { x0: 40, x1: 480, y0: 264, y1: 248, dir: -1 },  // 4
  { x0: 0, x1: 320, y0: 160, y1: 160, dir: 1 },    // 5 il mainframe
  { x0: 200, x1: 300, y0: 84, y1: 84, dir: 0 },    // 6 la presa
];
// scale: x, trave di partenza e di arrivo; quelle rotte non si salgono
export const SCALE = [
  { x: 400, basso: 0, alto: 1 },
  { x: 140, basso: 0, alto: 1, rotta: true },
  { x: 100, basso: 1, alto: 2 },
  { x: 270, basso: 1, alto: 2 },
  { x: 380, basso: 2, alto: 3 },
  { x: 210, basso: 2, alto: 3, rotta: true },
  { x: 90, basso: 3, alto: 4 },
  { x: 300, basso: 3, alto: 4 },
  { x: 280, basso: 4, alto: 5 },
  { x: 240, basso: 5, alto: 6 },
];
export const OGGETTI = [
  { tipo: "usb", x: 200, g: 1 },
  { tipo: "caffe", x: 330, g: 2 },
  { tipo: "usb", x: 160, g: 3 },
  { tipo: "manuale", x: 170, g: 4 },
];
export const VALORE = { caffe: 300, manuale: 800, bobina: 300, fiamma: 500, salto: [0, 100, 300, 500] };

export const quota = (t, x) => t.y0 + (t.y1 - t.y0) * (x - t.x0) / (t.x1 - t.x0);
const dentro = (t, x) => x >= t.x0 && x <= t.x1;
const passa = (prima, dopo, x) => (prima - x) * (dopo - x) < 0 || (dopo === x && prima !== x);
export const cimaScala = (L) => quota(TRAVI[L.alto], L.x);
export const piedeScala = (L) => quota(TRAVI[L.basso], L.x);

function generatore(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nuovaPartita(seme = Date.now()) {
  const s = { fase: "attesa", punti: 0, vite: 3, livello: 1, vitaExtra: false, rng: generatore(seme), t: 0, id: 0, eventi: [] };
  preparaLivello(s);
  return s;
}

export function preparaLivello(s) {
  s.omino = { x: 60, y: quota(TRAVI[0], 60), g: 0, vx: 0, vy: 0, stato: "terra", verso: 1, scala: null, yStacco: 0, daSalto: false, saltate: [], buffer: 0, formato: 0, passo: 0 };
  s.bobine = [];
  s.fiamme = [];
  s.oggetti = OGGETTI.map((o) => ({ ...o, preso: false }));
  s.bonus = 5000;
  s.tBonus = 0;
  s.tLancio = 1.2;
  s.carica = 0;
  s.timer = 0;
}

const ev = (s, tipo, dati = {}) => s.eventi.push({ tipo, ...dati });

function aggiungi(s, punti, x, y) {
  s.punti += punti;
  if (x !== undefined) ev(s, "punti", { punti, x, y });
  if (!s.vitaExtra && s.punti >= 7000) { s.vitaExtra = true; s.vite++; ev(s, "vita"); }
}

export function avvia(s) {
  if (s.fase === "attesa") { s.fase = "gioco"; ev(s, "via"); }
}

function muori(s, motivo) {
  if (s.fase !== "gioco") return;
  s.fase = "morto";
  s.vite--;
  s.timer = 1.6;
  ev(s, "morte", { motivo, x: s.omino.x, y: s.omino.y });
}

function vinci(s) {
  s.fase = "vinto";
  s.timer = 2.6;
  const bonus = s.bonus;
  aggiungi(s, bonus);
  ev(s, "vinto", { bonus });
}

/** Un passo di gioco. inp = { sx, dx, su, giu, salto } dove salto vale solo nel passo in cui il tasto è stato premuto. */
export function passo(s, inp = {}, dt = DT) {
  if (s.fase === "attesa" || s.fase === "fine") return;
  s.t += dt;
  if (s.fase === "morto" || s.fase === "vinto") {
    animaBobine(s, dt);
    s.timer -= dt;
    if (s.timer > 0) return;
    if (s.fase === "morto" && s.vite <= 0) { s.fase = "fine"; ev(s, "fine"); return; }
    if (s.fase === "vinto") { s.livello++; ev(s, "livello", { livello: s.livello }); }
    preparaLivello(s);
    s.fase = "gioco";
    return;
  }
  s.tBonus += dt;
  if (s.tBonus >= 1.5) {
    s.tBonus -= 1.5;
    s.bonus = Math.max(0, s.bonus - 100);
    if (s.bonus === 0) { muori(s, "tempo"); return; }
  }
  muoviOmino(s, inp, dt);
  if (s.fase !== "gioco") return;
  lancia(s, dt);
  for (const b of s.bobine) muoviBobina(s, b, dt);
  for (const f of s.fiamme) muoviFiamma(s, f, dt);
  contatti(s);
  s.bobine = s.bobine.filter((b) => !b.via);
  s.fiamme = s.fiamme.filter((f) => !f.via);
}

function limiti(o) {
  let lo = 6, hi = W - 6;
  if (o.g === 0 && o.stato === "terra") lo = CESTINO + 6;
  if (o.g === 5 && o.stato === "terra") lo = MF_X;
  if (o.g === 6) { lo = TRAVI[6].x0 + 4; hi = TRAVI[6].x1 - 4; }
  if (o.x < lo) { o.x = lo; o.vx = 0; }
  if (o.x > hi) { o.x = hi; o.vx = 0; }
}

function muoviOmino(s, inp, dt) {
  const o = s.omino;
  o.buffer = inp.salto ? 0.12 : Math.max(0, o.buffer - dt);
  if (o.formato > 0) o.formato = Math.max(0, o.formato - dt);
  const dir = (inp.dx ? 1 : 0) - (inp.sx ? 1 : 0);

  if (o.stato === "terra") {
    // con la chiavetta in mano non si sale: si formatta e basta
    if (inp.su && !o.formato) {
      const L = SCALE.find((l) => !l.rotta && l.basso === o.g && Math.abs(l.x - o.x) < 7);
      if (L) { o.stato = "scala"; o.scala = L; o.x = L.x; o.vx = 0; o.buffer = 0; return; }
    }
    if (inp.giu && !o.formato) {
      const L = SCALE.find((l) => !l.rotta && l.alto === o.g && Math.abs(l.x - o.x) < 7);
      if (L) { o.stato = "scala"; o.scala = L; o.x = L.x; o.y += 2; o.vx = 0; o.buffer = 0; return; }
    }
    if (o.buffer > 0) {
      o.buffer = 0;
      o.stato = "aria";
      o.vy = -VS;
      o.vx = dir * VC;
      if (dir) o.verso = dir;
      o.yStacco = o.y;
      o.daSalto = true;
      o.saltate = [];
      ev(s, "salto");
      return;
    }
    o.vx = dir * VC;
    if (dir) o.verso = dir;
    o.x += o.vx * dt;
    o.passo += Math.abs(o.vx) * dt;
    limiti(o);
    const t = TRAVI[o.g];
    if (dentro(t, o.x)) o.y = quota(t, o.x);
    else { o.stato = "aria"; o.vy = 0; o.yStacco = o.y; o.daSalto = false; o.saltate = []; }
  } else if (o.stato === "aria") {
    const y0 = o.y;
    o.vy += G * dt;
    o.x += o.vx * dt;
    const g0 = o.g;
    limiti(o);
    o.y += o.vy * dt;
    if (o.vy > 0) {
      let meglio = null;
      TRAVI.forEach((t, i) => {
        if (!dentro(t, o.x)) return;
        const sy = quota(t, o.x);
        if (y0 <= sy + 0.5 && o.y >= sy && (!meglio || sy < meglio.sy)) meglio = { i, sy };
      });
      if (meglio) {
        o.g = meglio.i;
        o.y = meglio.sy;
        o.stato = "terra";
        o.vx = 0;
        if (meglio.sy - o.yStacco > CADUTA_MAX) { muori(s, "caduta"); return; }
        ev(s, "atterra");
        const n = Math.min(3, o.saltate.length);
        if (o.daSalto && n) aggiungi(s, VALORE.salto[n] + o.saltate.filter((b) => b.rossa).length * 100, o.x, o.y - 24);
        o.saltate = [];
      } else if (o.y > H + 40) { o.g = g0; muori(s, "caduta"); }
    }
  } else if (o.stato === "scala") {
    const L = o.scala;
    const v = (inp.giu ? 1 : 0) - (inp.su ? 1 : 0);
    o.y += v * VSCALA * dt;
    o.passo += Math.abs(v) * VSCALA * dt;
    if (o.y <= cimaScala(L)) { o.y = cimaScala(L); o.g = L.alto; o.stato = "terra"; o.scala = null; }
    else if (o.y >= piedeScala(L)) { o.y = piedeScala(L); o.g = L.basso; o.stato = "terra"; o.scala = null; }
  }
  if (o.g === 6 && o.stato === "terra" && o.x >= PRESA_X) vinci(s);
}

function lancia(s, dt) {
  if (s.carica > 0) {
    s.carica -= dt;
    if (s.carica <= 0 && s.bobine.length < 10) {
      const liv = s.livello;
      const rossa = liv >= 3 && s.rng() < 0.18;
      s.bobine.push({
        id: ++s.id, x: MF_X, y: quota(TRAVI[5], MF_X), g: 5, dir: 1, stato: "rotola", vx: 0, vy: 0, scala: null, viste: [], ang: 0,
        v: Math.min(115, 62 + 8 * (liv - 1)) * (0.92 + s.rng() * 0.16) * (rossa ? 1.35 : 1), rossa,
      });
      ev(s, "lancio");
    }
    return;
  }
  s.tLancio -= dt;
  if (s.tLancio <= 0) {
    s.carica = 0.6;
    s.tLancio = Math.max(1.4, 3.4 - 0.3 * (s.livello - 1)) * (0.8 + s.rng() * 0.5);
    ev(s, "carica");
  }
}

function probScala(s, b) {
  const o = s.omino;
  let p = Math.min(0.5, 0.15 + 0.06 * (s.livello - 1));
  if (o.g < b.g) p += 0.25;            // il sistemista è più in basso: la bobina lo cerca
  if (b.rossa && o.g < b.g) p = 1;
  return p;
}

function animaBobine(s, dt) {
  for (const b of s.bobine) if (b.stato === "rotola") b.ang += b.dir * b.v * dt / R;
}

function muoviBobina(s, b, dt) {
  if (b.stato === "rotola") {
    const t = TRAVI[b.g];
    const prima = b.x;
    b.x += b.dir * b.v * dt;
    b.ang += b.dir * b.v * dt / R;
    for (const L of SCALE) {
      if (L.rotta || L.alto !== b.g || L.alto === 6 || !passa(prima, b.x, L.x) || b.viste.includes(L)) continue;
      b.viste.push(L);
      if (s.rng() < probScala(s, b)) { b.stato = "scala"; b.scala = L; b.x = L.x; return; }
    }
    if (b.g === 0 && b.x < CESTINO) { b.via = true; cestino(s); return; }
    if (!dentro(t, b.x)) { b.stato = "cade"; b.vy = 40; b.vx = b.dir * b.v * 0.6; b.da = b.g; return; }
    b.y = quota(t, b.x);
  } else if (b.stato === "scala") {
    b.y += 75 * dt;
    if (b.y >= piedeScala(b.scala)) {
      b.y = piedeScala(b.scala);
      b.g = b.scala.basso;
      b.dir = TRAVI[b.g].dir;
      b.stato = "rotola";
      b.scala = null;
      b.viste = [];
      ev(s, "tonfo", { x: b.x, y: b.y });
    }
  } else if (b.stato === "cade") {
    const y0 = b.y;
    b.vy += 500 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.ang += b.vx * dt / R;
    for (let i = 0; i < b.da; i++) {
      const t = TRAVI[i];
      if (!dentro(t, b.x)) continue;
      const sy = quota(t, b.x);
      if (y0 <= sy && b.y >= sy) {
        b.y = sy; b.g = i; b.dir = t.dir; b.stato = "rotola"; b.viste = [];
        ev(s, "tonfo", { x: b.x, y: b.y });
        return;
      }
    }
    if (b.y > H + 30 || b.x < -30 || b.x > W + 30) b.via = true;
  }
}

function cestino(s) {
  ev(s, "cestino");
  const max = Math.min(4, 1 + Math.floor(s.livello / 2));
  if (s.fiamme.length >= max || s.rng() >= 0.5) return;
  const x = CESTINO + 8;
  s.fiamme.push({ id: ++s.id, x, y: quota(TRAVI[0], x), g: 0, dir: 1, stato: "cammina", scala: null, su: false, tGiro: 2 + s.rng() * 2, ultima: null });
  ev(s, "fiamma", { x, y: quota(TRAVI[0], x) });
}

function muoviFiamma(s, f, dt) {
  const v = 30 + 4 * s.livello;
  if (f.stato === "cammina") {
    const t = TRAVI[f.g];
    const prima = f.x;
    f.tGiro -= dt;
    if (f.tGiro <= 0) { f.dir = -f.dir; f.tGiro = 1.5 + s.rng() * 3; }
    f.x += f.dir * v * dt;
    const lo = f.g === 0 ? CESTINO + 6 : f.g === 5 ? MF_X : t.x0 + 6, hi = t.x1 - 6;
    if (f.x < lo) { f.x = lo; f.dir = 1; }
    if (f.x > hi) { f.x = hi; f.dir = -1; }
    const pg = s.omino.g;
    for (const L of SCALE) {
      if (L.rotta || L.alto === 6 || L === f.ultima || !passa(prima, f.x, L.x)) continue;
      const sale = L.basso === f.g && pg > f.g, scende = L.alto === f.g && pg < f.g;
      if ((sale || scende) && s.rng() < 0.6) {
        f.stato = "scala"; f.scala = L; f.su = sale; f.x = L.x; f.ultima = L;
        if (scende) f.y += 2;
        return;
      }
    }
    f.y = quota(t, f.x);
  } else {
    const L = f.scala;
    f.y += (f.su ? -1 : 1) * 28 * dt;
    const fine = f.su ? f.y <= cimaScala(L) : f.y >= piedeScala(L);
    if (fine) {
      f.g = f.su ? L.alto : L.basso;
      f.y = quota(TRAVI[f.g], f.x);
      f.stato = "cammina";
      f.scala = null;
      f.dir = s.omino.x >= f.x ? 1 : -1;
    }
  }
}

// distanza al quadrato fra un punto e un rettangolo
function d2(px, py, x0, y0, x1, y1) {
  const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
  return dx * dx + dy * dy;
}

function contatti(s) {
  const o = s.omino;
  const x0 = o.x - 5, x1 = o.x + 5, y0 = o.y - 20, y1 = o.y;
  // con la chiavetta il raggio di formattazione arriva un po' più in là, nel verso in cui guarda
  const fx0 = o.formato ? (o.verso < 0 ? x0 - 12 : x0) : x0, fx1 = o.formato ? (o.verso > 0 ? x1 + 12 : x1) : x1;
  for (const b of s.bobine) {
    const cy = b.y - R;
    if (o.formato && d2(b.x, cy, fx0, y0, fx1, y1) < R * R) {
      b.via = true;
      aggiungi(s, VALORE.bobina, b.x, cy);
      ev(s, "formattata", { x: b.x, y: cy });
      continue;
    }
    if (d2(b.x, cy, x0, y0, x1, y1) < (R - 1) * (R - 1)) { muori(s, "bobina"); return; }
    if (o.stato === "aria" && o.daSalto && !o.saltate.includes(b) && Math.abs(b.x - o.x) < 10 && cy > o.y && cy - o.y < 44) o.saltate.push(b);
  }
  for (const f of s.fiamme) {
    const fx = f.x, fy = f.y - 6;
    if (o.formato && d2(fx, fy, fx0, y0, fx1, y1) < 36) {
      f.via = true;
      aggiungi(s, VALORE.fiamma, fx, fy);
      ev(s, "formattata", { x: fx, y: fy });
      continue;
    }
    if (d2(fx, fy, x0, y0, x1, y1) < 25) { muori(s, "fiamma"); return; }
  }
  for (const it of s.oggetti) {
    if (it.preso || Math.abs(it.x - o.x) > 9) continue;
    const iy = quota(TRAVI[it.g], it.x) - 12;
    if (iy < y0 - 6 || iy > y1 + 2) continue;
    it.preso = true;
    if (it.tipo === "usb") { o.formato = 9; ev(s, "usb", { x: it.x, y: iy }); }
    else aggiungi(s, VALORE[it.tipo], it.x, iy);
    ev(s, "preso", { tipo: it.tipo, x: it.x, y: iy });
  }
}
