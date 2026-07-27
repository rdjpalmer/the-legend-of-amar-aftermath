// Link: computer-controlled. Milestones 4-5-8 slice:
//   seek  -> walk to the nearest pot
//   throw -> pick it up and hurl it (pots.js handles the arc + shatter)
//   leave -> no pots left: walk to the exit gap and off-screen (ends the round)
// Distractions (grass/chickens) arrive in a later milestone.

import { TILE, LINK_SPEED } from "../config.js";
import { visual } from "../sprites.js";
import { throwPot } from "../pots.js";

const INTERACT_DIST = TILE * 0.8;

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

  // Move toward a world position; returns distance remaining.
  const stepToward = (target) => {
    const d = target.sub(link.pos);
    const dist = d.len();
    if (dist > 1) link.move(d.unit().scale(LINK_SPEED));
    return dist;
  };

  const nearestPot = () => {
    const pots = k.get("pot");
    let best = null;
    let bestD = Infinity;
    for (const pot of pots) {
      const d = pot.pos.dist(link.pos);
      if (d < bestD) {
        bestD = d;
        best = pot;
      }
    }
    return best;
  };

  // --- SEEK ---
  link.onStateUpdate("seek", () => {
    const pot = nearestPot();
    if (!pot) {
      link.enterState("leave");
      return;
    }
    if (stepToward(pot.pos) <= INTERACT_DIST) {
      link.target = pot;
      link.enterState("throw");
    }
  });

  // --- THROW ---
  link.onStateEnter("throw", () => {
    const pot = link.target;
    if (!pot || pot.destroyed) {
      link.enterState("seek");
      return;
    }
    const at = pot.pos.clone();
    pot.destroy(); // picked up
    link.throwing = true;
    throwPot(k, world, at, () => {
      link.throwing = false;
      link.enterState("seek");
    });
  });
  // Stand still while the throw animation plays.

  // --- LEAVE ---
  link.onStateEnter("leave", () => {
    link.leaving = true;
  });
  link.onStateUpdate("leave", () => {
    const exitPos = world.tc(world.level.exit);
    stepToward(exitPos);
    // Once he reaches / passes the exit gap, he's gone.
    if (link.pos.dist(exitPos) < TILE * 0.5) {
      if (!link.gone) {
        link.gone = true;
        onLeave && onLeave();
      }
    }
  });

  link.onUpdate(() => {
    link.z = link.pos.y;
  });

  return link;
}
