// Link: computer-controlled. Milestones 4-5-8 slice:
//   seek  -> path to the nearest pot
//   throw -> pick it up and hurl it (pots.js handles the arc + shatter)
//   leave -> no pots left: path to the exit gap and off-screen (ends the round)
// Movement follows a BFS tile path (pathfind.js) so Link routes around terrain
// instead of getting caught on it. Distractions arrive in a later milestone.

import { TILE, LINK_SPEED } from "../config.js";
import { visual } from "../sprites.js";
import { throwPot } from "../pots.js";
import { findPath } from "../pathfind.js";

const INTERACT_DIST = TILE * 0.8;
const WAYPOINT_DIST = TILE * 0.3; // how close before advancing to the next tile
const REPATH_INTERVAL = 0.6; // seconds; recompute to self-heal if bumped

export function addLink(k, world, onLeave) {
  const p = world.tc(world.level.linkSpawn);
  const link = k.add([
    ...visual(k, "link"),
    k.pos(p),
    k.area(),
    k.body(),
    k.state("seek", ["seek", "throw", "leave"]),
    "link",
  ]);

  link.path = null;
  link.pathGoal = null;
  link.repath = 0;

  // Path to `goalTile` and take one step along it. Recomputes when the goal
  // changes, the path is spent, or the refresh timer elapses.
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

    // Advance past any waypoint we've effectively reached.
    while (link.path.length && link.pos.dist(world.tc(link.path[0])) <= WAYPOINT_DIST) {
      link.path.shift();
    }

    const targetPos = link.path.length ? world.tc(link.path[0]) : world.tc(goalTile);
    const d = targetPos.sub(link.pos);
    if (d.len() > 1) link.move(d.unit().scale(LINK_SPEED));
  };

  const nearestPot = () => {
    let best = null;
    let bestD = Infinity;
    for (const pot of k.get("pot")) {
      const d = pot.pos.dist(link.pos);
      if (d < bestD) {
        bestD = d;
        best = pot;
      }
    }
    return best;
  };

  const clearPath = () => {
    link.path = null;
    link.pathGoal = null;
    link.repath = 0;
  };

  // --- SEEK ---
  link.onStateUpdate("seek", () => {
    const pot = nearestPot();
    if (!pot) {
      link.enterState("leave");
      return;
    }
    if (pot.pos.dist(link.pos) <= INTERACT_DIST) {
      link.target = pot;
      link.enterState("throw");
      return;
    }
    navTo(world.toTile(pot.pos));
  });

  // --- THROW ---
  link.onStateEnter("throw", () => {
    clearPath();
    const pot = link.target;
    if (!pot || pot.destroyed) {
      link.enterState("seek");
      return;
    }
    const at = pot.pos.clone();
    pot.destroy(); // picked up
    throwPot(k, world, at, () => link.enterState("seek"));
  });
  // Stand still while the throw animation plays.

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
