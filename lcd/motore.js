// Motore dei giochi LCD di arcade.nerd: un portatile a cristalli liquidi fatto in SVG.
// Ogni figura è un "segmento" sempre presente: spento resta un'ombra chiara, acceso è nero.
// Il gioco descrive i segmenti e le regole; il motore fa il guscio, i tasti, il ritmo a scatti,
// il punteggio a 7 segmenti, i tre errori, i bip e la fine partita.
import { finePartita } from "../comune/classifica.js";

const NS = "http://www.w3.org/2000/svg";
export const W = 400, H = 240;

// segmenti delle cifre: a b c d e f g
const CIFRE = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

export function el(tag, attr = {}, padre) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attr)) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}

/** Crea un segmento: un gruppo con id e classe "seg", dentro ci si disegna la figura. */
export function seg(padre, id, figura) {
  const g = el("g", { id, class: "seg" }, padre);
  if (typeof figura === "string") g.innerHTML = figura;
  else if (typeof figura === "function") figura(g);
  return g;
}

function cifra(padre, x, y, s, id) {
  // una cifra a 7 segmenti larga 10s e alta 18s
  const g = el("g", { id, transform: `translate(${x} ${y}) scale(${s})` }, padre);
  const pezzi = {
    a: "M1.5 0 L8.5 0 L7.3 1.6 L2.7 1.6 Z",
    b: "M8.9 0.5 L10 1.6 L10 8.2 L8.9 9 L7.8 8.2 L7.8 1.9 Z",
    c: "M8.9 9 L10 9.8 L10 16.4 L8.9 17.5 L7.8 16.1 L7.8 9.8 Z",
    d: "M2.7 16.4 L7.3 16.4 L8.5 18 L1.5 18 Z",
    e: "M1.1 9 L2.2 9.8 L2.2 16.1 L1.1 17.5 L0 16.4 L0 9.8 Z",
    f: "M1.1 0.5 L2.2 1.9 L2.2 8.2 L1.1 9 L0 8.2 L0 1.6 Z",
    g: "M2.4 8.2 L7.6 8.2 L8.6 9 L7.6 9.8 L2.4 9.8 L1.4 9 Z",
  };
  for (const [k, d] of Object.entries(pezzi)) el("path", { d, class: `seg cf-${k}` }, g);
  return g;
}

export function avviaLCD(gioco) {
  const { slug, titolo, sottotitolo = "", tasti = ["sinistra", "destra"] } = gioco;
  document.title = `${titolo} — arcade.nerd`;

  // guscio
  const corpo = document.createElement("main");
  corpo.className = "console";
  corpo.innerHTML = `
    <a class="torna" href="../../">&larr; sala giochi</a>
    <div class="guscio">
      <div class="marchio"><span class="nome">${titolo}</span><span class="serie">${sottotitolo}</span></div>
      <div class="vetro"><svg class="lcd" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schermo del gioco ${titolo}"></svg></div>
      <div class="pannello sx">${padSx(tasti)}</div>
      <div class="pannello dx">
        <div class="modi">
          <button class="mini" data-modo="A" aria-label="Gioco A, normale">GAME A</button>
          <button class="mini" data-modo="B" aria-label="Gioco B, veloce">GAME B</button>
          <button class="mini" data-azione="audio" aria-label="Suono acceso o spento" aria-pressed="true">♪</button>
        </div>
        ${padDx(tasti)}
      </div>
    </div>
    <p class="aiuto">${gioco.aiuto ?? ""}</p>`;
  document.body.appendChild(corpo);
  const svg = corpo.querySelector("svg.lcd");

  // sfondo stampato (fisso) e segmenti del gioco
  const fondo = el("g", { class: "fondo" }, svg);
  const strato = el("g", { class: "strato" }, svg);
  gioco.disegna({ fondo, strato, el, seg });

  // punteggio, errori, modo: segmenti del motore
  const hud = el("g", { class: "hud" }, svg);
  const cifre = [0, 1, 2, 3].map((i) => cifra(hud, 318 + i * 19, 8, 1.45, `cifra-${i}`));
  for (let i = 0; i < 3; i++) {
    seg(hud, `errore-${i}`, (g) => {
      el("text", { x: 14 + i * 22, y: 26, class: "x" }, g).textContent = "✕";
    });
  }
  seg(hud, "scritta-miss", (g) => { el("text", { x: 14, y: 40, class: "piccolo" }, g).textContent = "MISS"; });
  seg(hud, "modo-A", (g) => { el("text", { x: 150, y: 20, class: "piccolo" }, g).textContent = "GAME A"; });
  seg(hud, "modo-B", (g) => { el("text", { x: 205, y: 20, class: "piccolo" }, g).textContent = "GAME B"; });

  const segmenti = new Map([...svg.querySelectorAll(".seg[id]")].map((n) => [n.id, n]));
  const accesi = new Set();

  const S = {
    fase: "attesa",       // attesa | gioco | pausa | fine
    modo: "A",
    punti: 0,
    errori: 0,
    intervallo: 500,
    timer: null,
    audio: true,
    lampo: 0,
  };

  // --- segmenti
  function accendi(id, si = true) {
    const n = segmenti.get(id);
    if (!n) return;
    if (si) { n.classList.add("on"); accesi.add(id); } else { n.classList.remove("on"); accesi.delete(id); }
  }
  function spegniTutto(prefisso = "") {
    for (const id of [...accesi]) if (id.startsWith(prefisso)) accendi(id, false);
  }
  function mostraPunti(n) {
    const t = String(Math.min(n, 9999)).padStart(4, " ");
    cifre.forEach((g, i) => {
      const c = t[i];
      const on = c === " " ? "" : CIFRE[Number(c)];
      for (const p of g.children) p.classList.toggle("on", on.includes(p.classList[1].slice(3)));
    });
  }
  function mostraErrori() {
    for (let i = 0; i < 3; i++) accendi(`errore-${i}`, i < S.errori);
    accendi("scritta-miss", S.errori > 0);
  }

  // --- suono: onde quadre come un cicalino piezo
  let ac = null;
  function bip(tipo = "muovi") {
    if (!S.audio) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const [f, d] = { muovi: [1760, 0.025], punto: [2637, 0.05], errore: [220, 0.32], fine: [147, 0.6], via: [1318, 0.09] }[tipo] ?? [1000, 0.05];
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = "square"; o.frequency.value = f;
      v.gain.setValueAtTime(0.06, ac.currentTime);
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(v).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + d + 0.02);
    } catch { /* niente audio: si gioca muti */ }
  }

  // --- API data al gioco
  const api = {
    accendi, spegniTutto, bip,
    get punti() { return S.punti; },
    get modo() { return S.modo; },
    get errori() { return S.errori; },
    set intervallo(ms) { S.intervallo = Math.max(90, ms); },
    get intervallo() { return S.intervallo; },
    segna(n = 1) {
      const prima = S.punti;
      S.punti += n;
      mostraPunti(S.punti);
      bip("punto");
      // bonus: a 200 e 500 punti gli errori si azzerano
      if ((prima < 200 && S.punti >= 200) || (prima < 500 && S.punti >= 500)) { S.errori = 0; mostraErrori(); }
    },
    sbaglia() {
      S.errori++;
      mostraErrori();
      bip("errore");
      if (S.errori >= 3) fine();
      return S.errori >= 3;
    },
    /** ferma il ritmo per qualche scatto (dopo un errore, come nei portatili veri) */
    pausa(ms) {
      if (S.fase === "fine") return;
      clearTimeout(S.timer);
      S.fase = "pausa";
      S.timer = setTimeout(() => { if (S.fase === "pausa") { S.fase = "gioco"; prossimo(); } }, ms);
    },
  };

  function prossimo() {
    clearTimeout(S.timer);
    S.timer = setTimeout(passo, S.intervallo);
  }
  function passo() {
    if (S.fase !== "gioco") return;
    gioco.passo(api);
    if (S.fase === "gioco") prossimo();
  }

  function avvia(modo = "A") {
    clearTimeout(S.timer);
    document.querySelector(".fp")?.remove();
    S.modo = modo; S.punti = 0; S.errori = 0; S.fase = "gioco";
    spegniTutto();
    accendi("modo-A", modo === "A"); accendi("modo-B", modo === "B");
    mostraPunti(0); mostraErrori();
    gioco.nuovaPartita(api);
    bip("via");
    prossimo();
  }

  async function fine() {
    clearTimeout(S.timer);
    S.fase = "fine";
    bip("fine");
    gioco.fine?.(api);
    await new Promise((r) => setTimeout(r, 900));
    await finePartita({ slug, punti: S.punti, titolo: "GAME OVER" });
    avvia(S.modo);
  }

  function tasto(nome) {
    if (S.fase === "attesa" || S.fase === "fine") {
      if (S.fase === "attesa" && ["sinistra", "destra", "su", "giu", "colpo"].includes(nome)) avvia("A");
      return;
    }
    if (S.fase !== "gioco" && S.fase !== "pausa") return;
    gioco.tasto(nome, api);
  }

  // --- schermata d'attesa: tutti i segmenti lampeggiano piano, come al primo avvio
  function attesa() {
    S.fase = "attesa";
    const tutti = [...segmenti.keys()].filter((id) => !id.startsWith("cifra"));
    let acceso = false;
    const lampeggia = () => {
      if (S.fase !== "attesa") return;
      acceso = !acceso;
      for (const id of tutti) accendi(id, acceso && !id.startsWith("errore") && id !== "scritta-miss");
      mostraPunti(acceso ? 8888 : 0);
      S.lampo = setTimeout(lampeggia, acceso ? 900 : 600);
    };
    lampeggia();
  }

  // --- input: tasti a schermo (pointer, multi-touch) e tastiera
  const MAPPA = {
    ArrowLeft: "sinistra", ArrowRight: "destra", ArrowUp: "su", ArrowDown: "giu",
    a: "sinistra", d: "destra", w: "su", s: "giu", A: "sinistra", D: "destra", W: "su", S: "giu",
    " ": "colpo", z: "colpo", Z: "colpo", x: "colpo", X: "colpo", Enter: "colpo",
  };
  document.addEventListener("keydown", (e) => {
    if (document.querySelector(".fp") || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === "Enter" || e.key === " ") && e.target.closest?.("button")) return; // ci pensa il click
    if (e.key === "1") return avvia("A");
    if (e.key === "2") return avvia("B");
    const n = MAPPA[e.key];
    if (!n || !tasti.includes(n) && !(n === "colpo" && S.fase === "attesa")) return;
    e.preventDefault();
    if (e.repeat) return;   // come un tasto vero: un colpo per pressione
    premi(n);
  });
  corpo.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.tasto) { premi(b.dataset.tasto); b.classList.add("giu"); }
    if (b.dataset.modo) avvia(b.dataset.modo);
    if (b.dataset.azione === "audio") {
      S.audio = !S.audio;
      b.setAttribute("aria-pressed", String(S.audio));
      b.classList.toggle("muto", !S.audio);
    }
  });
  const su = (e) => e.target.closest?.("button")?.classList.remove("giu");
  corpo.addEventListener("pointerup", su);
  corpo.addEventListener("pointercancel", su);
  corpo.addEventListener("pointerleave", su, true);
  // tastiera e lettori di schermo: il click arriva senza pointerdown
  corpo.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || e.detail !== 0) return;
    if (b.dataset.tasto) premi(b.dataset.tasto);
    if (b.dataset.modo) avvia(b.dataset.modo);
  });
  corpo.addEventListener("contextmenu", (e) => e.preventDefault());

  function premi(nome) {
    if (S.fase === "attesa") clearTimeout(S.lampo);
    tasto(nome);
  }

  // scheda nascosta: il gioco si ferma, al ritorno riparte
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.fase === "gioco") { clearTimeout(S.timer); S.fase = "pausa"; }
    else if (!document.hidden && S.fase === "pausa") { S.fase = "gioco"; prossimo(); }
  });

  // per le prove automatiche
  window.GIOCO = {
    stato: () => ({ fase: S.fase, modo: S.modo, punti: S.punti, errori: S.errori, intervallo: S.intervallo, ...gioco.stato?.() }),
    avvia, tasto: premi,
    passo: () => { if (S.fase === "gioco") gioco.passo(api); },
    ferma: () => { clearTimeout(S.timer); },
  };

  attesa();
  window.__ready = true;
}

function bottone(nome, simbolo, classe = "") {
  const etichette = { sinistra: "sinistra", destra: "destra", su: "su", giu: "giù", colpo: "colpo" };
  return `<button class="tasto ${classe}" tabindex="-1" data-tasto="${nome}" aria-label="${etichette[nome]}">${simbolo}</button>`;
}
function padSx(tasti) {
  if (tasti.includes("su")) {
    return `<div class="croce">
      ${bottone("su", "▲", "c-su")}${bottone("sinistra", "◀", "c-sx")}<span class="c-mezzo"></span>${bottone("destra", "▶", "c-dx")}${bottone("giu", "▼", "c-giu")}
    </div>`;
  }
  return bottone("sinistra", "◀", "grande");
}
function padDx(tasti) {
  if (tasti.includes("colpo")) return bottone("colpo", "A", "grande rosso");
  return bottone("destra", "▶", "grande");
}
