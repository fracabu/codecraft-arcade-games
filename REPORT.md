# REPORT — arcade.nerd v0.1

Data: 20/11/2026 · Cartella: `games-app` · Pubblicazione: Cloudflare Pages, progetto `arcade-nerd`
(URL in fondo, dopo il deploy).

## 1. Da dove è partito
Richiesta: cercare su GitHub cosa esiste per fare giochi online leggeri, usabili da PC e telefono, e
costruire una sala giochi con i giochi divisi per categoria, "semplice e un po' da nerd".

### Ricerca su GitHub (verificata con `gh api`, 20/11/2026)
| Repo | Stelle | Cosa è | Note |
|---|---|---|---|
| gamedev-skills/awesome-gamedev-agent-skills | 9.580 | 79 skill + router, 12 motori | Apache-2.0. È il repo dello short di Riccardo Belli Contarini (pagina riccardobelli.com/gioco). **Usato qui.** |
| Donchitos/Claude-Code-Game-Studios | 40.215 | 49 agenti, ~75 skill, `/prototype` fa un gioco web e lo collauda | MIT. Il più noto; all'inizio aveva ~36 skill. |
| PlayableIntelligence/game-creator | 371 | 31 skill, Phaser + Three.js | Nessuna licenza rilevata da GitHub; usa servizi esterni. |
| majidmanzarpour/threejs-game-skills | 2.859 | 9 skill Three.js | MIT. |
| fagemx/gstack-game | 83 | 27 skill, dal concept al rilascio | MIT. |

Motori web leggeri: Phaser (40,7k), PixiJS (48,9k), Kaplay, LittleJS, Excalibur, Three.js (119k),
Babylon.js, PlayCanvas, Godot con export HTML5.

### Skill installate nel progetto (non globali)
`npx skills add gamedev-skills/awesome-gamedev-agent-skills -a claude-code --copy -s ...`:
router, phaser-core, phaser-arcade-physics, game-feel, input-systems, performance-optimization,
game-ui-ux, prototype-fast, puzzle. Solo 9 su 79: con molte skill già presenti nella sessione, il README
del pacchetto avverte che le descrizioni vengono tagliate e il router sceglie peggio. Controllate prima
dell'uso: solo Markdown e un file YAML, nessuno script, link solo a documentazione ufficiale.
Dalla skill phaser-core sono venute due correzioni concrete per Phaser 4: `group.children.iterate` non c'è
più (si usa `getChildren()`), e `setTintFill` in v4 scrive solo un errore (si usa `setTint` + `TintModes.FILL`).

### Quali generi (ricerca del 20/11)
Fra i giochi per telefono i più scaricati sono puzzle e simulazione (circa il 20% dei download ciascuno,
Sensor Tower, dati 2024); il gioco più scaricato del 2025 è un puzzle a blocchi su griglia; nella top 10
del 2026 ci sono puzzle a blocchi e a frecce e una corsa infinita; crescono mahjong e tile match. Per i
siti di giochi web (Poki, CrazyGames) i dati sono deboli e si contraddicono: puzzle, azione e arcade in testa.
**Generi, non copie** (indicazione di Francesco): stesse meccaniche, nomi, personaggi e grafica nostri.

## 2. Cosa c'è nella v0.1
- **Home** stile terminale: categorie come cartelle (`/puzzle /arcade /lcd /corsa /tiro /platform /satira`),
  ricerca col tasto `/`, tasti 1–8 per le categorie, frecce e Invio per scegliere, cartucce con anteprima,
  record personale, segni "touch / offline / serve rete / sito esterno". Web app installabile
  (manifest + service worker), home e giochi leggeri disponibili offline.
- **Incastro 8x8** (`/puzzle`): puzzle a blocchi su griglia, 27 forme, combo, fine quando nessun pezzo entra.
  Canvas senza motore; su telefono il pezzo si alza sopra il dito; anche da tastiera (1 2 3, frecce, Invio).
- **Fascia d'Asteroidi** (`/arcade`): Phaser 4.2.1, grafica tutta disegnata dal codice. Schiva, **spara**
  (Spazio o Z; col dito o il mouse premuto spara da sola), raccogli cristalli, tre scudi. I sassi grandi
  incassano più colpi e valgono di più; dopo 45 secondi doppio raggio. Suoni sintetizzati.
- **Cache Miss** e **Bug Bash** (`/lcd`): portatili a cristalli liquidi fatti in SVG con un motore comune
  (`lcd/motore.js`): segmenti fissi con l'ombra degli spenti, display a 7 segmenti, bip piezo, ritmo a scatti
  che accelera, GAME A / GAME B, tre errori, azzeramento errori a 200 e 500 punti. Su telefono in verticale
  schermo sopra e tasti sotto; in orizzontale tasti ai lati. *Bug Bash sostituisce "Caffè di Turno" del
  piano*: la meccanica a rimbalzi che avevo in mente ricalcava troppo da vicino un portatile esistente,
  il "schiaccia-bug" a sei buchi è un genere generico.
- **Il 25%** e **Il Grande Circo** (`/satira`): i giochi di Fermo Posta copiati da `zerohedge-app/giochi/`
  senza modifiche (Phaser 3.80.1 da cdnjs, servono la rete).
- **Il Gufo Enigmista** (`/platform`): cartuccia che apre https://gufo-enigmista.pages.dev/ (resta sul suo sito
  con contatore e privacy propri).
- **Classifica locale** per ogni gioco: top 10 nel `localStorage`, iniziali a 3 lettere. Nessun dato esce dal dispositivo.
- **Luna Park** (`/tiro`, aggiunto il 20/11 su richiesta "fai tipo duck hunt"): tiro al bersaglio a volo nel
  baraccone di un luna park nerd di notte. Bersagli nostri: floppy volanti, piccioni di latta, una rara chiavetta
  USB d'oro (500 punti). 3 colpi per volo, 10 bersagli per round, ne servono 6 (7 dal round 3, 8 dal round 6);
  dal round 3 volano in coppia; round perfetto = bonus. Un robottino gestore commenta da dietro il bancone.
  Mirino col mouse (o frecce + Spazio), col dito si tocca (tolleranza più larga). Feedback secondo la skill
  game-feel: colpo = suono e lampo; bersaglio colpito = pausa di 50 ms, coriandoli, numero che sale, scossa
  leggera; chiavetta d'oro = versione grande.
- **In arrivo** (cartucce già visibili): Parola del Giorno, Kilobyte, Circuiti, Drone, Cavo, Firewall,
  Vicoli, Salto Quantico (platform).

## 3. Collaudo
`node strumenti/prova.mjs --base http://127.0.0.1:5491/` sulla cartella `dist/` (quella che si pubblica),
Chromium di Playwright 1.64.1: **47 prove su 47 passate** nella v0.1; **53 su 53** dopo l'aggiunta di Luna Park.
- Home e 6 giochi locali a 390x844 (telefono touch), 844x390 (telefono orizzontale), 768x1024 (tablet),
  1440x900 (PC): si aprono senza errori in pagina, console o rete; la home senza scroll orizzontale.
  Scatti in `_scatti/` (non versionati).
- Home: 7 cartucce pronte, la cartella `/lcd` ne mostra 2, la ricerca "bug" trova Bug Bash.
- Incastro: trascinamento vero col mouse, la riga piena si svuota.
- Fascia d'Asteroidi: parte col tocco, il tempo scorre, tre colpi chiudono la partita, il record si salva,
  "rigioca" riparte. Sparo provato a parte con tasti veri: un tocco di Spazio = un colpo, tenuto = raffica
  (6 colpi in un secondo).
- Cache Miss: il tasto a schermo sposta il sistemista; un pacchetto perso è un errore; uno preso fa punto.
- Bug Bash: frecce e Spazio da tastiera schiacciano un bug.
- Luna Park: un round intero giocato col mouse vero, mirando ai bersagli in volo, porta al round 2
  (2.050 punti col bonus del round perfetto); un colpo a vuoto consuma una cartuccia e non fa punti.
  Corretti dopo gli scatti: fumetto del robot fuori schermo; cartello iniziale troppo grande sul telefono
  in orizzontale.
- Offline: dopo una visita, a rete staccata si aprono la home e Cache Miss.
- **FPS**: Fascia d'Asteroidi con la CPU rallentata 4x in Chromium headless (WebGL software, senza GPU)
  ha dato fra 31 e 56 FPS a seconda del giro. Il numero non dice molto su un telefono vero, che ha la GPU:
  va misurato lì.

Problemi trovati e corretti durante il collaudo: `children.iterate` di Phaser 3 (errore in Phaser 4);
HUD sopra il link "sala giochi"; righe dei pacchetti sopra le etichette dei server; un pacchetto arrivato
sul vassoio durante la pausa dopo un errore veniva contato perso; il link "sala giochi" copriva il titolo dei
portatili in orizzontale; barra di ricerca non allineata; service worker che in sviluppo serviva file vecchi
(la versione con lo sparo non arrivava: ora in sviluppo va sempre prima in rete).

Visto una volta e non riprodotto: Il Grande Circo a 768x1024 ha dato `Cannot read properties of undefined
(reading 'style')` in un giro; in 5 aperture successive nessun errore. È codice del gioco originale, non toccato.

## 4. Pesi (`node strumenti/prepara_dist.mjs`)
Totale pubblicato 5,55 MB in 83 file, ma quasi tutto è Il Grande Circo (3,99 MB fra immagini e suoni) e
Phaser (1,34 MB, compresso da Cloudflare). Home 22 KB + 17 KB di motore LCD; Incastro 14 KB, Cache Miss 6 KB,
Bug Bash 7 KB, Fascia d'Asteroidi 15 KB più Phaser. Il service worker scarica subito solo i file leggeri:
Phaser entra in cache alla prima partita di Fascia d'Asteroidi.

## 5. Cosa manca
- **Non ancora provato da una persona** su un telefono vero (tocco, suono, velocità, installazione come app).
- Classifica condivisa fra giocatori (Pages Function + KV come il contatore del Gufo): per ora solo locale.
- I giochi "in arrivo", uno per sessione.
- I due giochi di satira caricano Phaser 3 da cdnjs e un font da Google Fonts: non vanno offline.

## 6. Pubblicazione
- **https://arcade-nerd.pages.dev/** · Cloudflare Pages, progetto `arcade-nerd`, branch `main`, 20/11/2026,
  82 file (versione cache `c1e01f686a`).
- Progetto creato con `wrangler pages project create arcade-nerd --production-branch main --force`: senza
  `--force` wrangler 4.165 prova a passare a Workers e fallisce (come già scritto in
  `threejs-app/FLUSSO-OPERATIVO-THREEJS.md`). Le pubblicazioni successive non vogliono `--force`.
- Prova sul sito pubblicato (`node strumenti/prova.mjs --veloce --base https://arcade-nerd.pages.dev/`):
  **32 su 32**: home e 6 giochi alle quattro misure di schermo, senza errori. Intestazioni `_headers` attive
  (`nosniff`, `sw.js` in `no-cache`). Il link al Gufo risponde 200.
- Nessun push su GitHub: il repo è solo locale.

### 20/11/2026, notte: Mainframe e nuovo indirizzo
- **https://codecraft-arcade-games.pages.dev/** · progetto Cloudflare Pages `codecraft-arcade-games`
  (creato anche lui con `--force`), 89 file, versione cache `00e575e47e`. Prova sul sito pubblicato: **40 su 40**.
  Il vecchio `arcade-nerd.pages.dev` è ancora online con la v0.1 senza Mainframe: non è stato toccato.
- Repo **privato** su GitHub: https://github.com/fracabu/codecraft-arcade-games
- Footer della home: "sviluppato da codecraft" col logo del sito (SVG del Colosseo con l'arco arancio, preso
  da `codecraft-studio/src/components/common/LogoCodecraft.vue`) e link a https://www.codecraft.it.
- **Mainframe** (`/platform`): collaudo locale **65 su 65**, con camminata, scala, salto della bobina e spina
  staccata da tastiera vera; croce e SALTA col dito. Con la GPU vera: 60 fps fissi.
- Anche Mainframe non è ancora stato provato da una persona su un telefono vero.
- Poi, su ok di Francesco: repo reso **pubblico** (prima aggiunti `.claude/skills/LICENSE` Apache-2.0 e `NOTICE.md`
  con la provenienza delle skill); progetto Cloudflare `arcade-nerd` **cancellato**
  (`wrangler pages project delete arcade-nerd`): `arcade-nerd.pages.dev` ora risponde 530. Resta solo il nuovo indirizzo.

### 21/11/2026: Rete! (calcio) e nuova cartella /sport
- **Rete!** (`giochi/rete/`, cartella nuova `/sport`): calcetto in gabbia visto dall'alto, chiesto "tipo Kick Off"
  (genere, non copia: nomi, squadre e grafica nostri). Porta palla, passa (il comando va al compagno), tira con un tocco,
  ruba palla in scivolata o entrando su chi la porta. Portieri con tempo di reazione, pali, traversa, gabbia su cui la palla
  rimbalza (niente rimesse). Coppa dei Server: sei avversari (Dinamo Debug, Sporting Cache, Atletico Kernel, Union Overflow,
  Real Mainframe, Olimpia Quantum), due minuti a partita, pareggio = golden gol di 45 s, poi passa chi ha tirato di più in
  porta; persa una partita si è fuori. Radar del campo.
- **Prima versione bocciata** da Francesco alla prima partita ("orrendo ingiocabile quasi"), con 76 prove su 76 passate.
  Una prova nuova, giocata come una persona (tasti veri, nessun aggancio), ha dato il motivo: la palla "libera" alla
  Kick Off era a portata di piede in 2 campioni su 80; e sul PC il campo era una striscia verticale con due terzi di
  schermo neri, giocatori di 10 pixel. Lezione scritta nel brain del metodo: `il-collaudo-non-gioca`.
- **Seconda versione**: campo più piccolo (240x400) e giocatori più grandi; palla al piede di chi la conduce, che si può
  rubare; tiro immediato; canvas a tutto schermo alla risoluzione vera (orizzontale sul PC, verticale sul telefono) con la
  telecamera che ingrandisce; punteggio, titoli e radar in HTML. La stessa prova "da persona" ha poi trovato 14 gol subiti
  su 20 nati dal rinvio del nostro portiere contro l'attaccante fermo davanti a lui: ora il rinvio va alto e gli avversari
  si allontanano mentre il portiere ha la palla; un contrasto fallito fa schizzare la palla di lato.
- Poi, su richiesta ("il pallone lo levo solo in scivolata o andando molto vicino?"): contrasto con più margine per noi
  (sul pallone o addosso a chi lo porta, ma non alle spalle), scivolata che porta via il pallone anche se manca le gambe
  (a vuoto si resta a terra più a lungo), chi porta palla pressato da vicino a volte la perde. Squadre forti rinforzate.
- In simulazione (bot in Node): 8 vittorie su 8 con le prime tre squadre, 4 su 8 con Real Mainframe, 1 su 8 con la finale.
  Collaudo locale **76 su 76** (11 prove di Rete! riscritte per la nuova meccanica).
- Non ancora pubblicato; la seconda versione aspetta il giudizio di Francesco.

### 21/11/2026: Reperibile (survivors-like), primo prototipo "da Steam"
- Nato dalla domanda "giochi fichi per Steam o App Store": ricerca sul metodo di Riccardo Belli Contarini (pagina
  riccardobelli.com/gioco: le stesse 79 skill di gamedev-skills già usate qui; la pubblicazione su Steam/App Store
  "la fai tu", non è descritta) e sui generi che vendono; scelto il survivors-like (Megabonk, Brotato), prototipo
  fatto dentro la sala su richiesta.
- **Reperibile** (`giochi/reperibile/`, /arcade): sei il sistemista reperibile, dalle 22:00 alle 06:00 (10 minuti).
  Nemici: bug, topi, glitch, due ticket urgenti (boss), uno sciame a ogni ora. Armi automatiche: tazza di caffè,
  paperelle di gomma, cavo di rete, estintore; sei potenziamenti passivi; a ogni livello tre carte. Tema scelto per
  non ricalcare Desktop Survivors 98 (survivors-like già ambientato nel desktop di un PC).
- Tarato in simulazione prima della grafica: alla prima versione si moriva in 28 s da fermi e in un minuto scappando.
  Poi, con tasti veri (pagina `il-collaudo-non-gioca` del brain del metodo): 90 s sopravvissuti, 4 livelli, 117
  nemici, vita minima 46. Collaudo locale **86 su 86**.
- Non ancora giocato da Francesco, non pubblicato, nessun commit.
