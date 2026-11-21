// Rete! — arcade.nerd. Il mondo senza Phaser: un campo di calcetto in gabbia visto dall'alto, la palla,
// cinque contro cinque (portiere compreso), il tempo e la coppa. Unità logiche: il campo è 240x400, y verso il basso.
// Un passo fisso = 1/60 s. La squadra 0 (noi) attacca verso l'alto, la squadra 1 verso il basso.
// Chi conduce tiene la palla al piede; gliela si ruba entrandoci contro o in scivolata.

export const W = 240, H = 400, DT = 1 / 60;
export const PORTA = 60, PROF = 12, TRAVERSA = 10;   // luce della porta, profondità della rete, altezza della traversa
export const PX0 = (W - PORTA) / 2, PX1 = (W + PORTA) / 2;
export const BR = 2.2, PR = 5;                       // raggio della palla e del giocatore
export const DURATA = 120, GOLDEN = 45;              // secondi di partita e di golden gol
const ATTRITO = 1.4, FRENO = 12, ARIA = 0.12, GRAV = 420;
const VMAX = 78, ACC = 620, CON_PALLA = 0.9;         // chi conduce va un po' più piano: lo si può raggiungere
const TIRO = 255;                                    // velocità del tiro

export const NOI = { nome: "Nerd United", sigla: "NRD", maglia: 0x39ff88, banda: 0x0b3d22, portiere: 0xffb000 };
const LIV_NOI = { vel: 1, mira: 0.8, pensa: 0.3, ruba: 0.6, scivola: 0.3, parata: 0.8 };
// la coppa: sei avversari, dal più facile alla finale. ruba = probabilità di prendersi la palla in un contrasto
export const AVVERSARI = [
  { nome: "Dinamo Debug", sigla: "DBG", maglia: 0xffe14f, banda: 0x3a3a3a, portiere: 0x8a95a0, vel: 0.8, mira: 0.4, pensa: 0.7, ruba: 0.25, scivola: 0.06, parata: 0.3 },
  { nome: "Sporting Cache", sigla: "CCH", maglia: 0x5fd7ff, banda: 0x0d3550, portiere: 0xff9a1f, vel: 0.85, mira: 0.5, pensa: 0.6, ruba: 0.32, scivola: 0.1, parata: 0.4 },
  { nome: "Atletico Kernel", sigla: "KRN", maglia: 0xff4f4f, banda: 0x111111, portiere: 0xffe14f, vel: 0.88, mira: 0.58, pensa: 0.5, ruba: 0.34, scivola: 0.15, parata: 0.5 },
  { nome: "Union Overflow", sigla: "OVF", maglia: 0xb36bff, banda: 0xffffff, portiere: 0x39ff88, vel: 0.94, mira: 0.68, pensa: 0.42, ruba: 0.44, scivola: 0.2, parata: 0.58 },
  { nome: "Real Mainframe", sigla: "RMF", maglia: 0xe8edf0, banda: 0xd9531e, portiere: 0x2f7bff, vel: 0.97, mira: 0.74, pensa: 0.36, ruba: 0.5, scivola: 0.25, parata: 0.65 },
  { nome: "Olimpia Quantum", sigla: "QNT", maglia: 0x23232c, banda: 0xffb000, portiere: 0xff4f9a, vel: 1.02, mira: 0.82, pensa: 0.3, ruba: 0.58, scivola: 0.3, parata: 0.72 },
];

export const RUOLI = ["P", "D", "SX", "DX", "A"];
// posti in frazioni del campo per la squadra 0 (la squadra 1 li ha specchiati)
const BASE = { D: [0.5, 0.8], SX: [0.22, 0.6], DX: [0.78, 0.6], A: [0.5, 0.4] };
const INIZIO = { D: [0.5, 0.86], SX: [0.22, 0.7], DX: [0.78, 0.7], A: [0.5, 0.58] };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const portaDa = (sq) => (sq === 0 ? 0 : H);        // la linea della porta che la squadra sq attacca
const mobile = (p) => p.stato === "ok";

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

const ev = (s, tipo, dati = {}) => s.eventi.push({ tipo, ...dati });

export function nuovaPartita(seme = Date.now()) {
  const s = {
    fase: "attesa", t: 0, turno: 0, punti: 0, eventi: [], rnd: generatore(seme),
    palla: { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, ang: 0, ultimo: -1, tiro: -1 },
    gioc: [], umano: -1, cond: -1, tiroPrima: false, passaPrima: false, cambio: 0,
    inseguitore: -1, tInseguitore: 0, passaA: -1, chiBatte: 0, esito: null,
  };
  preparaIncontro(s);
  return s;
}

export function preparaIncontro(s) {
  s.avv = AVVERSARI[s.turno];
  s.liv = [LIV_NOI, s.avv];
  s.gol = [0, 0];
  s.tiri = [0, 0];
  s.tempo = DURATA;
  s.golden = false;
  s.gioc = [];
  for (const sq of [0, 1]) for (const ruolo of RUOLI) {
    s.gioc.push({ id: s.gioc.length, sq, ruolo, x: 0, y: 0, vx: 0, vy: 0, tvx: 0, tvy: 0, dir: 0, stato: "ok", t: 0, passo: 0, cd: 0, pensa: 0, colpito: false });
  }
  // calcio d'inizio: lo battiamo noi nelle partite pari, loro nelle dispari
  calcioDInizio(s, s.turno % 2);
}

function calcioDInizio(s, chi) {
  for (const p of s.gioc) {
    const [fx, fy] = p.ruolo === "P" ? [0.5, (H - 9) / H] : INIZIO[p.ruolo];
    const x = W * fx, y = H * fy;
    Object.assign(p, { x: p.sq ? W - x : x, y: p.sq ? H - y : y, vx: 0, vy: 0, tvx: 0, tvy: 0, stato: "ok", t: 0, cd: 0, pensa: 0.3, colpito: false, conPalla: 0 });
    p.dir = p.sq ? Math.PI / 2 : -Math.PI / 2;
  }
  const a = s.gioc.find((p) => p.sq === chi && p.ruolo === "A");
  a.x = W / 2;
  a.y = H / 2 + (chi === 0 ? 7 : -7);
  Object.assign(s.palla, { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, ultimo: -1, tiro: -1 });
  s.cond = a.id;
  s.passaA = -1;
  s.umano = s.gioc.find((p) => p.sq === 0 && p.ruolo === "A").id;
  s.inseguitore = -1;
  if (s.fase !== "attesa") { s.fase = "pronti"; s.t = 1.2; }
}

export function avvia(s) {
  if (s.fase !== "attesa") return;
  s.fase = "pronti";
  s.t = 1.4;
  ev(s, "turno", { turno: s.turno, avv: s.avv.nome });
}

/**
 * Un passo di gioco. inp = { sx, dx, su, giu, ax, ay, tiro, passa }:
 * tiro e passa sono tasti tenuti (true finché sono giù: conta il momento in cui si premono);
 * ax, ay (da -1 a 1) è la levetta a schermo.
 */
export function passo(s, inp = {}) {
  if (s.fase === "attesa" || s.fase === "fine") return;
  for (const p of s.gioc) { p.tvx = 0; p.tvy = 0; }
  if (s.fase === "pronti") {
    s.t -= DT;
    s.tiroPrima = !!inp.tiro;
    s.passaPrima = !!inp.passa;
    portaPalla(s);
    if (s.t <= 0) { s.fase = "gioco"; ev(s, "fischio"); }
    return;
  }
  if (s.fase === "gol" || s.fase === "finale") {
    for (const p of s.gioc) muovi(s, p);
    fisicaPalla(s);
    s.t -= DT;
    if (s.t > 0) return;
    if (s.fase === "gol") {
      if (s.golden) chiudiPartita(s);
      else calcioDInizio(s, s.chiBatte);
    } else dopoPartita(s);
    return;
  }

  // fase "gioco"
  s.tempo -= DT;
  umano(s, inp);
  cervello(s);
  for (const p of s.gioc) muovi(s, p);
  separa(s);
  contatti(s);
  if (s.cond >= 0) portaPalla(s); else fisicaPalla(s);
  const b = s.palla;
  if (b.y < -BR) return gol(s, 0);
  if (b.y > H + BR) return gol(s, 1);
  cambiaControllo(s);
  if (s.passaA >= 0 && s.cond < 0 && Math.hypot(b.vx, b.vy) < 25) s.passaA = -1;
  if (s.tempo <= 0) {
    if (s.gol[0] === s.gol[1] && !s.golden) { s.golden = true; s.tempo = GOLDEN; ev(s, "golden"); }
    else chiudiPartita(s);
  }
}

function gol(s, sq) {
  s.gol[sq]++;
  if (s.palla.tiro === sq) s.tiri[sq]++;
  s.palla.tiro = -1;
  s.cond = -1;
  if (sq === 0) s.punti += 100;
  s.fase = "gol";
  s.t = 2.2;
  s.chiBatte = 1 - sq;
  ev(s, "gol", { sq, x: s.palla.x, y: s.palla.y, golden: s.golden });
}

function chiudiPartita(s) {
  const pari = s.gol[0] === s.gol[1];
  const vinto = s.gol[0] > s.gol[1] || (pari && s.tiri[0] >= s.tiri[1]);
  const bonus = vinto ? 300 * (s.turno + 1) + 50 * Math.max(0, s.gol[0] - s.gol[1]) : 0;
  s.punti += bonus;
  s.esito = { vinto, bonus, gol: [...s.gol], tiri: [...s.tiri], pari };
  s.cond = -1;
  s.fase = "finale";
  s.t = 3;
  ev(s, "finale", s.esito);
}

function dopoPartita(s) {
  if (!s.esito.vinto) { s.fase = "fine"; ev(s, "fine", { coppa: false }); return; }
  s.turno++;
  if (s.turno >= AVVERSARI.length) {
    s.punti += 2000;
    s.fase = "fine";
    ev(s, "fine", { coppa: true });
    return;
  }
  preparaIncontro(s);
  s.fase = "pronti";
  s.t = 2;
  ev(s, "turno", { turno: s.turno, avv: s.avv.nome });
}

// --- il giocatore comandato da chi gioca
function umano(s, inp) {
  const h = s.gioc[s.umano];
  let ix = (inp.dx ? 1 : 0) - (inp.sx ? 1 : 0), iy = (inp.giu ? 1 : 0) - (inp.su ? 1 : 0);
  if (inp.ax || inp.ay) { ix = inp.ax || 0; iy = inp.ay || 0; }
  const n = Math.hypot(ix, iy);
  if (n > 1) { ix /= n; iy /= n; }
  const vmax = VMAX * (s.cond === h.id ? CON_PALLA : 1);
  h.tvx = ix * vmax;
  h.tvy = iy * vmax;
  const verso = n > 0.2 ? Math.atan2(iy, ix) : h.dir;
  const haPalla = s.cond === h.id;

  if (inp.tiro && !s.tiroPrima && mobile(h)) {
    if (haPalla) tira(s, h, verso, 0.45);
    else scivola(s, h, verso);
  }
  s.tiroPrima = !!inp.tiro;
  if (inp.passa && !s.passaPrima) {
    if (haPalla && mobile(h)) passaggio(s, h, verso, 0.4);
    else cambiaControllo(s, true);
  }
  s.passaPrima = !!inp.passa;
}

function cambiaControllo(s, forza = false) {
  s.cambio -= DT;
  const b = s.palla, h = s.gioc[s.umano];
  if (s.cond >= 0 && s.gioc[s.cond].sq === 0) {           // chi ha la palla è sempre quello comandato
    if (s.umano !== s.cond) { s.umano = s.cond; s.cambio = 0.3; }
    return;
  }
  if (s.passaA >= 0 && s.gioc[s.passaA].sq === 0) return;  // palla in viaggio verso un compagno: comandi lui
  if (!forza && s.cambio > 0) return;
  let best = h, bd = forza ? Infinity : dist(h, b) - 16;
  for (const q of s.gioc) {
    if (q.sq !== 0 || q.ruolo === "P" || (forza && q === h)) continue;
    const d = dist(q, b);
    if (d < bd) { bd = d; best = q; }
  }
  if (best !== h) { s.umano = best.id; s.cambio = 0.35; if (forza) ev(s, "cambio"); }
}

// --- palla al piede
function prendi(s, p) {
  s.cond = p.id;
  s.passaA = -1;
  const b = s.palla;
  b.ultimo = p.id;
  b.tiro = -1;
  b.vz = 0;
  p.conPalla = 0;
  if (p.sq === 0) s.umano = p.id;
  ev(s, "tocco", { sq: p.sq });
}

function portaPalla(s) {
  if (s.cond < 0) return;
  const p = s.gioc[s.cond], b = s.palla;
  const r = PR + BR + 0.6;
  const tx = p.x + Math.cos(p.dir) * r, ty = p.y + Math.sin(p.dir) * r;
  const px = b.x, py = b.y;
  b.x += (tx - b.x) * 0.45;
  b.y += (ty - b.y) * 0.45;
  b.z = 0;
  b.vx = (b.x - px) / DT;
  b.vy = (b.y - py) / DT;
  b.ang += (Math.hypot(b.vx, b.vy) * DT) / BR;
  // dentro la gabbia: fuori dalla luce della porta non si passa la linea di fondo
  b.x = clamp(b.x, BR, W - BR);
  const luce = b.x > PX0 + BR && b.x < PX1 - BR;
  if (!luce) b.y = clamp(b.y, BR, H - BR);
}

function lascia(s) { s.cond = -1; }

// --- calci
function calcia(s, p, ang, forza, alza) {
  const b = s.palla;
  lascia(s);
  b.vx = Math.cos(ang) * forza;
  b.vy = Math.sin(ang) * forza;
  b.vz = alza;
  b.z = Math.max(b.z, 0.5);
  b.ultimo = p.id;
  b.tiro = -1;
  p.cd = 0.3;
  p.dir = ang;
  ev(s, "calcio", { forza, x: b.x, y: b.y });
}

// tiro; con aiuto > 0 la direzione piega verso la porta se ci guarda già
function tira(s, p, ang, aiuto, forza = TIRO) {
  const gy = portaDa(p.sq);
  const gx = W / 2 + clamp((W / 2 - p.x) * 0.3, -PORTA / 2 + 8, PORTA / 2 - 8);
  const ga = Math.atan2(gy - p.y, gx - p.x);
  const d = angDiff(ga, ang);
  if (aiuto > 0 && Math.abs(d) < 0.8 && Math.abs(gy - p.y) < 220) ang += d * aiuto;
  calcia(s, p, ang, forza, 30 + s.rnd() * 25);
  if (Math.abs(angDiff(ga, ang)) < 1.1) s.palla.tiro = p.sq;
  ev(s, "tiro", { sq: p.sq });
}

// passaggio al compagno più libero nella direzione ang; dotMin = quanto deve stare davanti (1 dritto, -1 ovunque)
function passaggio(s, p, ang, dotMin, alza = 5) {
  let best = null, bv = -Infinity;
  for (const q of s.gioc) {
    if (q.sq !== p.sq || q === p || q.ruolo === "P") continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d < 16) continue;
    const dot = (dx * Math.cos(ang) + dy * Math.sin(ang)) / d;
    if (dot < dotMin) continue;
    let marc = 40;
    for (const o of s.gioc) if (o.sq !== p.sq) marc = Math.min(marc, dist(o, q));
    const avanti = (portaDa(p.sq) === 0 ? -dy : dy) / 200;
    const v = dot * 1.2 - d / 300 + marc / 40 + avanti;
    if (v > bv) { bv = v; best = q; }
  }
  if (!best) { calcia(s, p, ang, 150, 6); return null; }
  const lx = best.x + best.vx * 0.3, ly = best.y + best.vy * 0.3;
  const d = Math.hypot(lx - p.x, ly - p.y);
  const forza = alza > 20 ? Math.min(230, d * 0.9 + 50) : Math.min(260, d * ATTRITO + FRENO + 55);
  calcia(s, p, Math.atan2(ly - p.y, lx - p.x), forza, alza);
  s.passaA = best.id;
  if (p.sq === 0) { s.umano = best.id; s.cambio = 0.4; }
  ev(s, "passaggio", { sq: p.sq });
  return best;
}

function scivola(s, p, ang) {
  p.stato = "scivolata";
  p.t = 0.4;
  p.dir = ang;
  p.vx = Math.cos(ang) * 145;
  p.vy = Math.sin(ang) * 145;
  p.colpito = false;
  ev(s, "scivolata", { x: p.x, y: p.y });
}

// --- cervello delle squadre
function vaiVerso(p, tx, ty, vmax) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 1.5) return;
  const v = Math.min(vmax, d * 5);
  p.tvx = (dx / d) * v;
  p.tvy = (dy / d) * v;
}

function posto(s, p) {
  const [fx, fy] = BASE[p.ruolo];
  let x = W * fx, y = H * fy;
  if (p.sq) { x = W - x; y = H - y; }
  const b = s.palla;
  x += (b.x - W / 2) * 0.35;
  y += (b.y - H / 2) * 0.5;
  const nostra = s.cond >= 0 && s.gioc[s.cond].sq === p.sq;
  y += (p.sq === 0 ? -1 : 1) * (nostra ? 24 : -8);
  return [clamp(x, 10, W - 10), clamp(y, 10, H - 10)];
}

function cervello(s) {
  const b = s.palla;
  // inseguitore della squadra 1: il più vicino alla palla, ricalcolato ogni tanto, con un po' di inerzia
  s.tInseguitore -= DT;
  if (s.cond >= 0 && s.gioc[s.cond].sq === 1) s.inseguitore = s.cond;
  else if (s.tInseguitore <= 0 || s.inseguitore < 0) {
    s.tInseguitore = 0.25;
    let best = -1, bd = Infinity;
    for (const q of s.gioc) {
      if (q.sq !== 1 || q.ruolo === "P" || !mobile(q)) continue;
      const d = dist(q, b) - (q.id === s.inseguitore ? 10 : 0);
      if (d < bd) { bd = d; best = q.id; }
    }
    s.inseguitore = best;
  }
  // un nostro compagno va a pressare chi porta palla nella nostra metà campo
  let pressa = -1;
  if (s.cond >= 0 && s.gioc[s.cond].sq === 1 && b.y > H * 0.4) {
    let bd = 90;
    for (const q of s.gioc) if (q.sq === 0 && q.ruolo !== "P" && q.id !== s.umano && mobile(q) && dist(q, b) < bd) { bd = dist(q, b); pressa = q.id; }
  }
  // portiere con la palla in mano: gli avversari si allontanano finché non la rinvia
  const presa = s.gioc.find((q) => q.stato === "presa");
  for (const p of s.gioc) {
    if (!mobile(p) && p.stato !== "presa") continue;
    if (p.ruolo === "P") { portiere(s, p); continue; }
    if (p.id === s.umano) continue;
    const vmax = VMAX * s.liv[p.sq].vel;
    const lontano = presa && presa.sq !== p.sq;
    if (p.id === s.passaA) {
      const t = Math.min(0.6, dist(p, b) / 160);
      vaiVerso(p, b.x + b.vx * t, b.y + b.vy * t, vmax);
    } else if (p.id === s.inseguitore && !lontano) {
      attaccante(s, p, vmax);
    } else if (p.id === pressa) {
      vaiVerso(p, b.x, b.y, vmax * 0.85);
    } else {
      let [tx, ty] = posto(s, p);
      if (lontano) {
        const dx = tx - presa.x, dy = ty - presa.y, d = Math.hypot(dx, dy) || 1;
        if (d < 60) { tx = presa.x + (dx / d) * 60; ty = presa.y + (dy / d) * 60; }
        ty = clamp(ty, 10, H - 10);
      }
      vaiVerso(p, tx, ty, vmax * 0.8);
    }
  }
}

function attaccante(s, p, vmax) {
  const b = s.palla, lv = s.liv[p.sq], gy = portaDa(p.sq);
  p.pensa -= DT;
  if (s.cond === p.id) {
    p.conPalla += DT;
    // pressato da vicino sbaglia: più è scarso, più spesso il pallone gli scappa
    let addosso = false;
    for (const o of s.gioc) if (o.sq !== p.sq && o.ruolo !== "P" && dist(o, p) < 15) addosso = true;
    p.pressione = addosso ? (p.pressione ?? 0) + DT : 0;
    if (p.pressione > 0.4 && s.rnd() < DT * 1.4 * (1 - lv.mira) ** 1.5) {
      p.pressione = 0;
      calcia(s, p, p.dir + (s.rnd() - 0.5) * 1.6, 60 + s.rnd() * 30, 4);
      p.cd = 0.45;
      ev(s, "perde", { sq: p.sq, x: b.x, y: b.y });
      return;
    }
    if (p.pensa <= 0) {
      p.pensa = lv.pensa * (0.6 + s.rnd() * 0.8);
      const dg = Math.hypot(W / 2 - p.x, gy - p.y);
      if (dg < 90 + 35 * lv.mira && Math.abs(gy - p.y) > 18 && s.rnd() < 0.7) {
        const gx = W / 2 + (s.rnd() * 2 - 1) * (PORTA / 2 - 6);
        const err = (s.rnd() - 0.5) * (1 - lv.mira) * 0.9;
        tira(s, p, Math.atan2(gy - p.y, gx - p.x) + err, 0, TIRO * (0.8 + 0.2 * lv.mira));
        return;
      }
      let pressato = false;
      for (const o of s.gioc) if (o.sq !== p.sq && o.ruolo !== "P" && dist(o, p) < 20) pressato = true;
      if ((pressato && s.rnd() < 0.5) || p.conPalla > 3) { passaggio(s, p, Math.atan2(gy - p.y, W / 2 - p.x), -0.3); return; }
    }
    // dribbling verso la porta, scartando l'avversario più vicino che sta davanti
    let ang = Math.atan2(gy - p.y, W / 2 - p.x);
    let o = null, od = 36;
    for (const q of s.gioc) if (q.sq !== p.sq && dist(q, p) < od) { od = dist(q, p); o = q; }
    if (o) {
      const diff = angDiff(Math.atan2(o.y - p.y, o.x - p.x), ang);
      if (Math.abs(diff) < 1.1) ang -= (diff >= 0 ? 1 : -1) * 0.8;
    }
    // vicino alle sponde si rientra verso il centro
    if ((p.x < 18 && Math.cos(ang) < 0) || (p.x > W - 18 && Math.cos(ang) > 0)) ang = Math.PI - ang;
    vaiVerso(p, p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 20, vmax * CON_PALLA);
    return;
  }
  // insegue la palla (o chi la porta) dove sarà fra poco
  const d = dist(p, b);
  const t = Math.min(0.4, d / vmax);
  vaiVerso(p, b.x + b.vx * t * 0.8, b.y + b.vy * t * 0.8, vmax);
  if (p.pensa <= 0) {
    p.pensa = lv.pensa * (0.6 + s.rnd() * 0.8);
    const avv = s.cond >= 0 && s.gioc[s.cond].sq !== p.sq;
    if (avv && d < 24 && d > 7 && s.rnd() < lv.scivola) scivola(s, p, Math.atan2(b.y - p.y, b.x - p.x));
  }
}

function portiere(s, p) {
  const b = s.palla, lv = s.liv[p.sq];
  const alto = p.sq === 1;                       // la squadra 1 difende la porta in alto
  const gy = alto ? 0 : H, casa = alto ? 9 : H - 9;
  if (p.stato === "presa") {
    p.t -= DT;
    b.x = p.x; b.y = p.y + (alto ? 5 : -5); b.z = 2; b.vx = b.vy = b.vz = 0;
    if (p.t <= 0) {
      p.stato = "ok";
      passaggio(s, p, alto ? Math.PI / 2 : -Math.PI / 2, -0.1, 75);   // rinvio alto, sopra le teste
      p.cd = 0.5;
    }
    return;
  }
  // legge la palla a scatti (tempo di reazione) e con un errore: più bravo, più spesso e più giusto
  p.pensa -= DT;
  const vy = alto ? -b.vy : b.vy;                 // > 0: la palla viene verso questa porta
  const lontano = Math.abs(b.y - gy);
  if (p.pensa <= 0) {
    p.pensa = 0.1 + 0.25 * (1 - lv.parata);
    p.mx = W / 2 + (b.x - W / 2) * 0.3;
    if (s.cond < 0 && vy > 40 && lontano < 150) {
      const t = Math.max(0, lontano - 8) / vy;
      p.mx = b.x + b.vx * t + (s.rnd() - 0.5) * 30 * (1 - lv.parata);
    }
  }
  let tx = p.mx ?? W / 2, ty = casa, fuori = false;
  if (lontano < 50 && (s.cond >= 0 || vy < 100)) {
    // palla in area (vagante o al piede di un avversario): esce se è lui il più vicino
    const dp = dist(p, b);
    if (s.gioc.every((q) => q === p || q.id === s.cond || dist(q, b) > dp - 5)) { tx = b.x; ty = b.y; fuori = true; }
  }
  tx = clamp(tx, PX0 - (fuori ? 18 : 3), PX1 + (fuori ? 18 : 3));
  ty = alto ? clamp(ty, 5, 36) : clamp(ty, H - 36, H - 5);
  vaiVerso(p, tx, ty, 90 * (0.8 + 0.3 * lv.parata));
  if (p.cd > 0 || dist(p, b) > 6 + 3 * lv.parata || b.z > 14) return;
  const vb = s.cond >= 0 ? 0 : Math.hypot(b.vx, b.vy);
  if (s.cond >= 0 && s.gioc[s.cond].sq === p.sq) return;
  if (s.cond >= 0 && s.rnd() > 0.04 + 0.06 * lv.parata) return;   // uscita sui piedi: ci prova a ogni passo
  if (b.tiro === 1 - p.sq) s.tiri[1 - p.sq]++;
  b.tiro = -1;
  if (vb < 110 + 180 * lv.parata || s.rnd() < 0.12 * lv.parata) {
    if (s.cond >= 0) { const c = s.gioc[s.cond]; c.cd = 0.5; }
    lascia(s);
    p.stato = "presa";
    p.t = 0.9;
    p.vx = p.vy = 0;
    b.ultimo = p.id;
    s.passaA = -1;
    ev(s, "parata", { sq: p.sq, x: p.x, y: p.y });
  } else {
    b.vx = b.vx * 0.35 + (s.rnd() - 0.5) * 130;
    b.vy = -b.vy * 0.4;
    b.vz = 35;
    b.ultimo = p.id;
    p.cd = 0.35;
    ev(s, "respinta", { sq: p.sq, x: p.x, y: p.y });
  }
}

// --- movimento
function muovi(s, p) {
  p.cd = Math.max(0, p.cd - DT);
  switch (p.stato) {
    case "scivolata": {
      p.t -= DT;
      const k = 1 - 2.4 * DT;
      p.vx *= k; p.vy *= k;
      if (!p.colpito) for (const o of s.gioc) {
        if (o.sq === p.sq || o.ruolo === "P" || !mobile(o) || dist(o, p) > 2 * PR + 2) continue;
        o.stato = "terra"; o.t = 0.8; o.vx = p.vx * 0.4; o.vy = p.vy * 0.4;
        p.colpito = true;
        if (s.cond === o.id) { lascia(s); calcia(s, p, p.dir + (s.rnd() - 0.5) * 0.8, 90, 8); p.cd = 0.2; }
        ev(s, "contrasto", { x: o.x, y: o.y, sq: p.sq });
        break;
      }
      // la scivolata che prende il pallone lo porta via, anche se manca le gambe di chi lo aveva
      const b = s.palla;
      if (!p.colpito && b.z < 6 && dist(p, b) < PR + BR + 4 && !s.gioc.some((q) => q.stato === "presa")) {
        p.colpito = true;
        if (s.cond >= 0) s.gioc[s.cond].cd = 0.4;
        calcia(s, p, p.dir + (s.rnd() - 0.5) * 0.5, 95, 6);
        p.cd = 0.2;
        ev(s, "contrasto", { x: b.x, y: b.y, sq: p.sq });
      }
      if (p.t <= 0) { p.stato = "rialza"; p.t = p.colpito ? 0.3 : 0.7; }   // a vuoto si resta giù di più
      break;
    }
    case "terra": case "rialza":
      p.t -= DT;
      p.vx *= 0.86; p.vy *= 0.86;
      if (p.t <= 0) p.stato = "ok";
      break;
    case "presa":
      p.vx = p.vy = 0;
      break;
    default: {
      const ax = p.tvx - p.vx, ay = p.tvy - p.vy, m = Math.hypot(ax, ay), passo = ACC * DT;
      if (m <= passo) { p.vx = p.tvx; p.vy = p.tvy; } else { p.vx += (ax / m) * passo; p.vy += (ay / m) * passo; }
    }
  }
  p.x = clamp(p.x + p.vx * DT, PR, W - PR);
  p.y = clamp(p.y + p.vy * DT, PR, H - PR);
  const v = Math.hypot(p.vx, p.vy);
  if (v > 10 && p.stato === "ok") {
    // chi conduce gira un po' più piano: la palla gli resta davanti
    const a = Math.atan2(p.vy, p.vx);
    p.dir += angDiff(a, p.dir) * (s.cond === p.id ? 0.35 : 1);
  }
  p.passo += v * DT;
  if (s.cond === p.id && !mobile(p)) lascia(s);
}

function separa(s) {
  const g = s.gioc;
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 2 * PR || d === 0) continue;
    const k = (2 * PR - d) / 2 / d;
    const fa = a.stato === "presa" ? 0 : 1, fb = b.stato === "presa" ? 0 : 1;
    a.x -= dx * k * fa * (fb ? 1 : 2); a.y -= dy * k * fa * (fb ? 1 : 2);
    b.x += dx * k * fb * (fa ? 1 : 2); b.y += dy * k * fb * (fa ? 1 : 2);
  }
  for (const p of g) { p.x = clamp(p.x, PR, W - PR); p.y = clamp(p.y, PR, H - PR); }
}

// palla e giocatori di movimento: la palla libera e lenta si prende, quella forte rimbalza;
// a chi la conduce la si ruba entrandoci contro (non sempre: a volte schizza via)
function contatti(s) {
  const b = s.palla;
  if (s.gioc.some((p) => p.stato === "presa")) return;
  for (const p of s.gioc) {
    if (p.cd > 0 || p.ruolo === "P" || !mobile(p) || p.id === s.cond || b.z > 8) continue;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 0.01;
    if (s.cond >= 0) {
      // contrasto: si arriva sul pallone, o addosso a chi lo porta ma non alle sue spalle (da dietro serve la scivolata);
      // noi abbiamo un po' più di margine sul pallone
      const c = s.gioc[s.cond];
      if (c.sq === p.sq) continue;
      const largo = p.sq === 0 ? 3 : 2;
      const dc = dist(p, c) || 0.01;
      const dietro = ((p.x - c.x) * Math.cos(c.dir) + (p.y - c.y) * Math.sin(c.dir)) / dc < -0.4;
      if (d > PR + BR + 1 + largo && (dc > 2 * PR + 1 || dietro)) continue;
      p.cd = 0.35;
      if (s.rnd() < s.liv[p.sq].ruba) { c.cd = 0.45; prendi(s, p); ev(s, "rubata", { sq: p.sq, x: b.x, y: b.y }); }
      else { c.cd = 0.3; calcia(s, p, Math.atan2(dy, dx) + (s.rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + (s.rnd() - 0.5) * 0.6, 70 + s.rnd() * 40, 6); ev(s, "contrasto", { x: b.x, y: b.y, sq: p.sq }); }
      return;
    }
    if (d > PR + BR + 2) continue;
    const vb = Math.hypot(b.vx, b.vy);
    if (vb > 210) {
      const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx = (b.vx - 1.5 * vn * nx) * 0.55; b.vy = (b.vy - 1.5 * vn * ny) * 0.55; }
      b.tiro = -1;
      p.cd = 0.2;
      ev(s, "rimpallo", { x: b.x, y: b.y });
      continue;
    }
    prendi(s, p);
    return;
  }
}

// --- la palla libera: rotola, vola, rimbalza sulla gabbia, sui pali e sulla traversa, entra in rete
function fisicaPalla(s) {
  const b = s.palla, py = b.y;
  if (s.gioc.some((p) => p.stato === "presa")) return;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAV * DT;
    b.z += b.vz * DT;
    const k = 1 - ARIA * DT;
    b.vx *= k; b.vy *= k;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -45) { b.vz = -b.vz * 0.45; b.vx *= 0.9; b.vy *= 0.9; ev(s, "rimbalzo"); } else b.vz = 0;
    }
    if (b.z > 50) { b.z = 50; b.vz = -Math.abs(b.vz) * 0.5; }
  } else {
    const v = Math.hypot(b.vx, b.vy);
    if (v > 0) {
      const nv = Math.max(0, v - (ATTRITO * v + FRENO) * DT);
      b.vx *= nv / v; b.vy *= nv / v;
    }
  }
  b.x += b.vx * DT;
  b.y += b.vy * DT;
  b.ang += (Math.hypot(b.vx, b.vy) * DT) / BR;
  // pali
  if (b.z < TRAVERSA) for (const [px, pyy] of [[PX0, 0], [PX1, 0], [PX0, H], [PX1, H]]) {
    const dx = b.x - px, dy = b.y - pyy, d = Math.hypot(dx, dy), r = BR + 1.2;
    if (d >= r || d === 0) continue;
    const nx = dx / d, ny = dy / d;
    b.x = px + nx * r; b.y = pyy + ny * r;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; ev(s, "palo", { x: px, y: pyy }); }
  }
  // fianchi della gabbia
  if (b.x < BR) { b.x = BR; if (b.vx < 0) { if (b.vx < -40) ev(s, "sponda", { forza: -b.vx }); b.vx = -b.vx * 0.7; } }
  if (b.x > W - BR) { b.x = W - BR; if (b.vx > 0) { if (b.vx > 40) ev(s, "sponda", { forza: b.vx }); b.vx = -b.vx * 0.7; } }
  fondo(s, true, py);
  fondo(s, false, py);
}

// linea di fondo in alto (alto = true) o in basso; u è la distanza dalla linea verso il campo
function fondo(s, alto, py) {
  const b = s.palla;
  let u = alto ? b.y : H - b.y, vu = alto ? b.vy : -b.vy;
  const pu = alto ? py : H - py;
  if (u >= BR) return;
  const luce = b.x > PX0 + BR && b.x < PX1 - BR;
  if (pu >= BR && !(luce && b.z < TRAVERSA)) {
    // urta la linea fuori dalla porta, la traversa o la gabbia sopra la porta
    if (luce && b.z < TRAVERSA + 4) { b.vz = Math.abs(b.vz) * 0.6 + 25; ev(s, "traversa", { x: b.x, y: alto ? 0 : H }); }
    else if (Math.abs(vu) > 40) ev(s, "sponda", { forza: Math.abs(vu) });
    u = BR;
    vu = Math.abs(vu) * 0.6;
  } else if (u >= 0 && !luce) {
    u = BR;
    vu = Math.abs(vu) * 0.6;
  } else if (u < 0) {
    // dentro la rete
    if (b.x < PX0 + BR) { b.x = PX0 + BR; b.vx = Math.abs(b.vx) * 0.3; }
    if (b.x > PX1 - BR) { b.x = PX1 - BR; b.vx = -Math.abs(b.vx) * 0.3; }
    if (u < -PROF + BR) { u = -PROF + BR; vu = Math.abs(vu) * 0.2; b.vx *= 0.5; }
    if (b.z > TRAVERSA - BR) { b.z = TRAVERSA - BR; b.vz = -Math.abs(b.vz) * 0.3; }
  }
  b.y = alto ? u : H - u;
  b.vy = alto ? vu : -vu;
}
