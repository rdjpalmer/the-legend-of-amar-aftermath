// The main scene. Milestones 1-2: build a seeded procedural level and render it.
// Actors are placed but static for now (movement/AI arrive in later milestones).

import { TILE, COLS, ROWS, Z } from "../config.js";
import { generate } from "../gen.js";
import { visual } from "../sprites.js";

export function registerGameScene(k) {
  k.scene("game", (opts = {}) => {
    const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const level = generate(k, seed);

    // Pixel center of a tile.
    const tc = (t) => k.vec2((t.x + 0.5) * TILE, (t.y + 0.5) * TILE);

    // --- Ground (checkerboard of two greens) ---
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const alt = (x + y) % 2 === 0;
        k.add([
          k.rect(TILE, TILE),
          k.pos(x * TILE, y * TILE),
          k.color(alt ? 104 : 96, alt ? 166 : 156, alt ? 96 : 88),
          k.z(Z.GROUND),
        ]);
      }
    }

    // Border walls (every non-walkable border tile except the exit gap).
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const isBorder = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
        const isExit = x === level.exit.x && y === level.exit.y;
        if (isBorder && !isExit) {
          k.add([
            k.rect(TILE, TILE),
            k.pos(x * TILE, y * TILE),
            k.color(72, 66, 60),
            k.outline(1, k.rgb(52, 48, 42)),
            k.z(Z.GROUND + 2),
          ]);
        }
      }
    }

    // Exit tile marker (walkable gap in the wall).
    k.add([
      k.rect(TILE, TILE),
      k.pos(level.exit.x * TILE, level.exit.y * TILE),
      k.color(210, 196, 120),
      k.opacity(0.6),
      k.z(Z.GROUND + 1),
    ]);

    // Helper: add a world entity anchored at its tile center, y-sorted.
    const spawn = (kind, tile, ...tags) => {
      const p = tc(tile);
      return k.add([...visual(k, kind), k.pos(p), k.z(p.y), ...tags]);
    };

    // --- Static world ---
    level.obstacles.forEach((t) => spawn("obstacle", t, "obstacle"));
    level.grass.forEach((t) => spawn("grass", t, "grass"));
    level.pots.forEach((t) => spawn("pot", t, "pot"));
    level.chickens.forEach((t) => spawn("chicken", t, "chicken"));

    // --- Actors (static this milestone) ---
    spawn("link", level.linkSpawn, "link");
    spawn("player", level.playerSpawn, "player");

    // --- Dev HUD ---
    k.add([
      k.text(
        `Pot Patrol  seed:${seed}\n` +
          `pots:${level.pots.length}  grass:${level.grass.length}  ` +
          `chickens:${level.chickens.length}  obstacles:${level.obstacles.length}  ` +
          `exit:${level.exitEdge}`,
        { size: 16 }
      ),
      k.pos(10, 8),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(Z.HUD),
    ]);
    k.add([
      k.text("R: new scene", { size: 14 }),
      k.pos(10, CANVAS_HUD_BOTTOM()),
      k.color(230, 230, 230),
      k.opacity(0.8),
      k.fixed(),
      k.z(Z.HUD),
    ]);

    // Regenerate with a fresh seed.
    k.onKeyPress("r", () => k.go("game"));
  });
}

// Small helper kept out of the layout math above.
function CANVAS_HUD_BOTTOM() {
  return ROWS * TILE - 24;
}
