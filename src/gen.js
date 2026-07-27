// Seeded procedural scene generation.
//
// Produces a solvable single-screen level: a walled arena with exactly one exit
// gap, scattered obstacles, and randomly placed pots / grass / chickens — all
// guaranteed reachable from Link's spawn. Returns plain data; scenes/game.js
// turns it into Kaplay objects.

import {
  COLS,
  ROWS,
  OBSTACLE_COUNT,
  POT_COUNT,
  GRASS_COUNT,
  CHICKEN_COUNT,
} from "./config.js";

const key = (x, y) => `${x},${y}`;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Inclusive integer in [min, max] using Kaplay's seeded RNG.
function randint(k, [min, max]) {
  return min + Math.floor(k.rand() * (max - min + 1));
}

// Flood fill of walkable tiles from a start tile (4-directional).
function reachableFrom(walkable, sx, sy) {
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!walkable[ny][nx] || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// One generation attempt. Returns a level or null if it came out unsolvable.
function attempt(k) {
  const walkable = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
  const occupied = new Set(); // tiles that already hold a wall or entity

  // Border walls.
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        walkable[y][x] = false;
        occupied.add(key(x, y));
      }
    }
  }

  // Carve one exit gap on a random edge.
  const exitEdge = k.choose(["top", "bottom", "left", "right"]);
  let exit;
  if (exitEdge === "top") exit = { x: randint(k, [2, COLS - 3]), y: 0 };
  else if (exitEdge === "bottom")
    exit = { x: randint(k, [2, COLS - 3]), y: ROWS - 1 };
  else if (exitEdge === "left") exit = { x: 0, y: randint(k, [2, ROWS - 3]) };
  else exit = { x: COLS - 1, y: randint(k, [2, ROWS - 3]) };
  walkable[exit.y][exit.x] = true;
  occupied.delete(key(exit.x, exit.y));

  // Spawns: Link near the side opposite the exit, player near center.
  let linkSpawn;
  if (exitEdge === "top") linkSpawn = { x: randint(k, [2, COLS - 3]), y: ROWS - 2 };
  else if (exitEdge === "bottom") linkSpawn = { x: randint(k, [2, COLS - 3]), y: 1 };
  else if (exitEdge === "left") linkSpawn = { x: COLS - 2, y: randint(k, [2, ROWS - 3]) };
  else linkSpawn = { x: 1, y: randint(k, [2, ROWS - 3]) };
  const playerSpawn = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };

  // Reserve spawns + their neighbors so nothing spawns on top of an actor.
  const reserve = (x, y) => {
    occupied.add(key(x, y));
    for (const [dx, dy] of NEIGHBORS) occupied.add(key(x + dx, y + dy));
  };
  reserve(linkSpawn.x, linkSpawn.y);
  reserve(playerSpawn.x, playerSpawn.y);

  // Grabs a random free, walkable interior tile (null if it can't find one).
  const freeTile = () => {
    for (let tries = 0; tries < 400; tries++) {
      const x = randint(k, [1, COLS - 2]);
      const y = randint(k, [1, ROWS - 2]);
      if (walkable[y][x] && !occupied.has(key(x, y))) return { x, y };
    }
    return null;
  };

  // Obstacles (block movement).
  const obstacles = [];
  const obstacleCount = randint(k, OBSTACLE_COUNT);
  for (let i = 0; i < obstacleCount; i++) {
    const t = freeTile();
    if (!t) break;
    walkable[t.y][t.x] = false;
    occupied.add(key(t.x, t.y));
    obstacles.push(t);
  }

  // Reachability: player and exit must be reachable from Link's spawn.
  const reachable = reachableFrom(walkable, linkSpawn.x, linkSpawn.y);
  if (!reachable.has(key(playerSpawn.x, playerSpawn.y))) return null;
  if (!reachable.has(key(exit.x, exit.y))) return null;

  // Place interactables only on reachable free tiles.
  const placeMany = (range) => {
    const out = [];
    const count = randint(k, range);
    for (let i = 0; i < count; i++) {
      const t = freeTile();
      if (!t || !reachable.has(key(t.x, t.y))) continue;
      occupied.add(key(t.x, t.y));
      out.push(t);
    }
    return out;
  };

  const pots = placeMany(POT_COUNT);
  if (pots.length === 0) return null; // no pots -> no game
  const grass = placeMany(GRASS_COUNT);
  const chickens = placeMany(CHICKEN_COUNT);

  return {
    seed: null, // filled in by generate()
    walkable,
    exit,
    exitEdge,
    linkSpawn,
    playerSpawn,
    obstacles,
    pots,
    grass,
    chickens,
  };
}

// Generate a solvable level for `seed`, retrying a few times if an attempt comes
// out blocked. Falls back to whatever the last attempt produced.
export function generate(k, seed) {
  k.randSeed(seed);
  let level = null;
  for (let i = 0; i < 12 && !level; i++) level = attempt(k);
  if (!level) level = attempt(k); // last resort, accept as-is
  level.seed = seed;
  return level;
}
