# arcade.nerd

Sala giochi online "da nerd": giochi leggeri per PC e telefono, divisi per categoria, installabile come
web app e giocabile anche offline. Niente framework, niente account, niente tracciamento: HTML, CSS e
JavaScript; Phaser 4.2.1 solo per arcade e platform.

**Si gioca qui: https://codecraft-arcade-games.pages.dev/**

Sviluppato da [codecraft](https://www.codecraft.it).

## I giochi

| gioco | categoria | come si gioca |
|---|---|---|
| Incastro 8x8 | puzzle | trascina i pezzi, riempi righe e colonne |
| Fascia d'Asteroidi | arcade | schiva e spara in un campo di sassi che accelera |
| Cache Miss | lcd | il sistemista prende al volo i pacchetti di quattro server |
| Bug Bash | lcd | schiaccia i bug prima che arrivino in produzione |
| Luna Park | tiro | floppy volanti e piccioni di latta, tre colpi per volo |
| Mainframe | platform | sali l'impalcatura, salta le bobine di nastro, in cima stacca la spina |
| Il Gufo Enigmista | platform | platform con enigmi, si apre sul suo sito |
| Il 25% · Il Grande Circo | satira | i giochi di Fermo Posta sui fatti veri |

Ogni gioco tiene una classifica locale (top 10, solo nel dispositivo: nessun dato esce).
Comandi: tastiera sul PC, tasti o gesti a schermo sul telefono.

## Provare in locale
```
npm install                      # phaser (per vendor/) e playwright (per i test)
node strumenti/serve.mjs         # http://127.0.0.1:5490/
node strumenti/prova.mjs         # collaudo completo (serve il server acceso); --anteprime rifà le immagini
```

## Pubblicare (Cloudflare Pages)
```
node strumenti/prepara_dist.mjs  # copia in dist/ i soli file pubblici e timbra la versione della cache
npx wrangler pages deploy dist --project-name codecraft-arcade-games --branch main
```
Oppure `npm run deploy`, che fa le due cose in fila.

## Aggiungere un gioco
1. Una cartella `giochi/<slug>/` con `index.html` autosufficiente (link `../../` per tornare alla sala,
   `../../comune/gioco.css` e `../../comune/classifica.js` per fine partita e classifica locale).
2. Una voce in `catalogo.json` con `stato: "pronto"` (le cartucce `in-arrivo` sono già lì).
3. Se deve andare offline subito, i suoi file in `SUBITO` dentro `sw.js`; altrimenti entra in cache alla prima partita.
4. Per le prove: esporre `window.__ready = true` e un `window.GIOCO` con `stato()`; `node strumenti/prova.mjs --anteprime`.

Un gioco LCD si fa con `lcd/motore.js`: si descrivono segmenti e regole (`disegna`, `nuovaPartita`, `passo`,
`tasto`), il motore fa guscio, ritmo, punteggio, errori, bip e fine partita. Esempi: `giochi/cache-miss/`, `giochi/bug-bash/`.

Mainframe separa il mondo dal disegno: `giochi/mainframe/regole.js` (travi inclinate, scale, bobine, punti,
a passo fisso di 1/60 s) non conosce Phaser e si prova anche in Node; `gioco.js` disegna, suona e legge i comandi.
Due cose imparate lì, valide per ogni gioco Phaser 4 del repo:
- il `delta` che Phaser passa a `update` resta ~17 ms anche quando i fotogrammi calano: il tempo di gioco
  va misurato con `performance.now()`, altrimenti sui telefoni lenti si gioca al rallentatore;
- quello che non si muove va disegnato una volta (canvas 2D → texture), non con un `Graphics` ridisegnato a ogni fotogramma.

## Struttura
- `index.html`, `stile.css`, `hub.js`, `catalogo.json`: la home
- `comune/`: classifica locale e fine partita, stile comune
- `lcd/`: motore dei portatili a cristalli liquidi
- `giochi/`: un gioco per cartella
- `vendor/phaser-4.2.1.min.js`: Phaser in locale (serve all'offline)
- `strumenti/`: server, collaudo, icone, preparazione di `dist/`
- `.claude/skills/`: skill di `gamedev-skills/awesome-gamedev-agent-skills` usate per costruire i giochi

## Licenza
Codice dei giochi e della sala: [MIT](LICENSE), © 2026 codecraft.
Fanno eccezione e restano con la loro licenza: `vendor/phaser-4.2.1.min.js` (Phaser, MIT, Phaser Studio Inc., avviso in `vendor/LICENSE-phaser.md`)
e `.claude/skills/` (Apache-2.0, vedi `.claude/skills/NOTICE.md`).
