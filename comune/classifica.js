// Classifica locale (top 10 per gioco, nel localStorage del dispositivo) e schermata di fine partita.
// Nessun dato esce dal dispositivo.
const CHIAVE = (slug) => `arcade-nerd:classifica:${slug}`;
const NOME = "arcade-nerd:nome";

function leggi(k, base) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : base; } catch { return base; }
}
function scrivi(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memoria piena o bloccata: si gioca lo stesso */ }
}

export function classifica(slug) {
  const l = leggi(CHIAVE(slug), []);
  return Array.isArray(l) ? l : [];
}
export function record(slug) {
  return classifica(slug)[0] ?? null;
}
export function entra(slug, punti) {
  const l = classifica(slug);
  return punti > 0 && (l.length < 10 || punti > l[l.length - 1].punti);
}
export function salva(slug, nome, punti) {
  const l = classifica(slug);
  const voce = { nome: nome.toUpperCase().slice(0, 3).padEnd(3, "_"), punti, quando: new Date().toISOString().slice(0, 10) };
  l.push(voce);
  l.sort((a, b) => b.punti - a.punti);
  const top = l.slice(0, 10);
  scrivi(CHIAVE(slug), top);
  scrivi(NOME, voce.nome);
  return top.indexOf(voce);
}

function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function tabella(slug, evidenzia = -1) {
  const l = classifica(slug);
  if (!l.length) return `<p class="fp-vuota">nessun record, ancora.</p>`;
  return `<ol class="fp-tab">${l.map((v, i) =>
    `<li class="${i === evidenzia ? "fp-tuo" : ""}"><span>${String(i + 1).padStart(2, "0")}</span><span>${esc(v.nome)}</span><span>${v.punti}</span></li>`).join("")}</ol>`;
}

/**
 * Mostra la fine partita. Ritorna una Promise che si risolve quando il giocatore sceglie "rigioca".
 * opzioni: { slug, punti, titolo, home = "../../" }
 */
export function finePartita({ slug, punti, titolo = "GAME OVER", home = "../../" }) {
  document.querySelector(".fp")?.remove();
  const el = document.createElement("div");
  el.className = "fp";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Fine partita");
  const nuovo = entra(slug, punti);
  const ultimo = leggi(NOME, "AAA");
  el.innerHTML = `
    <div class="fp-box">
      <p class="fp-titolo">${esc(titolo)}</p>
      <p class="fp-punti">punti <b>${punti}</b></p>
      ${nuovo ? `
        <form class="fp-nome">
          <label>nuovo record! le tue iniziali
            <input name="nome" maxlength="3" value="${esc(ultimo)}" autocomplete="off" autocapitalize="characters" spellcheck="false" pattern="[A-Za-z0-9_]{1,3}">
          </label>
          <button type="submit">salva</button>
        </form>` : ""}
      <div class="fp-classifica">${nuovo ? "" : tabella(slug)}</div>
      <div class="fp-azioni">
        <button type="button" class="fp-rigioca">rigioca <kbd>Invio</kbd></button>
        <a class="fp-home" href="${esc(home)}">sala giochi</a>
      </div>
    </div>`;
  document.body.appendChild(el);

  return new Promise((risolvi) => {
    const rigioca = el.querySelector(".fp-rigioca");
    const form = el.querySelector(".fp-nome");
    const chiudi = () => { document.removeEventListener("keydown", tasti, true); el.remove(); risolvi(); };
    const tasti = (e) => {
      if (form && document.activeElement === form.nome) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); chiudi(); }
    };
    if (form) {
      const input = form.nome;
      setTimeout(() => { input.focus(); input.select(); }, 50);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nome = (input.value.replace(/[^A-Za-z0-9_]/g, "") || "???");
        const pos = salva(slug, nome, punti);
        form.remove();
        el.querySelector(".fp-classifica").innerHTML = tabella(slug, pos);
        rigioca.focus();
      });
    } else {
      setTimeout(() => rigioca.focus(), 50);
    }
    rigioca.addEventListener("click", () => {
      if (form && form.isConnected) form.requestSubmit();
      chiudi();
    });
    // un attimo di pausa, così un tasto premuto per giocare non fa ripartire subito
    setTimeout(() => document.addEventListener("keydown", tasti, true), 400);
  });
}
