# arcade.nerd

Sala giochi online "da nerd": giochi leggeri per PC e telefono, divisi per categoria, installabile come
web app e giocabile anche offline. Niente framework, niente account, niente tracciamento: HTML, CSS e
JavaScript; Phaser 4.2.1 solo per l'arcade.

## Provare in locale
```
npm install                      # phaser (per vendor/) e playwright (per i test)
node strumenti/serve.mjs         # http://127.0.0.1:5490/
node strumenti/prova.mjs         # collaudo completo (serve il server acceso); --anteprime rifà le immagini
```

## Pubblicare (Cloudflare Pages)
```
node strumenti/prepara_dist.mjs  # copia in dist/ i soli file pubblici e timbra la versione della cache
npx wrangler pages deploy dist --project-name arcade-nerd --branch main
```

## Aggiungere un gioco
1. Una cartella `giochi/<slug>/` con `index.html` autosufficiente (link `../../` per tornare alla sala,
   `../../comune/gioco.css` e `../../comune/classifica.js` per fine partita e classifica locale).
2. Una voce in `catalogo.json` con `stato: "pronto"` (le cartucce `in-arrivo` sono già lì).
3. Se deve andare offline subito, i suoi file in `SUBITO` dentro `sw.js`; altrimenti entra in cache alla prima partita.
4. Per le prove: esporre `window.__ready = true` e un `window.GIOCO` con `stato()`; `node strumenti/prova.mjs --anteprime`.

Un gioco LCD si fa con `lcd/motore.js`: si descrivono segmenti e regole (`disegna`, `nuovaPartita`, `passo`,
`tasto`), il motore fa guscio, ritmo, punteggio, errori, bip e fine partita. Esempi: `giochi/cache-miss/`, `giochi/bug-bash/`.

## Struttura
- `index.html`, `stile.css`, `hub.js`, `catalogo.json`: la home
- `comune/`: classifica locale e fine partita, stile comune
- `lcd/`: motore dei portatili a cristalli liquidi
- `giochi/`: un gioco per cartella
- `vendor/phaser-4.2.1.min.js`: Phaser in locale (serve all'offline)
- `strumenti/`: server, collaudo, icone, preparazione di `dist/`
- `.claude/skills/`: skill di `gamedev-skills/awesome-gamedev-agent-skills` usate per costruire i giochi
