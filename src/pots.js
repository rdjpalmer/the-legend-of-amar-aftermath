// Pot throwing physics: arc a pot 2-3 tiles, shatter on landing, scatter shards.

import { TILE, COLS, ROWS, THROW_TILES, SHARDS_PER_POT, Z } from "./config.js";
import { visual } from "./sprites.js";

const DIRS8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const randint = (k, [min, max]) => min + Math.floor(k.rand() * (max - min + 1));
const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

// Throw from `fromPos`, run the arc, shatter, spawn shards. Calls onDone() when
// the pot has landed and shattered.
export function throwPot(k, world, fromPos, onDone) {
  const from = world.toTile(fromPos);
  const [dx, dy] = k.choose(DIRS8);
  const dist = randint(k, THROW_TILES);

  // Walk outward to the requested distance, stopping at the last passable tile.
  let land = { ...from };
  for (let step = 1; step <= dist; step++) {
    const nx = from.x + dx * step;
    const ny = from.y + dy * step;
    if (!inBounds(nx, ny) || !world.walkable(nx, ny)) break;
    land = { x: nx, y: ny };
  }

  const start = fromPos.clone();
  const end = world.tc(land);
  const dur = 0.45;
  const peak = 46; // arc height in px

  // Shadow on the ground + the flying pot above it.
  const shadow = k.add([
    k.circle(9),
    k.pos(end),
    k.anchor("center"),
    k.scale(1, 0.5), // flatten into an oval
    k.color(0, 0, 0),
    k.opacity(0.25),
    k.z(Z.GROUND + 1),
  ]);
  const flying = k.add([...visual(k, "pot"), k.pos(start), k.z(Z.FLYING)]);

  k.tween(0, 1, dur, (t) => {
    const x = k.lerp(start.x, end.x, t);
    const y = k.lerp(start.y, end.y, t);
    const arc = peak * 4 * t * (1 - t); // parabola, 0 at ends
    flying.pos = k.vec2(x, y - arc);
    shadow.opacity = 0.15 + 0.15 * (1 - Math.abs(0.5 - t) * 2);
  }, k.easings.linear).then(() => {
    flying.destroy();
    shadow.destroy();
    shatter(k, world, land, end);
    onDone && onDone();
  });
}

function shatter(k, world, landTile, landPos) {
  k.shake(4);
  burst(k, landPos);

  const count = randint(k, SHARDS_PER_POT);
  // Candidate tiles: landing tile first, then a shuffled set of neighbors.
  const neighbors = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const candidates = [];
  for (const [ox, oy] of neighbors) {
    const x = landTile.x + ox;
    const y = landTile.y + oy;
    if (inBounds(x, y) && world.walkable(x, y)) candidates.push({ x, y });
  }
  // Keep landing tile at the front; shuffle the rest (seeded).
  for (let i = candidates.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(k.rand() * i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let placed = 0;
  for (const t of candidates) {
    if (placed >= count) break;
    spawnShard(k, world, t);
    placed++;
  }
  world.onShardsChanged();
}

// A quick asset-free shatter flash.
function burst(k, pos) {
  const ring = k.add([
    k.circle(6),
    k.pos(pos),
    k.anchor("center"),
    k.color(255, 240, 210),
    k.opacity(0.9),
    k.z(Z.FLYING),
  ]);
  k.tween(6, 22, 0.25, (r) => (ring.radius = r), k.easings.easeOutQuad);
  k.tween(0.9, 0, 0.25, (o) => (ring.opacity = o), k.easings.linear).then(() =>
    ring.destroy()
  );
}

function spawnShard(k, world, tile) {
  const p = world.tc(tile);
  // Small random jitter so multiple shards don't perfectly overlap tile centers.
  const jx = (k.rand() - 0.5) * TILE * 0.4;
  const jy = (k.rand() - 0.5) * TILE * 0.4;
  const s = k.add([
    ...visual(k, "shard"),
    k.pos(p.x + jx, p.y + jy),
    k.area(),
    k.z(p.y),
    k.rotate(k.rand() * 360),
    "shard",
  ]);
  return s;
}
