// The main scene: build the procedural level, spawn actors, run the core loop.

import { TILE, COLS, ROWS, Z } from "../config.js";
import { generate } from "../gen.js";
import { visual } from "../sprites.js";
import { addPlayer } from "../actors/player.js";
import { addLink } from "../actors/link.js";

export function registerGameScene(k) {
  k.scene("game", (opts = {}) => {
    const urlSeed = Number(new URLSearchParams(location.search).get("seed"));
    const seed =
      opts.seed ?? (Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : Math.floor(Math.random() * 1e9));
    const level = generate(k, seed);
    let roundOver = false;

    // Pixel center of a tile.
    const tc = (t) => k.vec2((t.x + 0.5) * TILE, (t.y + 0.5) * TILE);

    // Shared context handed to actors / pot physics.
    const world = {
      level,
      tc,
      toTile: (p) => ({ x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) }),
      walkable: (x, y) =>
        x >= 0 && y >= 0 && x < COLS && y < ROWS && level.walkable[y][x],
      onShardsChanged: () => updateHud(),
    };

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

    // --- Border walls (solid), exit gap left open ---
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
            k.area(),
            k.body({ isStatic: true }),
            k.z(Z.GROUND + 2),
            "wall",
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

    // Add a y-sorted world entity anchored at its tile center.
    const spawn = (kind, tile, extra = [], ...tags) => {
      const p = tc(tile);
      return k.add([...visual(k, kind), k.pos(p), k.z(p.y), ...extra, ...tags]);
    };

    // --- Static world ---
    level.obstacles.forEach((t) =>
      spawn("obstacle", t, [k.area(), k.body({ isStatic: true })], "obstacle")
    );
    level.grass.forEach((t) => spawn("grass", t, [k.area()], "grass"));
    level.pots.forEach((t) => spawn("pot", t, [k.area()], "pot"));
    level.chickens.forEach((t) => spawn("chicken", t, [k.area()], "chicken"));

    // --- Actors ---
    addPlayer(k, world);
    addLink(k, world, () => endRound());

    // --- HUD ---
    const hud = k.add([
      k.text("", { size: 16 }),
      k.pos(10, 8),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(Z.HUD),
    ]);
    function updateHud() {
      const shards = k.get("shard").length;
      const pots = k.get("pot").length;
      hud.text = `Shards: ${shards}    Pots left: ${pots}    seed:${seed}`;
      // Early win: Link has no pots left and the board is clear.
      if (!roundOver && pots === 0 && shards === 0) endRound();
    }
    updateHud();

    k.add([
      k.text("WASD / arrows to move · sweep shards · R: new scene", { size: 13 }),
      k.pos(10, ROWS * TILE - 22),
      k.color(235, 235, 235),
      k.opacity(0.8),
      k.fixed(),
      k.z(Z.HUD),
    ]);

    // End-of-round evaluation.
    function endRound() {
      if (roundOver) return;
      roundOver = true;
      const left = k.get("shard").length;
      if (left === 0) k.go("win", { seed });
      else k.go("lose", { seed, left });
    }

    k.onKeyPress("r", () => k.go("game"));
  });
}
