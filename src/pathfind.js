// Breadth-first shortest path over walkable tiles (4-directional).
//
// Link steers directly toward his target, which means solid terrain between him
// and a pot would trap him. Routing along a tile path of only walkable tiles
// keeps him off obstacles/walls, and because steps are orthogonal he never cuts
// a corner into a solid tile.

const key = (x, y) => `${x},${y}`;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// Returns the list of tiles AFTER `from` up to and including `goal`, or [] if
// the goal is unreachable / equals the start (callers fall back to direct steer).
export function findPath(world, from, goal) {
  if (from.x === goal.x && from.y === goal.y) return [];
  if (!world.walkable(goal.x, goal.y)) return [];

  const prev = new Map();
  const seen = new Set([key(from.x, from.y)]);
  const queue = [from];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let c = cur;
      while (!(c.x === from.x && c.y === from.y)) {
        path.push(c);
        c = prev.get(key(c.x, c.y));
      }
      return path.reverse();
    }
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!world.walkable(nx, ny)) continue;
      const kk = key(nx, ny);
      if (seen.has(kk)) continue;
      seen.add(kk);
      prev.set(kk, { ...cur });
      queue.push({ x: nx, y: ny });
    }
  }
  return [];
}
