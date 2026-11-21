// Reperibile — arcade.nerd. Il mondo senza Phaser: un survivors-like nella sala server di notte.
// Sei il sistemista reperibile: dalle 22:00 alle 06:00 (10 minuti veri) bug, topi, glitch e ticket urgenti
// ti vengono addosso. Le armi colpiscono da sole; tu ti muovi, raccogli i byte e scegli i potenziamenti.
// Unità logiche, y verso il basso; un passo fisso = 1/60 s. Gira anche in Node.

export const W = 1400, H = 1400, DT = 1 / 60;
export const NOTTE = 600;                         // secondi di partita: otto ore d'orologio, 75 s l'una
export const PR = 7;                              // raggio del sistemista
const VEL = 80, HP = 100, INVULNERABILE = 0.45;
const MAX_NEMICI = 320, MAX_GEMME = 260;

export const NEMICI = {
  bug: { r: 5, hp: 9, v: 42, danno: 3, xp: 1, punti: 1 },
  topo: { r: 7, hp: 24, v: 56, danno: 5, xp: 2, punti: 2 },
  glitch: { r: 11, hp: 90, v: 31, danno: 9, xp: 5, punti: 5 },
  ticket: { r: 20, hp: 1500, v: 40, danno: 18, xp: 40, punti: 300, boss: true },
};

// armi e potenziamenti: livello da 1 a 5; i valori stanno nelle tabelle, indice = livello - 1
export const ARMI = {
  caffe: { nome: "Tazza di caffè", testo: ["lancia una tazza al nemico più vicino", "+1 tazza", "più danno", "+1 tazza, più veloce", "le tazze passano attraverso"],
    cd: [0.9, 0.85, 0.8, 0.7, 0.6], danno: [12, 14, 18, 20, 25], tazze: [1, 2, 2, 3, 3], buca: [0, 0, 0, 0, 2] },
  paperelle: { nome: "Paperelle di gomma", testo: ["una paperella ti gira attorno", "+1 paperella", "girano più larghe e forti", "+1 paperella", "+1 paperella, più veloci"],
    n: [1, 2, 2, 3, 4], danno: [8, 10, 13, 15, 18], raggio: [32, 34, 40, 42, 44], giro: [3, 3.2, 3.4, 3.6, 4.2] },
  cavo: { nome: "Cavo di rete", testo: ["frustata davanti a te", "più lunga", "frusta anche dietro", "più danno", "più spesso e più lunga"],
    cd: [1.4, 1.3, 1.25, 1.15, 0.95], danno: [18, 22, 26, 34, 40], lungo: [58, 70, 70, 74, 86] },
  estintore: { nome: "Estintore", testo: ["nube che rallenta e danneggia", "nube più larga", "più danno", "nube più larga", "molto più danno"],
    raggio: [30, 36, 40, 46, 52], danno: [4, 5, 7, 8, 12], rallenta: [0.5, 0.5, 0.45, 0.45, 0.4] },
};
export const PASSIVI = {
  scarpe: { nome: "Scarpe da ginnastica", testo: "+10% velocità" },
  panino: { nome: "Panino del distributore", testo: "+20 vita massima, curi il 40%" },
  magnete: { nome: "Calamita", testo: "raccogli i byte da più lontano" },
  overclock: { nome: "Overclock", testo: "le armi ricaricano l'8% più in fretta" },
  debugger: { nome: "Debugger", testo: "+15% danno" },
  caschetto: { nome: "Caschetto", testo: "-1 danno da ogni colpo subito" },
};
const MAX_ARMI = 4;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

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
  return {
    fase: "attesa", t: 0, rnd: generatore(seme), eventi: [], id: 0,
    p: { x: W / 2, y: H / 2, vx: 0, vy: 0, dir: 0, fx: 1, hp: HP, max: HP, inv: 0, liv: 1, xp: 0, prossimo: 5, passo: 0 },
    armi: { caffe: 1 }, passivi: {}, timer: { caffe: 0.5, cavo: 1, estintore: 0 },
    nemici: [], tazze: [], gemme: [], frustate: [],
    uccisi: 0, punti: 0, secondi: 0, spawn: 0, ondata: 1, boss: 0, scelte: [],
  };
}

export function avvia(s) { if (s.fase === "attesa") { s.fase = "gioco"; ev(s, "via"); } }

// orologio della notte: 22:00 + t
export function ora(s) {
  const min = 22 * 60 + Math.floor(s.t / NOTTE * 8 * 60);
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const lv = (s, k) => s.armi[k] ?? 0;
const pas = (s, k) => s.passivi[k] ?? 0;
const molt = (s) => 1 + 0.15 * pas(s, "debugger");
const ricarica = (s) => Math.pow(0.92, pas(s, "overclock"));

/** Un passo. inp = { sx, dx, su, giu, ax, ay } (ax, ay da -1 a 1: levetta a schermo). Fermo nella scelta. */
export function passo(s, inp = {}) {
  if (s.fase !== "gioco") return;
  s.t += DT;
  if (Math.floor(s.t) > s.secondi) { s.secondi = Math.floor(s.t); s.punti += 2; }
  muoviGiocatore(s, inp);
  generaNemici(s);
  griglia(s);
  muoviNemici(s);
  armi(s);
  gemme(s);
  if (s.p.hp <= 0) { s.fase = "fine"; ev(s, "fine", { alba: false }); return; }
  if (s.t >= NOTTE) { s.punti += 3000; s.fase = "fine"; ev(s, "fine", { alba: true }); }
}

function muoviGiocatore(s, inp) {
  const p = s.p;
  let ix = (inp.dx ? 1 : 0) - (inp.sx ? 1 : 0), iy = (inp.giu ? 1 : 0) - (inp.su ? 1 : 0);
  if (inp.ax || inp.ay) { ix = inp.ax || 0; iy = inp.ay || 0; }
  const n = Math.hypot(ix, iy);
  if (n > 1) { ix /= n; iy /= n; }
  const v = VEL * (1 + 0.1 * pas(s, "scarpe"));
  p.vx = ix * v; p.vy = iy * v;
  p.x = clamp(p.x + p.vx * DT, 20, W - 20);
  p.y = clamp(p.y + p.vy * DT, 20, H - 20);
  if (n > 0.15) { p.dir = Math.atan2(iy, ix); if (Math.abs(ix) > 0.1) p.fx = Math.sign(ix); }
  p.passo += Math.hypot(p.vx, p.vy) * DT;
  p.inv = Math.max(0, p.inv - DT);
}

// --- nemici
function nuovoNemico(s, tipo, x, y) {
  const d = NEMICI[tipo], forza = 1 + s.t / 300;
  const e = { id: ++s.id, tipo, x, y, r: d.r, hp: d.hp * (d.boss ? 1 : forza), max: d.hp * (d.boss ? 1 : forza), v: d.v, danno: d.danno, kx: 0, ky: 0, lampo: 0, lento: 0, paperella: 0, nube: 0, passo: s.rnd() * 10, boss: !!d.boss };
  s.nemici.push(e);
  return e;
}

function fuoriVista(s, dist) {
  const a = s.rnd() * Math.PI * 2, p = s.p;
  let x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
  if (x < 10 || x > W - 10) x = p.x - Math.cos(a) * dist;   // fuori dalla sala: dall'altra parte
  if (y < 10 || y > H - 10) y = p.y - Math.sin(a) * dist;
  return [clamp(x, 10, W - 10), clamp(y, 10, H - 10)];
}

function scegliTipo(s) {
  const t = s.t, r = s.rnd();
  if (t < 50) return "bug";
  if (t < 170) return r < 0.7 ? "bug" : "topo";
  if (t < 340) return r < 0.45 ? "bug" : r < 0.85 ? "topo" : "glitch";
  return r < 0.35 ? "bug" : r < 0.72 ? "topo" : "glitch";
}

function generaNemici(s) {
  const ritmo = Math.min(12, 0.7 + s.t / 30 + (s.t / 150) ** 2);
  s.spawn += DT * ritmo;
  while (s.spawn >= 1) {
    s.spawn--;
    if (s.nemici.length >= MAX_NEMICI) break;
    const [x, y] = fuoriVista(s, 230 + s.rnd() * 50);
    nuovoNemico(s, scegliTipo(s), x, y);
  }
  // allo scoccare di ogni ora: uno sciame di bug in cerchio
  if (s.t >= s.ondata * 75 && s.t < NOTTE - 5) {
    const n = 18 + s.ondata * 4;
    for (let i = 0; i < n && s.nemici.length < MAX_NEMICI; i++) {
      const a = (i / n) * Math.PI * 2;
      nuovoNemico(s, "bug", clamp(s.p.x + Math.cos(a) * 200, 10, W - 10), clamp(s.p.y + Math.sin(a) * 200, 10, H - 10));
    }
    ev(s, "ondata", { ora: ora(s) });
    s.ondata++;
  }
  // il ticket urgente: alle 01:12 e alle 04:00
  const orari = [270, 480];
  if (s.boss < orari.length && s.t >= orari[s.boss]) {
    const [x, y] = fuoriVista(s, 220);
    nuovoNemico(s, "ticket", x, y);
    s.boss++;
    ev(s, "boss");
  }
}

// griglia spaziale: celle da 32 unità, per le collisioni fra tanti nemici
const CELLA = 32, COL = Math.ceil(W / CELLA);
function griglia(s) {
  const g = new Map();
  for (const e of s.nemici) {
    const k = Math.floor(e.y / CELLA) * COL + Math.floor(e.x / CELLA);
    let l = g.get(k);
    if (!l) g.set(k, (l = []));
    l.push(e);
  }
  s.griglia = g;
}
function vicini(s, x, y, r, f) {
  const c0 = Math.floor((x - r) / CELLA), c1 = Math.floor((x + r) / CELLA);
  const r0 = Math.floor((y - r) / CELLA), r1 = Math.floor((y + r) / CELLA);
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
    const l = s.griglia.get(rr * COL + cc);
    if (l) for (const e of l) if (e.hp > 0) f(e);
  }
}

function muoviNemici(s) {
  const p = s.p;
  for (const e of s.nemici) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const v = e.v * (e.lento > 0 ? ARMI.estintore.rallenta[lv(s, "estintore") - 1] ?? 1 : 1);
    let mx = (dx / d) * v, my = (dy / d) * v;
    // si scansano fra loro, così non diventano un punto solo
    vicini(s, e.x, e.y, e.r + 6, (o) => {
      if (o === e) return;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 0.01, min = e.r + o.r;
      if (od < min) { const k = ((min - od) / od) * 18; mx += ox * k; my += oy * k; }
    });
    e.x = clamp(e.x + (mx + e.kx) * DT, 5, W - 5);
    e.y = clamp(e.y + (my + e.ky) * DT, 5, H - 5);
    e.kx *= 0.86; e.ky *= 0.86;
    e.lampo = Math.max(0, e.lampo - DT);
    e.lento = Math.max(0, e.lento - DT);
    e.passo += v * DT;
    e.fx = dx >= 0 ? 1 : -1;
    // ti tocca: danno, poi mezzo secondo di respiro
    if (p.inv <= 0 && d < e.r + PR) {
      p.hp -= Math.max(1, e.danno - pas(s, "caschetto"));
      p.inv = INVULNERABILE;
      ev(s, "colpito", { hp: p.hp });
    }
  }
}

function colpisci(s, e, danno, dx, dy, spinta = 60) {
  if (e.hp <= 0) return;
  danno *= molt(s);
  e.hp -= danno;
  e.lampo = 0.08;
  const d = Math.hypot(dx, dy) || 1;
  const k = e.boss ? spinta * 0.15 : spinta;
  e.kx += (dx / d) * k; e.ky += (dy / d) * k;
  ev(s, "danno", { x: e.x, y: e.y - e.r, n: Math.round(danno) });
  if (e.hp <= 0) muore(s, e);
}

function muore(s, e) {
  const d = NEMICI[e.tipo];
  s.uccisi++;
  s.punti += d.punti;
  if (s.gemme.length < MAX_GEMME) s.gemme.push({ x: e.x, y: e.y, v: d.xp, vola: false });
  else s.gemme[Math.floor(s.rnd() * s.gemme.length)].v += d.xp;
  // il panino caduto dal ticket: cura
  if (e.boss) s.gemme.push({ x: e.x + 8, y: e.y, v: 0, cura: 50, vola: false });
  ev(s, "morte", { x: e.x, y: e.y, nem: e.tipo });
}

// --- armi
function nemiciPiuVicini(s, n, raggio) {
  const p = s.p, l = [];
  for (const e of s.nemici) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < raggio) l.push([d, e]);
  }
  l.sort((a, b) => a[0] - b[0]);
  return l.slice(0, n).map((x) => x[1]);
}

function armi(s) {
  const p = s.p;
  // caffè: tazze ai nemici più vicini
  const c = lv(s, "caffe");
  if (c) {
    s.timer.caffe -= DT;
    if (s.timer.caffe <= 0) {
      const A = ARMI.caffe, bersagli = nemiciPiuVicini(s, A.tazze[c - 1], 240);
      s.timer.caffe = bersagli.length ? A.cd[c - 1] * ricarica(s) : 0.15;
      for (const e of bersagli) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        s.tazze.push({ x: p.x, y: p.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, vita: 1.2, danno: A.danno[c - 1], buca: A.buca[c - 1], colpiti: [], ang: 0 });
      }
      if (bersagli.length) ev(s, "tazza");
    }
  }
  for (const t of s.tazze) {
    t.x += t.vx * DT; t.y += t.vy * DT; t.vita -= DT; t.ang += 14 * DT;
    vicini(s, t.x, t.y, 14, (e) => {
      if (t.vita <= 0 || t.colpiti.includes(e.id) || Math.hypot(e.x - t.x, e.y - t.y) > e.r + 3) return;
      t.colpiti.push(e.id);
      colpisci(s, e, t.danno, t.vx, t.vy, 70);
      if (t.buca-- <= 0) t.vita = 0;
    });
  }
  s.tazze = s.tazze.filter((t) => t.vita > 0);

  // paperelle: girano attorno e colpiscono chi toccano (ognuno al massimo ogni 0,45 s)
  const q = lv(s, "paperelle");
  if (q) {
    const A = ARMI.paperelle, n = A.n[q - 1], R = A.raggio[q - 1];
    s.paperelle = [];
    for (let i = 0; i < n; i++) {
      const a = s.t * A.giro[q - 1] + (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      s.paperelle.push({ x, y, a });
      vicini(s, x, y, 18, (e) => {
        if (e.paperella > s.t || Math.hypot(e.x - x, e.y - y) > e.r + 5) return;
        e.paperella = s.t + 0.45;
        colpisci(s, e, A.danno[q - 1], e.x - p.x, e.y - p.y, 90);
      });
    }
  } else s.paperelle = [];

  // cavo di rete: frustata davanti (e dal livello 3 anche dietro)
  const k = lv(s, "cavo");
  s.frustate = s.frustate.filter((f) => (f.vita -= DT) > 0);
  if (k) {
    s.timer.cavo -= DT;
    if (s.timer.cavo <= 0) {
      const A = ARMI.cavo;
      s.timer.cavo = A.cd[k - 1] * ricarica(s);
      const versi = k >= 3 ? [p.dir, p.dir + Math.PI] : [p.dir];
      for (const a of versi) {
        const L = A.lungo[k - 1], ux = Math.cos(a), uy = Math.sin(a);
        s.frustate.push({ x: p.x, y: p.y, a, L, vita: 0.2 });
        vicini(s, p.x + ux * L / 2, p.y + uy * L / 2, L / 2 + 14, (e) => {
          const rx = e.x - p.x, ry = e.y - p.y, lungo = rx * ux + ry * uy, largo = Math.abs(-rx * uy + ry * ux);
          if (lungo > -4 && lungo < L + e.r && largo < 11 + e.r) colpisci(s, e, A.danno[k - 1], ux, uy, 110);
        });
      }
      ev(s, "frusta");
    }
  }

  // estintore: nube attorno, rallenta sempre e danneggia a scatti
  const x = lv(s, "estintore");
  if (x) {
    const A = ARMI.estintore, R = A.raggio[x - 1];
    s.timer.estintore -= DT;
    const scatto = s.timer.estintore <= 0;
    if (scatto) s.timer.estintore = 0.35;
    vicini(s, p.x, p.y, R + 20, (e) => {
      if (Math.hypot(e.x - p.x, e.y - p.y) > R + e.r) return;
      e.lento = 0.2;
      if (scatto) colpisci(s, e, A.danno[x - 1], e.x - p.x, e.y - p.y, 20);
    });
  }
  s.nemici = s.nemici.filter((e) => e.hp > 0);
}

// --- byte da raccogliere e livelli
function gemme(s) {
  const p = s.p, raggio = 46 * (1 + 0.4 * pas(s, "magnete"));
  for (const g of s.gemme) {
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
    if (d < raggio) g.vola = true;
    if (g.vola) { const v = 260 * DT; g.x += (dx / (d || 1)) * Math.min(v, d); g.y += (dy / (d || 1)) * Math.min(v, d); }
    if (d < PR + 3) {
      g.preso = true;
      if (g.cura) { p.hp = Math.min(p.max, p.hp + g.cura); ev(s, "cura"); }
      else { p.xp += g.v; ev(s, "byte"); }
    }
  }
  s.gemme = s.gemme.filter((g) => !g.preso);
  if (p.xp >= p.prossimo) {
    p.xp -= p.prossimo;
    p.liv++;
    p.prossimo = Math.round(4 + p.liv * 3.5 + p.liv * p.liv * 0.4);
    s.scelte = offerte(s);
    s.fase = "scelta";
    ev(s, "livello", { liv: p.liv });
  }
}

// tre potenziamenti a caso fra quelli ancora possibili
export function offerte(s) {
  const tutte = [];
  for (const [k, a] of Object.entries(ARMI)) {
    const l = lv(s, k);
    if (l === 0 && Object.keys(s.armi).length < MAX_ARMI) tutte.push({ tipo: "arma", k, liv: 1, nome: a.nome, testo: a.testo[0], nuova: true });
    else if (l > 0 && l < 5) tutte.push({ tipo: "arma", k, liv: l + 1, nome: a.nome, testo: a.testo[l] });
  }
  for (const [k, a] of Object.entries(PASSIVI)) {
    const l = pas(s, k);
    if (l < 5) tutte.push({ tipo: "passivo", k, liv: l + 1, nome: a.nome, testo: a.testo });
  }
  const scelte = [];
  while (scelte.length < 3 && tutte.length) scelte.push(tutte.splice(Math.floor(s.rnd() * tutte.length), 1)[0]);
  if (!scelte.length) scelte.push({ tipo: "cura", k: "cura", liv: 0, nome: "Pausa caffè", testo: "curi il 50%" });
  return scelte;
}

export function scegli(s, i) {
  if (s.fase !== "scelta") return;
  const o = s.scelte[i];
  if (!o) return;
  if (o.tipo === "arma") s.armi[o.k] = o.liv;
  else if (o.tipo === "passivo") {
    s.passivi[o.k] = o.liv;
    if (o.k === "panino") { s.p.max += 20; s.p.hp = Math.min(s.p.max, s.p.hp + s.p.max * 0.4); }
  } else s.p.hp = Math.min(s.p.max, s.p.hp + s.p.max * 0.5);
  s.scelte = [];
  s.fase = "gioco";
  s.p.inv = 0.6;            // mezzo secondo per ritrovarsi dopo la scelta
  ev(s, "scelto", { k: o.k, liv: o.liv });
}
