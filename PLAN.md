# Pot Patrol — Plan

A single-screen, sprite-based, widescreen browser game built with **Kaplay**
(the JS/TS game library, successor to Kaboom.js). Link (AI) rampages across a
procedurally generated scene smashing pots; you (the player) chase him and sweep
up the shards before he leaves the screen.

---

## 1. Concept & core loop

- **Actors:** `Link` (computer-controlled) and `Player` (you).
- **Link's behavior:** wander toward the nearest pot, pick it up, and throw it in
  a random direction. The pot flies 2–3 tiles, shatters, and scatters 1–3 shards
  onto nearby tiles. Along the way Link gets **distracted**:
  - **Grass** — he detours to cut it.
  - **Chickens** — he hits one once, then it chases him, so he **flees briefly**
    before resuming.
- **Player's job:** follow Link and clean up shards by touching them.
- **Win:** zero shards remain at the moment Link leaves the screen (or after his
  last pot, once the board is clear).
- **Lose:** Link leaves the screen with shards still on the ground.
- **Balance:** Link is slightly faster than the player, but loses time to
  distractions — that lost time is the player's window to catch up.

---

## 2. Tech: Kaplay

Kaplay gives us the game loop, rendering, sprites, input, collision, scenes,
timers, tweens, vectors, and seeded RNG out of the box — so most of the old
"engine" work disappears and we focus on game logic.

- **Load:** ES-module import from a CDN, keeping a no-build setup:
  ```html
  <script type="module">
    import kaplay from "https://unpkg.com/kaplay@3000/dist/kaplay.mjs";
    // ... or import ./src/main.js which imports kaplay
  </script>
  ```
  Serve over HTTP for module loading: `python3 -m http.server` → `http://localhost:8000`.
  *(Alternative, better DX: `npm create kaplay@latest` scaffolds a Vite project.
  We can switch to that if we want bundling/TS; the plan below is engine-API
  identical either way.)*
- **Init:** `kaplay({ width: 960, height: 560, background: [...], letterbox: true, global: false })`.
  `letterbox` keeps the widescreen aspect ratio and scales to the window.
- **Seeded RNG:** `randSeed(seed)` + `rand()`, `randi()`, `choose()` — reproducible
  scenes for debugging and "retry same level" (no custom PRNG needed).
- **Delta time:** `dt()` for frame-independent movement.
- **Depth:** set `obj.z = obj.pos.y` each frame for top-down y-sorting.

Kaplay features we lean on hardest:

- **`state()` component** — a built-in finite state machine, ideal for Link's AI
  (`onStateEnter/Update/End`).
- **`addLevel()`** — turns an ASCII tile map into game objects, matching our
  procedural grid.
- **`area()` + `onCollide` / `body({ isStatic })`** — collision & obstacle
  blocking (top-down, gravity 0).
- **`scene()` / `go()`** — game / win / lose screens.
- **`tween()`** — pot throw arc, sweep juice.

---

## 3. Coordinate system

- Tile-based grid, continuous pixel positions (Kaplay `vec2`).
- Config constants (tunable in `config.js`):
  - `TILE = 40` px
  - `COLS = 24`, `ROWS = 14` → `960 × 560` canvas (≈16:9 widescreen).
- AI reasoning in tile coordinates; movement continuous. `addLevel` uses
  `tileWidth/tileHeight = TILE`.

---

## 4. File structure

```
index.html            # imports src/main.js as a module
styles.css            # page bg, canvas centering
src/
  config.js           # tunable constants (sizes, speeds, counts, radii)
  main.js             # kaplay() init, load assets, register scenes, go("game")
  gen.js              # seeded procedural tile map + entity placement
  sprites.js          # loadSprite / placeholder object factories
  scenes/
    game.js           # main scene: build level, spawn actors, wire collisions
    end.js            # win & lose scenes (result + retry / new-seed)
  actors/
    player.js         # player object + input-driven movement
    link.js           # link object + state() FSM (the AI)
    chicken.js        # chicken idle + chase behavior
  pots.js             # pickup, throw arc, shatter, shard spawning
  hud.js              # shard counter, pots-remaining, dev state readout
```

Kaplay's built-in RNG/loop/render/input mean no `rng.js`, `render.js`, or
`input.js` — that logic is inline via Kaplay APIs.

---

## 5. Procedural scene generation (`gen.js`)

Seeded via `randSeed(seed)`. Produce a level the game scene consumes:

1. **Grid & ground:** fill a `COLS × ROWS` map with floor tiles (optionally 2
   variants for noise).
2. **Obstacles:** scatter impassable decor (rocks/trees), light count (6–12),
   keeping the interior open. Border walkable except one **exit gap** (§9).
3. **Pots:** place `POT_COUNT` (5–8) on random passable, unoccupied tiles.
4. **Grass:** place `GRASS_COUNT` (8–15).
5. **Chickens:** place `CHICKEN_COUNT` (2–4).
6. **Spawns:** Link at one edge; player opposite/center. Keep spawn tiles + their
   neighbors clear.
7. **Validation:** flood-fill from Link's spawn; reroll any unreachable pot (or
   regenerate) so the level is always solvable.

Two build options (either works — leaning toward **B** for dynamic control):
- **A.** Emit an ASCII map and hand it to `addLevel()` with a `tiles` map of
  component factories per symbol.
- **B.** Emit a data structure (tile types + entity list) and `add()` each object
  directly — more flexible for entities that move, spawn, and despawn at runtime.

---

## 6. Entity model — Kaplay components

Every actor is a Kaplay game object: `add([...components, "tag"])`.

- **Player:** `[sprite/placeholder, pos, area(), body(), anchor("center"), "player"]`,
  moved from input; `PLAYER_SPEED`.
- **Link:** `[..., area(), body(), state("seek", [...]), "link"]`; `LINK_SPEED`
  (≈1.15× player). AI in the `state()` FSM (§8).
- **Pot:** `[..., area(), "pot"]`; static until targeted, then handled by `pots.js`.
- **Shard:** `[..., area(), "shard"]`; removed on player overlap.
- **Grass:** `[..., area(), "grass"]`; destroyed/stubbed when cut.
- **Chicken:** `[..., area(), body(), state("idle",[...]), "chicken"]` (§chickens).
- **Obstacles:** `[..., area(), body({ isStatic: true }), "obstacle"]` — block movers.

Movement helper: `obj.move(dir.scale(speed))` toward a target `vec2`; `body`
resolves collisions against static obstacles. Update `z = pos.y` for depth.

---

## 7. Pots, throwing & shards (`pots.js`)

- **Target:** Link's FSM picks the nearest `"pot"` still on the board
  (`get("pot")` + min distance).
- **Pickup:** within `INTERACT_DIST`, pot attaches to Link (brief wind-up).
- **Throw:** pick a random 8-way direction and **2–3 tiles** distance. Animate
  with `tween()`: linear travel along the path **plus** a parabolic height offset
  (tween a `z-height` up then down, drawn as vertical sprite offset + a shadow) so
  it visibly arcs.
- **Shatter on land:** spawn **1–3 shards** on the landing tile + random adjacent
  passable tiles (dedupe to one per tile). `addKaboom()` / small particle pop +
  `shake()` for juice.
- If the target tile is impassable, land on the nearest passable tile.

---

## 8. Link AI (`link.js`) — `state()` FSM

States, checked by priority each `onStateUpdate`:

1. **`flee`** — active for `FLEE_TIME` after hitting a chicken; run away from the
   nearest chasing chicken, then return to `seek`.
2. **`distracted`** — if grass/chicken within `DISTRACT_RADIUS`, with per-tick
   probability divert:
   - grass → move adjacent → **cut** (destroy grass), brief pause → `seek`.
   - chicken → move adjacent → **hit** once → triggers chicken chase + Link `flee`.
3. **`seek`** — move to nearest pot → transition to `throw`.
4. **`throw`** — run the throw sequence (§7) → back to `seek`.
5. **`leave`** — no pots remain (or a max-time fuse fires): walk to the exit gap
   and off-screen → end the round (§9). Detected with `offscreen()`.

"More distractions" = generous `DISTRACT_RADIUS` + divert probability + flee
detours, so Link squanders his speed edge. `enterState()` transitions log to
console in dev; HUD shows current state.

---

## 9. Win / lose (`scenes/`)

- `game` scene tracks `shardCount` (count of `"shard"` objects) live in the HUD.
- **Link leaves:** his `leave` state + `offscreen()` ends the round; evaluate:
  - `shardCount === 0` → `go("win")`.
  - `shardCount > 0` → `go("lose", { left: shardCount })`.
- **Early win:** last pot thrown **and** `shardCount` hits 0 before he exits → win
  immediately.
- End scenes show result + **Retry (same seed)** and **New scene (new seed)**
  (`go("game", { seed })`), driven by key press.

---

## 10. Player input & shard cleanup

- Kaplay input: `onKeyDown("left"/"a"/…)` or `isKeyDown()` to build a direction
  `vec2`; normalize so diagonals aren't faster; `player.move(dir.scale(PLAYER_SPEED))`.
- Cleanup: `player.onCollide("shard", (s) => { destroy(s); shardCount--; })`,
  with an optional sweep tween.
- Obstacle blocking handled by `body()` vs static obstacle bodies.

---

## 11. Rendering & HUD

Kaplay renders automatically; we control **order via `z`** (set each frame to
`pos.y` for actors/chickens; fixed low `z` for ground/decor, high `z` for the
flying pot + HUD). Sprites via `loadSprite`; **placeholders** first so it's
playable immediately:

- Placeholder glyphs with `text()` — Link 🧝, player 🧹, pot 🏺, shard 🔶,
  grass 🌿, chicken 🐔, rock 🪨 — or colored `rect()`/`circle()` components.
- HUD (`hud.js`): shard counter, pots remaining, Link state (dev), win/lose
  banner — `add([text(), fixed(), z(top)])`.
- `image-rendering: pixelated` on the canvas for crisp sprites.

---

## 12. Milestones (build order)

1. **Skeleton:** `index.html` + `main.js` with `kaplay()` init, empty `game`
   scene, letterboxed canvas. Runs via local server.
2. **Procgen:** `gen.js` builds a seeded level; `game` scene renders ground,
   obstacles, pots, grass, chickens, spawns; reachability validated.
3. **Player:** input-driven movement + obstacle collision via `body()`.
4. **Link seek+move:** `state()` FSM with `seek` targeting nearest pot (no throw).
5. **Throw + shards:** pickup → `tween` arc → shatter → 1–3 shards.
6. **Cleanup + HUD:** `onCollide` shard pickup; live counter.
7. **Distractions:** grass cut; chicken hit → chase → Link `flee`.
8. **End states:** `leave` + `offscreen` → win/lose scenes + retry/new-seed.
9. **Polish:** real sprite atlas, `addKaboom`/particles, sfx (`loadSound`/`play`),
   `shake()`, tuning pass on speeds / radii / counts.

Each milestone is independently runnable for playtesting.

---

## 13. Tunable constants (initial guesses, `config.js`)

| Constant           | Value        | Meaning                                   |
|--------------------|--------------|-------------------------------------------|
| `TILE`             | 40 px        | tile size                                 |
| `COLS × ROWS`      | 24 × 14      | grid → 960×560 canvas                      |
| `PLAYER_SPEED`     | 130 px/s     | player movement                           |
| `LINK_SPEED`       | ~150 px/s    | ≈1.15× player                             |
| `POT_COUNT`        | 5–8          | pots per scene                            |
| `GRASS_COUNT`      | 8–15         | grass tufts                               |
| `CHICKEN_COUNT`    | 2–4          | chickens                                  |
| `THROW_TILES`      | 2–3          | pot flight distance                       |
| `SHARDS_PER_POT`   | 1–3          | shards on shatter                         |
| `DISTRACT_RADIUS`  | ~4 tiles     | how far grass/chickens tempt Link         |
| `FLEE_TIME`        | ~1.5 s       | how long Link flees after hitting chicken |

First-pass numbers; §12 step 9 tunes them against playtests.

---

## 14. Assumptions & open questions

- **"Your PC"** = the player-controlled character (Link is the AI). Assumed.
- **Kaplay delivery:** CDN ES-module import for a no-build start; can switch to
  `npm create kaplay` + Vite for bundling/TypeScript if we want it.
- **Sprites:** no Zelda art bundled; starting with emoji/`text()` and shape
  placeholders, swappable for a real atlas via `loadSprite` later.
- **Link leaves when** out of pots (max-time fuse as backstop); a fixed round
  timer is a one-line alternative in `config.js`.
- **Chicken chase:** only the hit chicken chases (simplest); could expand later.
- Audio is polish (step 9), not core.
