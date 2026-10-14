# Cocardo: ¡Rescate Helado! (GDD v1, final)

> **Nota:** este documento se escribió antes de terminar la investigación. Para el aspecto, los nombres y los papeles de los personajes, y para los diálogos, manda `docs/PERSONAJES.md` (fiel a la serie original). En particular: el detective es **Banano** (hermano de Banana); Cherry (Cereza) es una mujer de piel roja con un tallo en la cabeza; Don Piña viste traje vino; las cajas son **cajas del inventario** de Cherry, no pruebas plantadas; las pruebas las reúne Banano. El guion final de historia está en `js/story.js`.

This is a fan-made match-3 game in the line of Candy Crush and Royal Match, based on the viral frutinovela *Cocardo y sus helados* ("La nieve de Lima"). The tone is telenovela but family-friendly: fruits get trapped in ice and are always rescued, and Cocardo and Cereza are comic villains. All in-game text is Latin-American Spanish. The title and settings screens show the footer «Juego de fans hecho con permiso de la creadora. Inspirado en la frutinovela viral.» (single source: `Cocardo.Store.config.fanNote`). The creator gave written permission by email; the game never calls itself «oficial» and does not name her.

**Priority labels:**
- **P0:** blocks shipping.
- **P1:** should ship.
- **P2:** only if time remains.

---

## 1. Scope and loop

**v1 contents:**
- **Campaign (P0):** 30 levels in 6 chapters of 5. The 5th level of each chapter is the chapter finale and boss.
- **Reto Diario (P1):** one seeded board per day, a Wordle-style emoji share text, and a streak.
- **Álbum (P1):** 9 character cards.

**Loop:** Mapa → story bubbles (first time only) → level intro → play (60–180 s) → Victoria or Derrota. After a chapter finale, a «CONTINUARÁ...» cliffhanger card plays, then back to the Mapa.

There are unlimited retries, no lives and no coins.

**Full version (§17):** levels 1–10, the Reto Diario and the Álbum are free forever. Levels 11–30 are a one-time
purchase (US$1,99), but only once selling is switched on (`docs/MONETIZACION.md`). Until then, all 30 levels are free.

## 2. Controls (P0)

**Input setup:** Pointer Events on the board canvas, `touch-action:none`, the context menu suppressed, and `user-scalable=no` in the viewport tag.

**Ways to swap:**
- **Swipe or drag:** press on a piece and move at least max(12 px, 0.3·cell). The piece swaps with its neighbor along the dominant axis. This fires once per press.
- **Tap–tap:**
  - Tap A to give it a highlight ring.
  - Tap an orthogonal neighbor B to swap A and B.
  - Tap a piece that is not a neighbor to select that piece instead.
  - Tap A again to deselect.
- **Keyboard (P1):**
  - Arrow keys move a cursor.
  - Space or Enter selects.
  - An arrow key while something is selected swaps.
  - Esc pauses; M mutes.

**Input rules:**
- Input is ignored while the board resolves. Nothing is queued.
- **Boosters:** tap the booster button, then tap a cell. Tapping the button again cancels.
- **Hint:** after 6 s with no input, the two pieces of the best valid move wiggle and a small Banana head peeks from the board edge. In Chapter 6 it is Cocardo holding a phone. "Best" is ranked: special+special swap > move that creates a Copa > Bomba > Paleta > most pieces cleared.

## 3. Engine rules (P0, pure and deterministic)

`engine.js` never touches the DOM. The same level, seed and inputs always produce the same output. The RNG is mulberry32, and its state is stored in the game state.

### 3.1 Board
**Size and cells:**
- Boards are at most 8×8. Rows run r0 (top) to r7; columns c0 to c7.
- A cell is either **void** (not part of the board) or **playable**.
- A playable cell holds either one **blocker** (fixed) or one **piece**.

**Piece kinds:**

| Kind | Color | Notes |
|---|---|---|
| `n` | colored | Normal piece |
| `ph` / `pv` | colored | Paleta; clears its row / its column |
| `bomba` | colored | Bomba de Coco |
| `copa` | colorless | Copa Arcoíris |
| `token` | colorless | Ficha; see §4 |

Any `n` piece can carry **frost** (Escarcha).

**Colors:** there are 6, exactly the victims: **L** Lima, **F** Fresa, **B** Banana, **U** Uva, **N** Naranja, **D** Durazna. Each level uses 4–6 of them.

**Fixed cells and slots:** void cells, blockers and frosted pieces are **fixed**. Every other playable cell is a **slot**.

### 3.2 Swap
1. A swap needs cells a and b to be orthogonally adjacent, and both must hold non-frosted pieces.
2. If both pieces are specials, the swap is a **combo** (§3.6) and is always valid.
3. A `copa` swapped with an `n` piece is valid. It removes the Copa and every piece of that color; frosted ones lose their frost instead, and specials of that color are queued.
4. Any other swap is performed and is valid only if at least 1 match exists afterward. If not, it swaps back and emits `invalid`; no move is spent.
5. A valid swap costs 1 move. The cascade counter starts at c=1 and the board resolves.

### 3.3 Matches and specials
**What counts as a match:**
- A run is 3 or more consecutive same-color pieces in a row or column. `n`, `ph`, `pv` and `bomba` count, frosted pieces included.
- Void cells, blockers, `copa` and `token` break a run.
- Runs that share at least 1 cell merge into one **group**.

**Which special a group makes** (at most 1 per group, in this priority):
1. Any run of 5 or more makes a **Copa Arcoíris**.
2. A group containing both a horizontal and a vertical run makes a **Bomba de Coco**.
3. A run of 4 makes a **Paleta**: a horizontal run gives `ph` (clears its row), a vertical run gives `pv` (clears its column).

**Where it spawns:** the first candidate below that is not frosted and did not hold a special.
- (a) In cascade 1 only: the swapped cell (a or b) that belongs to the group.
- (b) For a Bomba: the crossing cells, in reading order.
- (c) The longest run's cells, starting at index ⌊len/2⌋ (cells ordered top→bottom, left→right), then the rest of that run in order.
- (d) The remaining group cells in reading order.

If no candidate qualifies, no special is made. The new special takes the group's color; a Copa has none.

### 3.4 Resolve loop (one iteration per cascade level c)
The engine returns `steps: Event[][]`. Events inside one step animate together, and steps play in order.

1. **Clear step:** for every cell in every group:
   - A frosted piece loses its frost (`unfrost`) and stays on the board. It does not count toward goals.
   - A special is added to activation wave 0.
   - Any other piece is removed (`clear`).
   - Each group also deals 1 damage to every blocker orthogonally adjacent to any of its cells. A blocker takes at most 1 damage per group.
2. **Activation waves:** one step per wave. Wave k+1 holds the specials that wave k hit. Each activation removes itself, then hits an area:
   - `ph` / `pv`: its whole row / column. The beam passes through blockers.
   - `bomba`: the 3×3 area around it.
   - `copa` hit by a blast: every piece of the most common color among `n` pieces (on a tie, the lowest color index).

   What a hit does:
   - A frosted piece loses its frost.
   - A special that has not fired yet joins the next wave.
   - An `n` piece is removed.
   - A token is ignored.
   - A blocker takes 1 damage, at most once per blocker per activation.
3. **Create step:** place the new specials in their chosen cells.
4. **Fall step:** in each column, take the slots top→bottom. The pieces in those slots keep their order and move down to fill the lowest slots. They pass over fixed cells and voids; there is no diagonal gravity. Empty top slots get new pieces in a random level color, or a pending token (§4). Events are `fall{id,from,to}` and `spawn{id,to,color,kind}`.
5. **Collect step:** a token resting in the lowest slot of its column is collected (`collect`). Repeat steps 4–5 until nothing is collected.
6. If any match exists, set c to c+1 and go back to step 1. Otherwise the board is stable.

### 3.5 End of turn (once the board is stable)
1. If every goal is complete, the player **wins** (§5).
2. Otherwise, each villain's counter drops by 1. At 0 the villain acts (§4) and its counter resets to `every`. Villains skip this when no moves are left.
3. If no moves are left, the player **loses**.
4. If no valid move exists, the board **shuffles**:
   - Fisher-Yates shuffle the non-frosted `n`, `ph`, `pv` and `bomba` pieces until there are 0 matches and at least 1 valid move (up to 50 tries).
   - If that fails, re-roll the colors of `n` pieces (up to 200 tries).
   - If that fails, remove frost from 3 random pieces and retry.
   - A banner shows «¡Cocardo revolvió la heladería!» («¡Cereza…!» in Chapters 5–6).

### 3.6 Combos (swapping two specials)
Both specials are removed and the effect is centered on b, the target cell. The combo counts as one activation for blocker damage limits, and any specials inside its area chain.

| Combo | Effect |
|---|---|
| Paleta + Paleta | Clears b's row and column |
| Paleta + Bomba | Clears rows b.r−1 to b.r+1 and columns b.c−1 to b.c+1 |
| Bomba + Bomba | Clears 5×5 |
| Copa + Paleta | Every non-frosted `n` piece of the Paleta's color becomes a `ph` or `pv` (RNG, 50/50). All of them, plus the original Paleta, fire as wave 0. |
| Copa + Bomba | Same as above, with Bombas |
| Copa + Copa | Removes every piece (frosted ones only lose their frost). Every blocker takes 1 damage. Specials are removed without firing. Tokens are untouched. |

### 3.7 Starting board
- Fill the random cells in reading order. Each color is chosen so it does not complete a run of 3 with the two cells to its left or the two above.
- Accept the board if it has 0 matches, at least 1 valid move, and, when the level sets `ensure`, a valid move that creates that special.
- Otherwise regenerate, up to 500 tries. After that, drop the `ensure` requirement.

**Color goals:** a color goal counts every removed piece of that color, both `n` and colored specials.

## 4. Obstacles, villains and goals (P0)

| Code | Name | HP | Rule |
|---|---|---|---|
| `1` `2` `3` | **Bloque de Hielo** | 1–3 | Fixed and holds no piece. At 0 HP the cell becomes an empty slot. Shows a crack stage per HP lost. |
| `K` | **Caja sospechosa** (Cereza's planted "evidencia") | 1 | Same rules as ice. Wooden crate with a cherry stamp. |
| `R` | **Fruta Congelada** | `friendHP` (2–3) | Ice with a character inside, taken from the level's `rescue` list in reading order. At 0 HP: rescue. |
| `C` (2×2) | **Congelador**: Cocardo's blue one or Cereza's pink one, with the owner's face on the door | `boss.hp` | One object over 4 cells, damaged at most once per group or activation. Shows an HP bar and its villain's countdown. At 0 HP it becomes 4 empty slots and its villain stops acting. |
| `e` | **Escarcha** | — | Frost on an `n` piece: the piece cannot be swapped or fall, but still matches. Clearing it only breaks the frost. |
| `t` | **Ficha**: Uva fugitiva (skin `uva`) or Prueba (skin `prueba`) | — | Colorless. Falls and can be swapped (normal validity rules). Ignores blasts and Copas. Collected in the lowest slot of its column. |

**Token spawning:** a level sets `tokens:{skin,total,onBoard}`. While fewer than `onBoard` tokens are on the board and fewer than `total` have spawned, the next fall step puts one token in the top empty slot of a random column (RNG).

**Villains:** a level sets `villains:[{who:'cocardo'|'cereza', act:'frost'|'crate', every, count, src:'hud'|'boss'}]`.
- Each action targets `count` random `n` pieces that are not frosted. Specials and tokens are never targeted.
- `frost` adds Escarcha to the target; `crate` turns it into a `K`.
- A ray flies from the source (the HUD portrait or the Congelador) and the villain laughs.
- The countdown shows as a badge with a snowflake or box icon and the number.

**Goals** (up to 3 per level):

| Goal | Done when |
|---|---|
| `color{c,n}` | n pieces of color c are cleared |
| `ice` | every ice block in the layout is broken |
| `crate{n}` | n crates are broken, whatever their origin |
| `rescue` | every `R` is broken |
| `token` | `total` tokens are collected |
| `boss` | the Congelador is destroyed |

When there are 2 or more color goals, they appear on Piña's ticket, «Pedido de Piña».

## 5. Score, stars and level end (P0)

**Score:**
- Piece cleared: 20×c.
- Special created: +60.
- Blocker damage: +50 per hit.
- Token collected: +500.
- Rescue: +1000.

**Stars:** stars depend only on moves left; no simulator is needed.
- A win gives ★.
- Moves left ≥15% of the limit gives ★★.
- Moves left ≥30% gives ★★★.

**«¡Helado Final!»:** after a win, each remaining move turns a random `n` piece into a Paleta of random orientation, which fires for +300 and resolves fully. Tapping skips the animation: the engine computes the result instantly.

**Lose screen:**
- **Near miss:** if the remaining goal units are at most 20% of the starting units, show «¡Casi! Te faltan 2 [icono]». Goal units are the sum of all goal counters; the boss counts its remaining HP.
- **Otherwise:** show «¡Te quedaste sin movimientos!».

## 6. Characters (exactly the novela's 9, and no others)

Exact looks are still being researched. Each character is one parameterized SVG function in `art.js` (mood, eyes, mouth) so it is easy to revise.

| Character | Look | Role |
|---|---|---|
| **Cocardo** | Brown, hairy coconut; thick eyebrows; black mustache; white soda-jerk paper hat | Villain for L1–20: HUD portrait and the blue Congelador. Jailed after L20. Hint helper by phone in Chapter 6. |
| **Cereza** | Twin cherries; the face has lipstick, half-lidded side glance and a beauty mark | Friendly tip-giver for L1–15. Plants crates from L16. Villain and pink Congelador for L21–30; final boss. |
| **Piña** | Pineapple with crown leaves, sunglasses and a gold chain | The millionaire. His orders become multi-color goals. Story cameos. |
| **Banana** | Yellow crescent with a detective deerstalker hat and a magnifying glass | Detective: hint peeker (Ch1–5), tip-giver from L16, collects Pruebas. Frozen in the L25 cliffhanger, rescued at L30. Also a tile color. |
| **Lima** | Green oval lime with pointed ends | Tile color. Frozen in the Chapter 1 cliffhanger, rescued at L10. Gives the Chorro booster. |
| **Fresa** | Red strawberry with seeds and a green calyx | Tile color. Rescued at L13. Gives the Batido booster. |
| **Durazna** | Peach circle with a crease, blush and a leaf | Tile color. Rescued at L15. |
| **Uva** | Cluster of 6 purple grapes | Tile color. Fugitive token at L21, frozen again, rescued at L30. |
| **Naranja** | Orange-slice wheel with segments | Tile color. Rescued at L19. |

**Tiles:**
- Each tile has the fruit's own silhouette plus a face, so colorblind players can tell them apart.
- Faces blink at random every 2–6 s, look scared next to a Congelador or when frosted, and squint happily when cleared.

**Specials:**
- **Paleta:** the fruit on a popsicle stick, with stripes along the direction it clears.
- **Bomba:** a coconut ball with a fuse and a band in the flavor color.
- **Copa:** a sundae glass with rainbow scoops.

**HUD villain:** Cocardo for L1–20, Cereza for L21–30 (P1). Mood rules:

| Mood | When |
|---|---|
| *llorando* | The player wins |
| *carcajada* | For 1.2 s when the villain acts, and on a loss |
| *furioso* | For 1.5 s after c≥4, any combo, or damage to the Congelador |
| *nervioso* | Goal progress is at least 70% |
| *burlón* | Default |

A taunt bubble appears at level start and again at 5 moves left.

## 7. Levels (P0)

**Board shapes:**

| Shape | Definition |
|---|---|
| R7 | 7×7 |
| R8 | 8×8 |
| OCT | R8 minus a 3-cell triangle in each corner (for example r0c0, r0c1, r1c0) |
| CRUZ | R8 minus the 2×2 block in each corner |
| HUECO | R8 minus r3–4 × c3–4 |
| COPA | R8 minus r6 c0 and c7, and r7 c0–1 and c6–7 |

**Notation:**
- `I2 r3–4 c2–5` means Hielo with HP 2 on rows 3–4, columns 2–5.
- `K` is a crate, `E` is frost, `R(x)` is a Fruta Congelada holding character x, `T(x)` is a token, and `CG` is a Congelador.
- `Coc-frost/5×1` means Cocardo frosts 1 piece every 5 moves (from the HUD). `CG-` means the action comes from the Congelador.
- Each chapter's 5th level is its finale (BOSS). ⚠ marks hard levels.
- `ensure` applies to L2 (paleta), L3 (bomba) and L5 (copa).
- A tutorial overlay with a guiding hand plays the first time on every level with an entry in the "Teaches" column.

| # | Shape | Colors | Moves | Goals | Layout / villains | Teaches |
|---|---|---|---|---|---|---|
| 1 | R7 | LFBU | 20 | L×12 | — | Swapping |
| 2 | R7 | LFBU | 20 | F×15, B×15 | — | Paleta |
| 3 | R7 | LFBUN | 20 | U×18 | — | Bomba |
| 4 | R8 | LFBUN | 22 | Hielo (8) | I1 r3–4 c2–5 | Hielo |
| 5 BOSS | R8 | LFBUN | 22 | N×20, Hielo (10) | I1 r7 c0–7, r6 c0 + c7 | Copa |
| 6 | R8 | LFBUN | 22 | Hielo (14) | I1 r0 c0–7; I2 r3–4 c2–4 | HP 2 |
| 7 | OCT | LFBND | 22 | L×18, F×18, D×18 | — | Pedido de Piña, Cucharón |
| 8 | R8 | LFBUN | 24 | B×25 | E r2 c1–6, r5 c1–6 | Escarcha |
| 9 | HUECO | LFBUN | 24 | U×25, Hielo (8) | I2 r2 c3–4, r5 c3–4, r3–4 c2, r3–4 c5; Coc-frost/5×1 | Villain turn |
| 10 BOSS | R8 | LFBUN | 26 | Boss, Rescue | CG r1–2 c3–4 HP8, CG-frost/4×1; R(lima) r6 c3, friendHP 2 | Congelador, rescue |
| 11 | R8 | LFBUN | 22 | L×25, N×25 | Coc-frost/5×1 | Chorro de Lima |
| 12 | OCT | LFBUND | 25 | Hielo (16) | I3 r3–4 c3–4; I2 perimeter of r2–5 × c2–5 | 6 colors, layers |
| 13 | R8 | LFBUN | 25 | Rescue, Hielo (10) | R(fresa) r7 c3 HP2; I1 r7 c0–2 + c4–7, r6 c2–4; Coc-frost/5×1 | — |
| 14 | CRUZ | LFBND | 24 | D×25, Hielo (8) | I2 r3–4 c0–1 + c6–7; E r1 c2–5; Coc-frost/4×1 | Batido |
| 15 BOSS | R8 | LFBND | 26 | Boss, Rescue | CG r0–1 c3–4 HP10, CG-frost/4×1; R(durazna) r5 c6 HP3; I1 r7 c0–7 (not a goal) | — |
| 16 | R8 | LFBUN | 22 | Cajas (12) | K r3–4 c1–6 | Cajas |
| 17 | HUECO | LFBUND | 25 | Cajas (10), B×25 | K r2 c1–5, r5 c2–6; Cer-crate/5×1 | Cereza as villain |
| 18 | OCT | LFBUN | 24 | Hielo (14), Cajas (8) | I1 r1 c1–6; I2 r6–7 c2–5; K r3–4 c0, c3–4, c7; Cer-crate/5×1 | — |
| 19 ⚠ | R8 | LFBUND | 26 | Rescue, Cajas (8) | R(naranja) r4 c3 HP3; K r3c3, r5c3, r4c2, r4c4, r0 c0–1 + c6–7; Coc-frost/5×1 | — |
| 20 BOSS | R8 | LFBUND | 28 | Boss, Cajas (10) | CG r3–4 c3–4 HP12, CG-frost/4×1; K r0 c1–6, r7 c0–1 + c6–7; Cer-crate/6×1 | Two villains |
| 21 | R8 | LFBUN | 22 | Uva fugitiva (1), N×20 | T(uva) r0 c3; Cer-crate/5×1 | Token |
| 22 | CRUZ | LFBUND | 24 | Pruebas (3), Cajas (8) | T(prueba) r0 c3, onBoard 1, total 3; K r4–5 c0–1 + c6–7; Cer-crate/5×1 | Pruebas |
| 23 ⚠ | R8 | LFBUND | 25 | Hielo (18) | I2 r2 c0–7; I1 r5 c0–7; I3 r7 c3–4; Cer-crate/4×1 | — |
| 24 | HUECO | LFBUND | 25 | Pruebas (4), Cajas (10) | T r0 c1 + c6, onBoard 2, total 4; K r2 c2–5, r5 c2–5, r3c0, r4c7; Cer-crate/4×1 | — |
| 25 BOSS | R8 | LFBUND | 28 | Boss (pink), Pruebas (2) | CG r1–2 c3–4 HP14, CG-frost/3×1; T r0 c0 + c7, onBoard 2, total 2 | — |
| 26 | OCT | LFBUND | 25 | Hielo (16), Pruebas (3) | I2 r2–3 c1–6; I1 r6 c2–5; T r0 c3, onBoard 1, total 3; Cer-crate/4×1 | — |
| 27 ⚠ | R8 | LFBUND | 26 | U×30, Cajas (12) | K r3–4 c1–6; E r6 c0–7; Cer-crate/4×1 | — |
| 28 | CRUZ | LFBUND | 26 | Hielo (16), Pruebas (3) | I3 r3–4 c3–4; I1 r2 c2–5, r5 c2–5, r3–4 c2 + c5; T r0 c2, onBoard 1, total 3; Cer-frost/4×1 | — |
| 29 ⚠ | R8 | LFBUND | 27 | Cajas (14), Hielo (12) | K r0 c0–7, r7 c1–6; I2 r3–4 c1–6; Cer-crate/3×1 | — |
| 30 FINAL | COPA | LFBUND | 30 | Boss (pink), Rescue (2) | CG r0–1 c3–4 HP16, CG-frost/4×2; R(uva) r5 c1, R(banana) r5 c6, both HP3; I1 r3 c0–2 + c5–7 | — |

- **Boosters:** they unlock and give 3 free uses at L7 (Cucharón), L11 (Chorro de Lima) and L14 (Batido de Fresa).
- **Tuning (P1):** `tools/sim.js` runs a greedy bot that plays the hint move on 40 seeds per level. Targets: L1–5 at least 90% wins, normal levels 55–85%, ⚠ and BOSS levels 35–60%. Adjust **moves only**.

## 8. Story script (P0 text, P1 presentation)

Keys: **pre** shows before the first play, **post** after the first win, and **cliff** is the chapter-end card. Tips come from Cereza in L1–15 and from Banana from L16 on.

**Chapter 1 · La heladería en quiebra (L1–5)**
- **pre1:**
  - Cocardo: «¡Estoy en quiebra! Las frutas no se venden… ¡pero los helados sí!»
  - Cocardo: «Necesito un ayudante… ¡Tú!»
  - Lima: «¡Y yo pongo el sabor, socio!»
  - Cereza: «Desliza una fruta y junta 3 iguales, novato.»
- **pre2:** Cereza: «¡4 en línea y sale una Paleta!»
- **pre3:** Cereza: «¿Una L o una T? ¡Bomba de Coco!»
- **pre4:**
  - Cocardo: «¡Cuidado con mi hielo! Es importado… del congelador.»
  - Cereza: «Combina junto al hielo para romperlo.»
- **pre5:** Cereza: «¡5 en línea: Copa Arcoíris! Cámbiala con cualquier fruta.»
- **cliff5:**
  - Lima: «Cocardo, ¿y este congelador tan grande?»
  - *¡CLAC!*
  - Cocardo: «¿Lima? ¿LIMA?… Mmm, huele a sorbete.»

**Chapter 2 · La nieve de Lima (L6–10)**
- **pre6:**
  - Piña: «¡Ese helado de lima es oro! Quiero quinientos litros.»
  - Cocardo: «Fue un accidente… ¡un accidente muy rentable!»
  - Banana: «Soy detective. Aquí desaparecen frutas. Ayúdame en secreto.»
- **pre7:**
  - Piña: «Aquí está mi pedido. ¡Lo quiero para ayer!»
  - Cereza: «Toma este Cucharón: rompe lo que quieras sin gastar movimiento.»
- **pre8:** Cereza: «La escarcha no deja mover la fruta. ¡Combínala para soltarla!»
- **pre9:**
  - Cocardo: «Entran frutas, salen sabores. ¡Jajaja!»
  - Cereza: «Cocardo congela una fruta cada pocos turnos. Mira su cuenta.»
- **pre10:**
  - Banana: «¡El congelador especial! ¡Lima está ahí dentro!»
  - Cereza: «Combina junto al congelador para romperlo.»
- **post10:** Lima: «¡Libre! ¡Ese coco me encerró!»
- **cliff10:**
  - Cocardo: «Tranquilos… si se descongelan, se regeneran. ¿No? ¿NO?»
  - Banana: «¡LAS FRUTAS NO SE REGENERAN!»

**Chapter 3 · El pedido millonario (L11–15)**
- **pre11:**
  - Piña: «Mil helados para mi yate. El dinero no es problema.»
  - Cocardo: «¿Mil? Voy a necesitar… más fruta.»
  - Lima: «¡Te presto mi Chorro de Lima! Limpia una fila entera.»
- **pre13:** Fresa: «¡Suéltame, cabeza de coco!»
- **post13:** Fresa: «¡Gracias! Toma mi Batido: revuelve todo el tablero.»
- **pre14:** Durazna: «¡Se me congelan las pelusitas!»
- **post15:** Durazna: «¡Siento las pelusitas otra vez!»
- **cliff15:**
  - Cereza: «Así que este es tu secreto, Cocardo…»
  - Cereza (to camera): «…ahora es MÍO.»

**Chapter 4 · La traición de Cereza (L16–20)**
- **pre16:**
  - Cereza: «Unas cajitas de "evidencia" por aquí… y por allá.»
  - Banana: «Esas cajas huelen a cereza. Rómpelas como el hielo.»
- **pre17:**
  - Cereza: «Si me estorbas, te encajono, cariño.»
  - Banana: «¡Ahora Cereza convierte frutas en cajas!»
- **pre19:** Naranja: «¡Sáquenme, estoy hecha jugo!»
- **post19:** Naranja: «¡Libre! ¡Y con toda mi pulpa!»
- **pre20:** Cocardo: «¡Mi congelador nunca perderá!»
- **cliff20:**
  - Banana: «¡Cocardo, quedas arrestado!»
  - Cocardo: «¡Esas cajas no son mías! …el congelador sí.»
  - Cereza: «Tranquilo, socio. Yo cuido la heladería… MI heladería.»

**Chapter 5 · La nueva dueña (L21–25)**
- **pre21:**
  - Uva: «¡Me escapé! ¡Cereza, ayúdame!»
  - Banana: «¡Lleva a Uva hasta abajo para que huya!»
- **post21:**
  - Cereza: «Claro, mi amor… entra aquí, que está fresquito.»
  - Uva: «¡NOOO, otra vez no!»
- **pre22:** Banana: «Cereza dejó pruebas por todas partes. ¡Bájalas hasta mí!»
- **pre25:** Cereza: «Mi congelador es rosado… y el doble de frío.»
- **cliff25:**
  - Banana: «¡Tengo las pruebas, Cereza!»
  - *¡CLAC!*
  - Cereza: «Era mi detective favorita.»

**Chapter 6 · El gran deshielo (L26–30)**
- **pre26:**
  - Cocardo (by phone, from jail): «Ayudante… soy yo. El congelador rosado se rompe igual que el mío.»
  - Cocardo: «No lo hago por bueno. ¡Lo hago por venganza!»
- **pre30:**
  - Cereza: «¡Nadie toca mi heladería!»
  - Cocardo (phone): «¡Rescata a Uva y a Banana!»
- **Ending:**
  - Uva: «Libre otra vez. Y esta vez, para siempre.»
  - Banana: «¡Cereza, quedas arrestada!»
  - Cocardo: «¿Y yo?»
  - Todos: «¡TÚ TAMBIÉN!»
  - Piña: «Cancelo mi pedido.»
  - Cocardo (behind bars): «¡Volveré… bien fresquito!»
  - Card: «FIN DE LA TEMPORADA 1» → «¿Segunda temporada…?»

**Random taunts:**
- **Cocardo at level start:** «¡Hoy toca helado de todo!», «¡Nadie descongela a mis… sabores!»
- **Cocardo at 5 moves left:** «¡Se te derrite el tiempo!»
- **Cereza at level start:** «Esta heladería es mía, cariño.», «¿Pruebas? ¿Qué pruebas?»
- **Cereza at 5 moves left:** «Ay, qué fresquito te está quedando todo.»

## 9. Reto Diario (P1)

**Unlock and board:**
- Unlocks after L5.
- D = the local date as an integer, YYYYMMDD.
- The board uses campaign level `6 + (D mod 20)` with its moves minus 2 and seed = D, so everyone gets the same board that day.
- Boosters are off.
- Always free, even when the board comes from a level of the full version.

**Attempts and streak:**
- Only the first finished attempt counts. Replays are marked «Práctica» and are not saved.
- The streak grows when the challenge is finished (won or lost) on consecutive days.
- Playing gives +1 random booster.

**Share text:**
- The engine reports `turnInfo{maxCascade, combo}` for every move.
- Each move becomes one emoji: ⬜ c=1, 🟨 2, 🟧 3–4, 🟥 5+, 🍦 special+special combo. Rows hold 10 emojis.
- The challenge number is `Reto #` = days since 2026-10-01, plus 1.

```
🥥 Cocardo: ¡Rescate Helado! · Reto #14
⭐⭐⭐ 13/20 movs · Combo x6
🟨⬜🟧⬜🟥🟨⬜⬜🟧🟨
⬜🟥🍦
🔥 Racha: 4
```

A loss shows `❌ 20/20 movs`.

**Sharing fallbacks:** try `navigator.share({text})`. If it throws with anything other than AbortError, try `navigator.clipboard.writeText` and show a «¡Copiado!» toast. If that also fails, show a read-only textarea with the text preselected and «Cópialo y compártelo».

**Campaign share (P1):** the Victoria screen has «Compartir» with the same fallbacks, for example «Nivel 10 ⭐⭐⭐ ¡Rescaté a Lima! ¿Puedes tú?». The page URL is added only when the protocol is http(s).

## 10. Boosters (P0, no economy)

Boosters cost no move and do not advance villain counters. After use the board resolves fully, then checks for a win and for the no-moves shuffle.

| Booster | Effect |
|---|---|
| **Cucharón** | Tap a cell: hits it like an activation. Removes a piece, breaks frost, deals 1 damage, or fires a special. Not allowed on tokens; no use is consumed. |
| **Chorro de Lima** | Tap a cell: fires a `ph` activation along that row. |
| **Batido de Fresa** | No target: forces a shuffle (§3.5). |

**Supply:** each booster gives 3 uses when it unlocks. Each first-time ★★★ grants +1 of a random unlocked booster. The cap is 9 per booster.

## 11. Screens and UI flow

1. **Portada (P0):** logo, bobbing Cocardo and «Toca para empezar». This tap unlocks the AudioContext. The fan disclaimer sits in the footer.
2. **Mapa (P0):**
   - A vertical path of 30 nodes across 6 colored zones: Heladería, Mansión de Piña, Trastienda, Comisaría, Heladería de Cereza, Gran Congelador.
   - Each node shows its number, stars and lock. Boss nodes are larger and show the villain's face; ⚠ nodes get a red «¡Drama!» badge.
   - Full-version nodes (`Cocardo.Store.isLocked(id)`) show a golden lock and the label «Versión completa» from the start. Tapping one opens the paywall (§17).
   - Top bar: total stars, Reto Diario (with flame, streak and a dot when available), Álbum and Ajustes.
   - Banner: «Próximo rescate: Lima · faltan 2 niveles», with an icy silhouette (P1).
   - Auto-scrolls to the current level.
3. **Historia (P0):** dialogue overlay.
   - Bouncing portrait, name tag and typewriter text at 30 chars/s.
   - Tapping completes the line; tapping again advances.
   - «Saltar» skips. Each story key is marked as seen.
4. **Intro de nivel (P0):** goal icons, the move count, booster counts and «¡A jugar!».
5. **Juego (P0):**
   - **Phone portrait:** the HUD on top (villain portrait with mood and countdown badges, a large move counter, goal counters or Piña's ticket, pause button), then the square board, then the booster bar.
   - **Board size:** the board is min(viewport width − 32 px, 600 px) on each side.
   - **Wide screens** (≥900 px wide and landscape): HUD on the left, boosters on the right.
6. **Pausa:** Seguir, Reiniciar, Mapa, Sonido.
7. **Victoria:**
   - Stars stamp in, then the score, any rescue, and any booster reward.
   - Buttons: Siguiente (auto-focused), Repetir, Mapa, Compartir.
8. **Derrota:** the near-miss text and Cocardo laughing (*carcajada*). Buttons: Reintentar, Mapa.
9. **Cliffhanger card:**
   - Three quick zooms on a face, a purple background and «CONTINUARÁ...».
   - Plays after the first win of each chapter finale.
   - After cliff10, the paywall (§17) appears once if level 11 is locked.
10. **Reto Diario (P1):**
    - Play button, today's result, Compartir, streak, and a countdown to the next challenge.
11. **Álbum (P1):**
    - 9 cards, each with name, role and the character's first quote.
    - Victims show as icy silhouettes until rescued. Banana's card turns icy from L25 until L30.
12. **Ajustes:**
    - Toggles: Sonido, Vibración, Movimiento reducido (defaults to the `prefers-reduced-motion` setting).
    - «Borrar progreso» needs two taps: the label changes to «¿Seguro? Toca otra vez» for 3 s. It keeps the full version.
    - «Versión completa» button: opens the Store status view (buy, redeem a code, copy my code, «Invítame un helado»).

Never use `alert`, `confirm` or `prompt`.

## 12. Juice (P0 unless noted)

**Movement:**
- Swap: 140 ms ease. Invalid bounce: 2 × 120 ms.
- Fall: 80 ms per cell (minimum 140 ms), ease-in, with a 90 ms squash on landing.
- Spawned pieces drop in from above the board.
- From c≥4 on, all animations run at 0.7× duration.

**Clears and specials:**
- Clear pop: 160 ms, with juice particles in the fruit's color (pooled, at most 250).
- Cleared goal pieces fly to their goal counter, and floating score numbers appear.
- Special creation: a pop, a glow and a sparkle.
- Paleta: a beam. Bomba: a ring.
- Copa: color beams plus a 60 ms freeze-frame.

**Cascade text:**

| c | Text |
|---|---|
| 2 | «¡Rico!» |
| 3 | «¡Delicioso!» |
| 4 | «¡Escandaloso!» |
| 5 | «¡DRAMÁTICO!» |
| 6+ | «¡¡TELENOVELA!!» |

**Obstacles and villains:**
- Ice shows crack stages, then shatters into shards.
- Rescue: the block shatters and the character hops out with hearts and its line in a bubble.
- The Congelador's countdown bubble pulses when it reaches 1, and the villain sends a freeze-ray.

**Feedback:**
- 4 px screen shake on Bombas and combos.
- The move counter pulses red at 5 or fewer moves.
- Confetti and sprinkles on a win.
- `navigator.vibrate`: 10 ms on a match, 30 ms on a Bomba or combo, wrapped in try/catch.

**Reduced motion:** turns off shake, zooms and the freeze-frame, and halves particles.

## 13. Audio (WebAudio synth, unlocked on first tap)

**P0 sound list:**
- **UI:** UI tap.
- **Swaps and matches:**
  - Swap whoosh; invalid "boing".
  - Match pop on a pentatonic scale that steps up per cascade level.
  - Special-created sparkle.
- **Specials and combos:**
  - Paleta: filtered noise sweep.
  - Bomba: low sine plus noise burst.
  - Copa: arpeggio.
  - Combo: a big chord.
- **Obstacles and tokens:**
  - Ice crack: a filtered click, pitched by HP.
  - Frost break: glassy tinkle. Crate: woody knock.
  - Rescue fanfare; token-collect chime.
- **Villains:**
  - Countdown tick at 1.
  - Villain laugh: Cocardo's square-wave «ja-ja-ja»; Cereza's higher «ji-ji-ji».
  - Congelador hit: a thunk.
- **Level end:**
  - Heartbeat at 3 or fewer moves.
  - Win jingle, 3 rising star dings, a descending lose sting.
- **Story:** the «tan-tan-TAAAN» telenovela chord for cliffhangers and boss intros; dialogue blips.

**Settings:** the mute setting is saved.

**P2:** an 8-bar cumbia-pop loop with a «Música» toggle.

## 14. Persistence (P0)

**Save data:** `localStorage['cocardo.v1']`:
```
{v:1, unlocked:1, stars:[30], best:[30],
 boosters:{cucharon,chorro,batido}, rescued:[],
 seen:{}, daily:{last, streak, bestStreak, results:{}},
 settings:{sound, vibra, motion, music},
 license:null | {code, serial, product, at}}
```

**Rules:**
- Every read and write is in try/catch, with an in-memory fallback.
- Corrupt or unknown data resets to defaults.
- Save on level end, booster use and settings changes.
- Keep only the last 7 daily results.

## 15. Tech and tests

**Files:**
```
index.html, css/style.css
js/core/rng.js, engine.js, levels.js, daily.js   (pure)
js/art.js, render.js, fx.js, audio.js, story.js, ui.js, save.js, main.js
tests/*.test.js (node --test), tools/sim.js
```

**Loading:**
- Use classic `<script>` tags, not ES modules, so the game runs from `file://`, GitHub Pages and sandboxed iframes.
- Core files attach to `window.Cocardo` and end with `if (typeof module!=='undefined') module.exports=…`.

**Engine API:**
- `createGame(level, seed)`
- `validMoves(s)`
- `applySwap(s,a,b)` → `{state, steps, turnInfo}`
- `useBooster(s,type,cell)`
- `heladoFinal(s)`

**Events:** `swap, invalid, clear, unfrost, damage, destroy, rescue, activate, combo, create, fall, spawn, collect, villain, shuffle, win, lose`.

**Rendering:**
- One board canvas with devicePixelRatio capped at 2. HUD and screens are DOM.
- `art.js` builds SVG strings. They are used inline for portraits and rasterized into sprite canvases for each cell size: load an `Image` from `data:image/svg+xml` and await it before play.
- Re-rasterize when the cell size changes by more than 10%.
- Run `requestAnimationFrame` only while animating; idle blinks run at a low rate.
- Target 60 fps on mid-range phones.

**Required unit tests:**
- Horizontal, vertical, L, T, cross and 5-line detection.
- Special priority and placement rules (a)–(d).
- Gravity skipping voids, blockers and frost.
- Token collection.
- Every combo.
- Wave chaining.
- Adjacency damage limits, including the 4-cell Congelador.
- Villain target exclusions.
- Goal counting (frost does not count).
- Win checked before villain actions; the lose order.
- Shuffle guarantee.
- Starting board: no matches, at least 1 move, `ensure` respected.
- Determinism: the same seed and moves produce identical steps.
- Helado Final.
- The share-text generator.

## 16. v1 cut-list (do NOT build)

- **Modes:** Pedido Infinito (endless), extra modes, more than 30 levels, level editor.
- **Monetization:** coins, shop, continues or «+5 movimientos», lives or energy, ads, loot boxes, timers or fake
  offers, and paying for anything except the one-time full version of §17.
- **Online:** accounts, leaderboards, analytics.
- **Extra pieces and mechanics:** 2×2 square matches, the Hélice/propeller, a jelly floor layer, diagonal gravity, conveyors, portals, spreading chocolate, timed levels, pre-level boosters.
- **Presentation:** animated cutscenes, voice acting, scoop-face rescue reward. Background music is P2 only.
- **Platform:** PWA/offline install, languages other than Spanish.
- **Characters:** any character outside the 9 listed.

## 17. Full version (P0 once selling is on)

The decision, the reasons and how to switch it on are in `docs/MONETIZACION.md`. The interfaces are in
ARQUITECTURA §14.

**Free and paid content:**
- **Free:** levels 1–10 (Chapters 1–2: the Lima arc), the Reto Diario, the streak, sharing, the Álbum, and replays.
- **Paid:** levels 11–30, plus a golden «Socio de la heladería» frame in the Álbum.
- **Price:** US$1,99, one time. No ads, no other purchases, no advantages in play.

**When the paywall appears:**
- Once, after the first win of level 10: Victoria (with Compartir) → post10 → cliff10 → paywall.
- After that, only when the player taps a locked node or «Siguiente» on level 10.
- Never after a loss.

**What the paywall says:**
- «CONTINUARÁ... en la versión completa», the Don Piña hook and six bullets.
- Buttons «Desbloquear todo · US$1,99», «Ya tengo un código» and «Ahora no». «Ahora no» is as clear as the buy button.
- A footer with: fan game, ask an adult before paying, and the contact for refunds.

**Unlocking:**
- The store sends a signed code or a `#licencia=` link. It works offline and without an account, in any browser.
- The success card says «¡Tenemos un trato, socio!» and offers «Copiar mi código».
- All texts live in `js/store.js`. Preview them in `tools/store-preview.html`.
