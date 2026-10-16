# Arquitectura y contratos entre módulos

Este documento es el contrato técnico del juego. `docs/DISENO.md` dice **qué** hace el juego (reglas, niveles, historia);
este archivo dice **cómo** se reparte el código y qué interfaz exacta expone cada módulo. Si algo choca, manda
este archivo en las interfaces y `DISENO.md` en las reglas de juego. `docs/PERSONAJES.md` manda en el aspecto de los personajes.

(Agent-facing technical contract; written in English for precision. In-game text is always Latin-American Spanish.)

## 0. Ground rules

- Static site. No build step to play: `index.html` + `css/*.css` + `js/**/*.js`, loaded with classic `<script>` tags
  (no ES modules, no `fetch` of local files, no external JS libraries). Must work from `file://`, GitHub Pages and a
  sandboxed iframe (Claude artifact). Only external resource allowed: Google Fonts stylesheet (with system fallbacks).
  **Exceptions (§14-§16), all lazy and optional:** `Cocardo.Cloud` injects the Firebase *compat* SDK from gstatic
  only when configured, served over http(s), not framed, and only on user action (or to restore a previous session);
  `Cocardo.Track` loads `gtag.js` only when a GA4 id is configured; `Cocardo.Clip` may use a temporary `<a download>`
  (never inside an iframe). Without configuration none of them touches the network and the game is identical.
- Every module attaches to the single global namespace `window.Cocardo` (create it if missing:
  `var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});`).
- Pure modules (`js/core/*`) must also work in Node: end with
  `if (typeof module !== 'undefined' && module.exports) module.exports = <ModuleObject>;` and must not touch
  `window`, `document`, `localStorage`, `Date.now()` or `Math.random()` (randomness only via the seeded RNG).
  In Node they `require()` each other with relative paths when needed (e.g. engine requires rng).
- Never use `alert`, `confirm`, `prompt`, `window.open`, `<a download>`, `window.print`.
- `localStorage` access only through `Cocardo.Save` (all wrapped in try/catch with in-memory fallback).
- Audio only after the first user gesture (`Cocardo.Audio.unlock()` is called from the first tap).
- Code style: identifiers in English, short comments in Spanish, 2-space indent, semicolons, `'use strict'` inside
  each file's IIFE. No transpilation: target evergreen browsers (ES2019 is fine: arrow functions, classes, const/let,
  template strings, spread; avoid `?.`/`??` only if you want old Safari 13 — they are allowed).
- Script load order in `index.html`:
  `js/core/rng.js, js/core/engine.js, js/core/levels.js, js/core/daily.js, js/core/progress.js, js/story.js, js/art.js,
  js/art-characters.js, js/audio.js, js/save.js, js/fx.js, js/render.js, js/game.js, js/cloud-config.js, js/cloud.js,
  js/analytics.js, js/clip.js, js/ui.js, js/main.js`.

## 1. File ownership

| File | Owner (build step) | Kind |
|---|---|---|
| `js/core/rng.js`, `js/core/engine.js`, `js/core/replay.js`, `tests/engine.test.js`, `tests/fuzz.test.js`, `tests/helpers.js` | Engine (done) | pure |
| `js/core/levels.js`, `js/core/daily.js`, `js/story.js`, `tests/levels.test.js`, `tests/daily.test.js` | Content | pure data/logic |
| `js/art.js`, `tools/art-preview.html` | Art (board) | browser (strings only, no DOM needed) |
| `js/art-characters.js`, `tools/portraits-preview.html` | Art (characters) | browser (strings only); adds `Cocardo.Art.characters` and `Cocardo.Art.portrait` |
| `js/audio.js`, `tools/audio-preview.html` | Audio (done) | browser |
| `index.html`, `css/style.css`, `js/save.js`, `js/ui.js`, `js/main.js`, `manifest.webmanifest`, `sw.js`, `icons/` | Shell | browser |
| `js/core/progress.js`, `tests/progress.test.js` | Cloud | pure |
| `js/cloud-config.js`, `js/cloud.js`, `js/analytics.js`, `js/clip.js`, `firebase/*`, `docs/FIREBASE.md` | Cloud | browser |
| `landing.html`, `css/landing.css`, `tools/build-icons.cjs`, `tools/record.cjs`, `docs/CRECIMIENTO.md` | Growth | browser / node |
| `css/game.css`, `js/fx.js`, `js/render.js`, `js/game.js` | Board | browser |
| `tools/sim.js` | Balance | node |
| `tests/e2e.cjs` | QA | node + playwright |

Do not edit files you do not own during the parallel build; if you need something from another module, code against
this contract.

## 2. Shared constants

Colors (tile flavors = the six freezer victims), index order matters (ties, RNG picks):

| idx | code | character id | name |
|---|---|---|---|
| 0 | `L` | `lima` | Lima |
| 1 | `F` | `fresa` | Fresa |
| 2 | `B` | `banana` | Banana |
| 3 | `U` | `uva` | Uva |
| 4 | `N` | `naranja` | Naranja |
| 5 | `D` | `durazna` | Durazna |

Character ids (exactly these, see `docs/PERSONAJES.md`, which is binding for looks and names):
- main cast (10): `cocardo, lima, cereza, pina, banano, banana, fresa, durazna, uva, naranja`
- secondary (6): `limon, policia_fresa, policia_sandia, guardaespaldas, brocoli, reportera`

Display names: Cocardo, Lima, Cherry (id `cereza`; the press calls her Cereza), Don Piña, Banano, Banana, Fresa,
Durazna, Uva, Naranja, Limón, La oficial, El oficial Sandía, El guardaespaldas, El repartidor, La reportera.
Note: **Banano** (male, bearded investigator) and **Banana** (his sister, a victim and a tile color) are different
characters. `docs/DISENO.md` §6 and §8 predate the research: where they disagree with `docs/PERSONAJES.md`
(looks, who is the detective, dialogue), PERSONAJES wins.

Cell coordinates are `{r, c}` with `r` = row from top (0) and `c` = column from left (0).

## 3. `Cocardo.RNG` (js/core/rng.js)

```js
Cocardo.RNG = {
  // mulberry32. State is a uint32 stored by the caller (engine keeps it in state.rng).
  next(state) -> { value: number in [0,1), state: uint32 },
  seedFrom(anyNumberOrString) -> uint32,   // stable hash (e.g. FNV-1a on String(x))
};
```

## 4. `Cocardo.Engine` (js/core/engine.js) — pure, deterministic

### 4.1 Level object (input; produced by `Cocardo.Levels`)

```js
{
  id: 1,                       // 1..30 (daily uses a copy with id kept and daily:true)
  chapter: 1,                  // 1..6
  name: 'Primer helado',       // Spanish display name
  boss: false, hard: false, final: false,
  layout: [ '........', ... ], // rows top->bottom, all rows same length (7 or 8)
  colors: 'LFBU',              // 4..6 color codes from section 2
  moves: 20,
  goals: [ {type:'color', color:'L', n:12} | {type:'ice'} | {type:'crate', n:12} | {type:'rescue'} | {type:'token'} | {type:'boss'} ],
  rescue: ['lima'],            // characters inside 'R' cells, in reading order (required iff layout has 'R')
  friendHP: 2,                 // HP of each 'R' cell (default 2)
  freezer: { who:'cocardo'|'cereza', hp: 8 },   // required iff layout has 'C'
  villains: [ { who:'cocardo'|'cereza', act:'frost'|'crate', every:5, count:1, src:'hud'|'boss' } ],
  tokens: { skin:'uva'|'prueba', total:3, onBoard:1 },   // required iff goal 'token'
  ensure: 'ph'|'bomba'|'copa',  // optional (see DISENO §3.7). 'ph' means "any Paleta" (ph or pv)
  teach: 'swap'|'paleta'|'bomba'|'hielo'|'copa'|'hp2'|'pedido'|'cucharon'|'escarcha'|'villano'|'congelador'|'chorro'|'colores6'|'batido'|'cajas'|'cereza'|'dosvillanos'|'ficha'|'pruebas',  // optional
}
```

Layout legend (one char per cell):

| char | meaning |
|---|---|
| `#` | void (not part of the board) |
| `.` | random normal piece |
| `e` | random normal piece with frost (Escarcha) |
| `1` `2` `3` | ice block (Bloque de Hielo) with that HP |
| `K` | crate (Caja sospechosa), HP 1 |
| `R` | frozen friend (Fruta Congelada), HP = `friendHP`, character from `rescue[]` in reading order |
| `C` | Congelador cell; exactly four `C` forming one 2×2 square; HP = `freezer.hp` |
| `T` | random normal piece at start replaced by a token of `tokens.skin` (counts toward `spawned`) |

Goal targets at `createGame`: `color` → `n`; `ice` → number of ice cells (`1`/`2`/`3`) in the layout;
`crate` → `n`; `rescue` → number of `R`; `token` → `tokens.total`; `boss` → `freezer.hp`.

### 4.2 State (output; JSON-cloneable, never mutated by the engine — every call returns a new state)

```js
{
  levelId, daily: false, rows, cols, colors: ['L','F',...],
  rng: uint32, nextId: int, turn: int,
  grid: Cell[rows][cols],
  //  Cell = null                                  -> void
  //       | { b: { kind:'ice'|'crate'|'friend', hp, maxHp, who? } }   -> blocker (who only for friend)
  //       | { b: { kind:'freezer' } }             -> one of the 4 Congelador cells (hp lives in state.freezer)
  //       | { p: Piece }                          -> piece
  //  Piece = { id:int, type:'n'|'ph'|'pv'|'bomba'|'copa'|'token', color:'L'|...|null, frost:bool, skin?:'uva'|'prueba' }
  freezer: null | { r, c, hp, maxHp, who },       // r,c = top-left cell
  movesLeft, movesTotal, score,
  goals: [ { type, color?, target, remaining } ],  // same order as level.goals
  villains: [ { who, act, every, count, src, counter } ],   // counter starts at `every`
  tokens: null | { skin, total, onBoard, spawned, collected },
  rescued: [ 'lima', ... ],                       // in rescue order
  status: 'playing'|'won'|'lost',
  stats: { maxCascade, specials, combos },
}
```

### 4.3 API

```js
Cocardo.Engine = {
  createGame(level, seed) -> state,
  validMoves(state) -> [ {a:{r,c}, b:{r,c}} ],          // all swaps that would be valid (DISENO §3.2)
  hint(state) -> {a, b} | null,                           // best move by DISENO §2 ranking
  canSwap(state, a, b) -> boolean,
  applySwap(state, a, b) -> { state, steps, turnInfo },   // invalid swap: steps = [ {kind:'invalid', events:[{t:'invalid',a,b}]} ], state unchanged (movesLeft not spent)
  useBooster(state, type, cell) -> { state, steps },     // type 'cucharon'|'chorro'|'batido'; cell ignored for batido; throws/returns null on illegal target
  heladoFinal(state) -> { state, steps },                // only when status === 'won'
  goalUnits(state) -> { remaining, start },              // for the near-miss text
  starsFor(state) -> 0..3,
  isStable(state) -> boolean,                            // no matches on board (testing helper)
  findMatches(state) -> groups,                           // testing helper
  // optional test helper: fromRows(rows, opts) builds a state from a fully specified board for unit tests
};
```

`turnInfo = { valid:boolean, cascades:int (max c reached), combo:boolean (special+special swap), cleared:int, specials:int }`.

### 4.4 Steps and events (animation script)

`steps` is an array of **Step** objects played in order by the renderer. Events inside a step animate together.

```js
Step = { kind, cascade, events: Event[], score, movesLeft, goals: [remaining,...] }   // score/goals/movesLeft = values AFTER this step
kind ∈ 'swap' | 'invalid' | 'clear' | 'activate' | 'create' | 'fall' | 'villain' | 'shuffle' | 'booster' | 'transform' | 'end'
```

Event shapes (`t` = type). Positions always refer to the board **before** the step for removals and **after** for placements.

| t | fields | meaning |
|---|---|---|
| `swap` | `a, b, ids:[idA,idB], back:boolean` | pieces exchanged (`back:true` = bounce back of invalid swap) |
| `invalid` | `a, b` | swap rejected (renderer plays swap + swap back) |
| `cascade` | `c` | first event of each clear step; c = 1,2,3... |
| `clear` | `id, r, c, color, type, points` | piece removed by a match or blast |
| `unfrost` | `id, r, c` | frost broken, piece stays |
| `damage` | `r, c, kind, hp` | blocker hit, `hp` = remaining (> 0); for freezer r,c = its top-left |
| `destroy` | `r, c, kind` | ice/crate reached 0 → cell is now an empty slot |
| `rescue` | `r, c, who` | friend block reached 0 → character freed, cell is empty slot |
| `freezerDown` | `r, c, who` | Congelador destroyed → its 4 cells are empty slots |
| `activate` | `id, r, c, type, color, cells:[{r,c}]` | special fires; `cells` = area hit (for beams/rings) |
| `combo` | `a, b, types:[t1,t2], r, c, cells` | special+special swap effect |
| `create` | `id, r, c, type, color` | new special placed |
| `transform` | `id, r, c, type, color?` | an `n` piece becomes a special (Copa+Paleta/Bomba, Helado Final) |
| `fall` | `id, from:{r,c}, to:{r,c}` | piece moves down (can jump over fixed cells) |
| `spawn` | `id, to:{r,c}, type, color, skin?, from:int` | new piece enters; `from` = virtual start row (negative, e.g. -1,-2…) for drop-in |
| `collect` | `id, r, c, skin` | token collected (removed) |
| `villain` | `who, act, src, targets:[{r,c,id}]` | frost: targets get frost; crate: target pieces removed and replaced by crate blockers |
| `shuffle` | `pieces:[{id, r, c, color, type, frost}]` | full new piece layout after shuffle (`reason:'nomoves'|'batido'`) |
| `points` | `r, c, value` | floating score text anchor |
| `goal` | `index, remaining` | a goal counter changed (for flying icons) |
| `win` / `lose` | — | final event of the turn |

Rules for step ordering per resolve iteration (DISENO §3.4): `clear` step (starts with `cascade` event) → one `activate`
step per wave → `create` step (if any) → `fall` step (+ `collect` events in the same or a following `fall` step) → next
cascade… → after stable: optional `villain` step → optional `shuffle` step → `end` step containing `win`/`lose`
(omitted while still playing).

### 4.5 Determinism

Same `level`, same `seed`, same sequence of calls → identical states and steps (deep-equal). The engine never reads
global state. All randomness comes from `state.rng` through `Cocardo.RNG.next`.

## 5. `Cocardo.Levels` (js/core/levels.js) — pure data

```js
Cocardo.Levels = {
  list: [ level1, ..., level30 ],          // level objects as in 4.1
  chapters: [ { id:1, name:'La heladería en quiebra', zone:'Heladería', color:'#…', levels:[1,2,3,4,5] }, ... ],  // 6 chapters
  get(id) -> level | null,
  count: 30,
};
```

## 6. `Cocardo.Daily` (js/core/daily.js) — pure

```js
Cocardo.Daily = {
  dateKey(y, m, d) -> int YYYYMMDD,               // caller passes local date parts (no Date inside)
  challengeNumber(y, m, d) -> int,                // days since 2026-10-01, +1
  levelFor(key, levelsList) -> level copy (daily:true, moves - 2),   // campaign level 6 + (key % 20)
  seedFor(key) -> uint32,
  moveEmoji(turnInfo) -> string,                  // ⬜ c=1, 🟨 2, 🟧 3-4, 🟥 5+, 🍦 combo
  shareText({ num, won, movesUsed, movesTotal, stars, maxCombo, turns:[turnInfo], streak }) -> string,   // DISENO §9
  campaignShareText({ levelId, stars, rescued:[names] }) -> string,
};
```

## 7. `Cocardo.Story` (js/story.js) — data

```js
Cocardo.Story = {
  scripts: { pre1:[ {who:'cocardo', mood:'burlon', text:'…'} | {sfx:'clac'} | {card:'CONTINUARÁ...'} , ...], post10:[…], cliff5:[…], ending:[…] },
  forLevel(id) -> { pre?:key, post?:key, cliff?:key },
  tips: { 1:'…', … },                           // short tip line for the level intro (optional)
  taunts: { cocardo:{ start:[…], low:[…], act:[…] }, cereza:{ start:[…], low:[…], act:[…] } },
  cascadeText: ['', '', '¡Rico!', '¡Delicioso!', '¡Escandaloso!', '¡DRAMÁTICO!', '¡¡TELENOVELA!!'],  // index = c (6+ uses last)
  album: [ { id:'cocardo', name:'Cocardo', role:'…', quote:'…' (a canonical line), unlock:{ type:'start'|'level'|'rescue', level?:n, who?:id } }, ... 16 ],
  villainFor(levelId) -> 'cocardo'|'cereza',        // main HUD villain (taunts); the HUD shows every villain of level.villains / level.freezer
  helperFor(levelId) -> character id,               // who gives the level-intro tip (e.g. 'lima' in chapter 1, rescued victims later, 'banano' from chapter 5)
  hintPeeker(levelId) -> 'limon'|'banano',          // the head that peeks from the board edge with the hint
  chapterTitles: [ 'Parte …', … ],                  // optional subtitles shown on the map per chapter
};
```

`who` values are character ids; `mood` values: `normal, feliz, triste, enojado, asustado, sorprendido, burlon, nervioso,
furioso, carcajada, llorando, coqueta` (art must accept any of these for any character; unknown → `normal`).

## 8. `Cocardo.Art` (js/art.js) — SVG strings, no DOM access required

All functions return complete `<svg …>` strings with an explicit `viewBox`, `xmlns="http://www.w3.org/2000/svg"`, and
only internal references (unique gradient ids per call: use a counter suffix). No external images or fonts inside SVG.

```js
Cocardo.Art = {
  characters: { cocardo:{ name:'Cocardo', fruit:'coco', color:'#…' }, ... },   // 16 entries (10 main + 6 secondary)
  portrait(id, mood='normal', opts={}) -> svg,     // viewBox 0 0 200 200, head-and-shoulders bust, transparent bg; opts.frozen (icy overlay + frost, blank eyes), opts.silhouette (dark icy silhouette for album locks), opts.variant ('carcel' for jailed Cocardo, 'huida' for Cherry's escape look, 'tubo' for Durazna with the pipe, 'panecitos' for Naranja with the bag)
  tile(color, opts={}) -> svg,                     // viewBox 0 0 100 100; color = 'L'|'F'|'B'|'U'|'N'|'D'; opts.type = 'n'|'ph'|'pv'|'bomba'; opts.face = 'normal'|'blink'|'scared'|'happy'
  copa(opts={}) -> svg,                            // Copa Arcoíris, viewBox 0 0 100 100
  token(skin) -> svg,                              // 'uva' (Uva fugitiva) | 'prueba' (evidence folder/bag), 100x100
  frost() -> svg,                                  // translucent frost overlay, 100x100
  ice(hp, maxHp) -> svg,                           // ice block with crack stage, 100x100
  crate() -> svg,                                  // wooden crate with cherry stamp, 100x100
  friend(who, hp, maxHp) -> svg,                   // ice block with the character inside, 100x100
  freezer(who, hp, maxHp) -> svg,                  // Congelador covering 2x2 cells: viewBox 0 0 200 200, owner's face on the door (blue Cocardo / pink Cereza)
  icon(name, opts={}) -> svg,                      // 24x24-ish UI icons: star, starEmpty, lock, pause, play, sound, mute, music, vibra, map, album, settings, share, flame, back, close, retry, next, snowflake, box, cucharon, chorro, batido, moves, hand, calendar, trophy, check
  logo() -> svg,                                   // game logo «Cocardo» + «¡Rescate Helado!»
  background(zone) -> svg,                         // decorative full-bleed backdrop per map zone (viewBox 0 0 400 800, preserveAspectRatio slice)
};
```

## 9. `Cocardo.Audio` (js/audio.js)

```js
Cocardo.Audio = {
  unlock(),                       // create/resume AudioContext; safe to call many times
  play(name, opts={}),            // no-op when muted, locked or unsupported; never throws
  setMuted(bool), isMuted(),
  setMusic(bool), isMusicOn(),    // P2 cumbia loop; may be a no-op stub
};
```
Sound names: `tap, swap, invalid, match (opts.cascade), special, paleta, bomba, copa, combo, ice (opts.hp), frost, crate,
rescue, token, tick, laugh (opts.who), freezerHit, heartbeat, win, star (opts.i 0..2), lose, drama, blip, villain, shuffle, booster`.

## 10. `Cocardo.Save` (js/save.js)

```js
Cocardo.Save = {
  load() -> data,     // reads localStorage['cocardo.v1'] (DISENO §14) or defaults; never throws
  get() -> data,      // current in-memory data (same object; mutate then call save())
  save(),             // persists; never throws
  reset(),            // defaults + save
  defaults() -> data,
};
```
`data = { v:1, unlocked:1, stars:Array(30).fill(0), best:Array(30).fill(0), boosters:{cucharon:0, chorro:0, batido:0},
boostersUnlocked:{cucharon:false, chorro:false, batido:false}, rescued:[], seen:{}, daily:{ last:0, streak:0,
bestStreak:0, results:{} }, settings:{ sound:true, vibra:true, motion:'auto'|'on'|'off', music:false, skipStory:false,
clips:false }, cloud:{ on:false, nick:'', avatar:'', uid:'' }, ref:'' }`.
`cloud` is a local copy of the cloud profile (so the title chip renders before the SDK loads); `ref` is the nickname
that invited this player (`?r=<nick>`), set once.

## 11. `Cocardo.Game` (js/game.js + render.js + fx.js) — the board screen

```js
Cocardo.Game = {
  mount(containerEl),        // called once by UI with the #screen-game section; builds HUD + canvas + booster bar inside it
  start(level, opts) ,       // opts: { seed, daily:boolean, onEnd(result), onPause() }
  pause(), resume(), restart(), stop(),
  resize(),                  // UI calls on window resize/orientationchange
};
result = { won, stars, score, movesLeft, movesUsed, movesTotal, levelId, daily, turns:[turnInfo], rescued:[ids],
           maxCascade, nearMiss:{ remaining, icon } | null }
```
The Game owns: HUD (villain portrait with mood + countdown badges, moves, goals / «Pedido de Piña» ticket, pause
button), board canvas, booster bar, in-level tutorial overlay (guiding hand), hint, taunt bubbles, cascade texts, Helado
Final. It reads/writes booster counts through `Cocardo.Save` and calls `Cocardo.Audio.play`.
The Shell (ui.js) owns every other screen and navigation (Portada, Mapa, Historia, Intro, Pausa, Victoria, Derrota,
Cliffhanger, Reto Diario, Álbum, Ajustes) and the save/unlock/stars/rescue bookkeeping on `onEnd`.

## 12. Debug hooks

When `location.hash === '#debug'` (or `Cocardo.debugEnabled = true` before boot), `window.Cocardo.debug` exposes:
`{ unlockAll(), go(levelId), win(), lose(), state(), swap(a,b), screen() }` so automated tests can drive the game.
`Cocardo.Game` must expose `_state()` (current engine state) and `_busy()` (true while animating) for tests.

## 13. Visual identity (shared tokens)

Single visual world (no light/dark switch): a candy-colored ice-cream parlor seen through a telenovela lens.
Defined once at the top of `css/style.css` (Shell) and used by `css/game.css` (Board):

```css
:root {
  --ink: #2b1630;          /* texto principal, contornos */
  --cream: #fff6ea;        /* fondo de tarjetas */
  --mint: #bff3e1;         /* toldo/heladería */
  --pink: #ff6fa5;         /* fresa / acento cálido */
  --cherry: #d61f4b;       /* Cereza, alertas */
  --coco: #7a4a2a;         /* Cocardo */
  --ice: #bfe9ff;          /* hielo/congelador */
  --ice-deep: #4aa8e0;
  --gold: #ffc93c;         /* estrellas, telenovela */
  --drama: #5b1e74;        /* morado telenovela */
  --drama-2: #a1286a;
  --ok: #33b679;
  --font-display: 'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif;
  --font-script: 'Yellowtail', 'Brush Script MT', cursive;   /* títulos de telenovela */
  --font-body: 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color-scheme: light;
}
```
Google Fonts link: `https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;800;900&family=Yellowtail&display=swap`.

Layout: `html, body { height: 100% }` (never `100vh` for the app frame), app frame `#app` fills the viewport, respects
safe-area insets, no horizontal scroll at 320–430 px wide, board square = `min(100vw - 24px, available height, 600px)`.
Respect `prefers-reduced-motion` and the in-game "Movimiento reducido" setting (`body.reduced-motion`).

## 14. `Cocardo.Progress` (js/core/progress.js, pure) and `Cocardo.Cloud` (js/cloud.js)

```js
Cocardo.Progress = {
  merge(local, cloud) -> data,       // best of both: max stars/best/unlocked/boosters, union of rescued/seen, newest daily
                                     // streak, both daily results (local wins on ties); settings always from `local`
  summary(data) -> { stars, levels, rescued, bestStreak, finished },   // public profile numbers (ranking)
  forCloud(data) -> data without settings,
  validNick(s) -> { ok:true, nick, key } | { ok:false, reason },       // 3–16 [A-Za-z0-9_ + accents], blocked words
  normalizeNick(s) -> lowercase, accents stripped (uniqueness key),
};
Cocardo.CloudConfig = { firebase:{ apiKey, authDomain, projectId, appId }, firebaseVersion, ga4, siteUrl, social:{ tiktok, instagram } };
Cocardo.Cloud = {
  init(),                       // main.js: restores a previous session (loads the SDK 1.2 s after boot) when the flag is set
  configured(), available(),    // available = configured && http(s) && not framed && fetch
  inAppBrowser() -> bool,       // TikTok/Instagram/Facebook webviews: Google sign-in is blocked there → offer signInAnon
  state() -> 'off'|'idle'|'loading'|'ready'|'error', user() -> { uid, name, photo, anon } | null,
  profile() -> { nick, nickKey, avatar, stars, levels, rescued, bestStreak, finished } | null,
  onChange(fn), offChange(fn),  // fn({ state, user, profile, profileReady, error })
  signIn() -> Promise<user>,    // Google popup (redirect fallback); links an anonymous session, or signs into the existing account
  signInAnon() -> Promise<user>, signOut() -> Promise,
  suggestNick() -> string, saveProfile({ nick, avatar }) -> Promise<{ ok, nick } | { ok:false, reason }>,  // transaction users + nicknames
  sync() -> Promise<bool>,      // pull users/{uid}/private/save, Progress.merge into Save.get(), push
  push() -> Promise,            // debounced upload (UI calls it after every win / official daily)
  submitDaily(key, result) -> Promise<bool>,   // create-only: the rules reject a second attempt
  dailyTop(key, n), topPlayers(n) -> Promise<rows>,   // public reads via the Firestore REST API (no SDK), cached 45 s
};
```
Firestore layout and rules: `firebase/firestore.rules` (users/{uid} public profile, users/{uid}/private/save,
nicknames/{key}, daily/{YYYYMMDD}/scores/{uid}). The UI (ui.js) owns every screen: title chip, account overlay,
profile editor, settings card, ranking card in the daily screen, and the `?r=` referral toast.

## 15. `Cocardo.Clip` (js/clip.js)

```js
Cocardo.Clip = {
  supported() -> bool,                 // MediaRecorder + canvas.captureStream + a known MIME, not framed
  start({ canvas, hud(), audio }) -> bool,   // composes 720×1280 frames (logo, title, board, moves/score, watermark) at 30 fps
  stop() -> Promise<File|null>,        // mp4 when the browser can encode it (Safari, recent Chrome), else webm; max 3 min
  recording(), last(), lastMeta() -> { ms, mime }, discard(),
  share(file, text) -> Promise<'shared'|'saved'|'abort'|'fail'>,   // Web Share with files, else <a download>
};
```
`Cocardo.Audio.captureStream()` returns the mixed audio as a MediaStream for the clip. The UI starts a clip when
`settings.clips` is on (startLevel), stops it in `onEnd`, and adds «Compartir clip» to Victoria/Derrota.

## 16. `Cocardo.Track` (js/analytics.js)

`Cocardo.Track.event(name, params)` sends to GA4 when `CloudConfig.ga4` is set (gtag loaded lazily, events queued
until then); no-op otherwise. Events: `level_start`, `level_end`, `daily_end`, `share`, `clip`, `clips_toggle`,
`sign_in`, `sign_out`, `nick_set`, `referral`, `pwa_open`.
