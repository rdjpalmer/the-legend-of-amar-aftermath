// Link: computer-controlled.
//
// States (priority is expressed by which one he's in and what interrupts what):
//   seek      -> path to the nearest pot; may get tempted into a distraction
//   throw     -> pick the pot up and hurl it (pots.js handles arc + shatter)
//   cutGrass  -> detour to nearby grass and cut it
//   hitChicken-> detour to a nearby chicken and smack it (provokes a chase)
//   flee      -> run from the chasing chicken for a beat
//   leave     -> no pots left: path to the exit gap and off-screen (ends round)
//
// Movement follows a BFS tile path (pathfind.js) so Link routes around terrain
// instead of snagging on it. Actor-vs-actor collision is ignored (see area()).

import {
  TILE,
  LINK_SPEED,
  DISTRACT_RADIUS,
  DISTRACT_INTERVAL,
  DISTRACT_CHANCE,
  GRASS_CUT_PAUSE,
  FLEE_TIME,
  Z,
} from "../config.js";
import { visual } from "../sprites.js";
import { throwPot } from "../pots.js";
import { findPath } from "../pathfind.js";

const INTERACT_DIST = TILE * 0.8;
const WAYPOINT_DIST = TILE * 0.3;
const REPATH_INTERVAL = 0.6;

const alive = (o) => o && o.exists && o.exists();

export function addLink(k, world, onLeave) {
  const p = world.tc(world.level.linkSpawn);
  const link = k.add([
    ...visual(k, "link"),
    k.pos(p),
    k.area({ collisionIgnore: ["player", "chicken"] }),
    k.body(),
    k.state("seek", ["seek", "throw", "cutGrass", "hitChicken", "flee", "leave"]),
    "link",
  ]);

  link.path = null;
  link.pathGoal = null;
  link.repath = 0;
  link.distractCd = DISTRACT_INTERVAL;

  // --- Navigation: path to a tile and take one step along it ---
  const navTo = (goalTile) => {
    link.repath -= k.dt();
    const from = world.toTile(link.pos);
    const sameGoal =
      link.pathGoal && link.pathGoal.x === goalTile.x && link.pathGoal.y === goalTile.y;
    if (!sameGoal || !link.path || link.path.length === 0 || link.repath <= 0) {
      link.path = findPath(world, from, goalTile);
      link.pathGoal = { ...goalTile };
      link.repath = REPATH_INTERVAL;
    }
    while (link.path.length && link.pos.dist(world.tc(link.path[0])) <= WAYPOINT_DIST) {
      link.path.shift();
    }
    const targetPos = link.path.length ? world.tc(link.path[0]) : world.tc(goalTile);
    const d = targetPos.sub(link.pos);
    if (d.len() > 1) link.move(d.unit().scale(LINK_SPEED));
  };

  const clearPath = () => {
    link.path = null;
    link.pathGoal = null;
    link.repath = 0;
  };

  const nearest = (tag, filter) => {
    let best = null;
    let bestD = Infinity;
    for (const o of k.get(tag)) {
      if (filter && !filter(o)) continue;
      const d = o.pos.dist(link.pos);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best ? { obj: best, dist: bestD } : null;
  };

  // Should Link get distracted right now? Rolls on a cooldown so he doesn't
  // divert every single frame. Returns "cutGrass" | "hitChicken" | null.
  const rollDistraction = () => {
    link.distractCd -= k.dt();
    if (link.distractCd > 0) return null;
    link.distractCd = DISTRACT_INTERVAL;

    const radius = DISTRACT_RADIUS * TILE;
    const grass = nearest("grass");
    const chicken = nearest("chicken", (c) => (c.hitCooldown ?? 0) <= 0);

    const candidates = [];
    if (grass && grass.dist <= radius) candidates.push({ kind: "cutGrass", ...grass });
    if (chicken && chicken.dist <= radius) candidates.push({ kind: "hitChicken", ...chicken });
    if (!candidates.length) return null;
    if (k.rand() >= DISTRACT_CHANCE) return null;

    candidates.sort((a, b) => a.dist - b.dist);
    link.distractTarget = candidates[0].obj;
    return candidates[0].kind;
  };

  // --- SEEK ---
  link.onStateUpdate("seek", () => {
    const divert = rollDistraction();
    if (divert) {
      link.enterState(divert);
      return;
    }
    const pot = nearest("pot");
    if (!pot) {
      link.enterState("leave");
      return;
    }
    if (pot.dist <= INTERACT_DIST) {
      link.target = pot.obj;
      link.enterState("throw");
      return;
    }
    navTo(world.toTile(pot.obj.pos));
  });

  // --- THROW ---
  link.onStateEnter("throw", () => {
    clearPath();
    const pot = link.target;
    if (!alive(pot)) {
      link.enterState("seek");
      return;
    }
    const at = pot.pos.clone();
    pot.destroy();
    throwPot(k, world, at, () => link.enterState("seek"));
  });

  // --- CUT GRASS ---
  link.onStateEnter("cutGrass", () => {
    clearPath();
    link.cutPause = -1;
  });
  link.onStateUpdate("cutGrass", () => {
    if (link.cutPause >= 0) {
      link.cutPause -= k.dt();
      if (link.cutPause <= 0) link.enterState("seek");
      return;
    }
    const g = link.distractTarget;
    if (!alive(g)) {
      link.enterState("seek");
      return;
    }
    if (g.pos.dist(link.pos) <= INTERACT_DIST) {
      slashEffect(k, g.pos);
      g.destroy();
      link.cutPause = GRASS_CUT_PAUSE;
    } else {
      navTo(world.toTile(g.pos));
    }
  });

  // --- HIT CHICKEN ---
  link.onStateEnter("hitChicken", () => clearPath());
  link.onStateUpdate("hitChicken", () => {
    const c = link.distractTarget;
    if (!alive(c)) {
      link.enterState("seek");
      return;
    }
    if (c.pos.dist(link.pos) <= INTERACT_DIST) {
      slashEffect(k, c.pos);
      if (c.provoke) c.provoke(link);
      link.enterState("flee");
    } else {
      navTo(world.toTile(c.pos));
    }
  });

  // --- FLEE ---
  const fleeTileFrom = (threatPos) => {
    const away = link.pos.sub(threatPos);
    const dir = away.len() > 0 ? away.unit() : k.vec2(1, 0);
    const from = world.toTile(link.pos);
    for (let d = 3; d >= 1; d--) {
      const tx = Math.round(from.x + dir.x * d);
      const ty = Math.round(from.y + dir.y * d);
      if (world.walkable(tx, ty)) return { x: tx, y: ty };
    }
    return from;
  };

  link.onStateEnter("flee", () => {
    clearPath();
    link.fleeTimer = FLEE_TIME;
    link.fleeRecalc = 0;
  });
  link.onStateUpdate("flee", () => {
    link.fleeTimer -= k.dt();
    if (link.fleeTimer <= 0) {
      link.enterState("seek");
      return;
    }
    const threat =
      nearest("chicken", (c) => c.state === "chase") || nearest("chicken");
    link.fleeRecalc -= k.dt();
    if (link.fleeRecalc <= 0 || !link.fleeTarget) {
      link.fleeRecalc = 0.35;
      link.fleeTarget = fleeTileFrom(threat ? threat.obj.pos : link.pos);
    }
    navTo(link.fleeTarget);
  });

  // --- LEAVE ---
  link.onStateEnter("leave", () => {
    clearPath();
    link.leaving = true;
  });
  link.onStateUpdate("leave", () => {
    const exitPos = world.tc(world.level.exit);
    if (link.pos.dist(exitPos) < TILE * 0.5) {
      if (!link.gone) {
        link.gone = true;
        onLeave && onLeave();
      }
      return;
    }
    navTo(world.level.exit);
  });

  link.onUpdate(() => {
    link.z = link.pos.y;
  });

  return link;
}

// A brief white slash arc where Link cuts grass / smacks a chicken.
function slashEffect(k, pos) {
  const fx = k.add([
    k.circle(4),
    k.pos(pos),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.z(Z.FLYING),
  ]);
  k.tween(4, 18, 0.2, (r) => (fx.radius = r), k.easings.easeOutQuad);
  k.tween(0.9, 0, 0.2, (o) => (fx.opacity = o), k.easings.linear).then(() => fx.destroy());
}
