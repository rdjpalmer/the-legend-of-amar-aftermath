// Chickens: amble around idly; when Link hits one, it chases him for a beat,
// then loses interest. Chickens ignore actor-vs-actor physics (only terrain
// blocks them) so they never wedge Link or the player against a wall.

import { CHICKEN_SPEED, CHICKEN_CHASE_TIME, CHICKEN_HIT_COOLDOWN } from "../config.js";
import { visual } from "../sprites.js";

const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function addChicken(k, world, tile) {
  const p = world.tc(tile);
  const chicken = k.add([
    ...visual(k, "chicken"),
    k.pos(p),
    k.area({ collisionIgnore: ["player", "link", "chicken"], scale: 0.7 }),
    k.body(),
    k.state("idle", ["idle", "chase"]),
    "chicken",
  ]);

  chicken.hitCooldown = 0;
  chicken.wanderCd = k.rand() * 2;
  chicken.wanderTarget = null;
  chicken.chaseTarget = null;
  chicken.chaseTimer = 0;

  // Called by Link when he hits it.
  chicken.provoke = (target) => {
    chicken.chaseTarget = target;
    chicken.chaseTimer = CHICKEN_CHASE_TIME;
    chicken.hitCooldown = CHICKEN_HIT_COOLDOWN;
    chicken.enterState("chase");
  };

  chicken.onStateUpdate("idle", () => {
    chicken.wanderCd -= k.dt();
    if (chicken.wanderCd <= 0) {
      chicken.wanderCd = 1 + k.rand() * 2.5;
      const from = world.toTile(chicken.pos);
      const opts = CARDINALS.map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy })).filter(
        (t) => world.walkable(t.x, t.y)
      );
      chicken.wanderTarget = opts.length ? k.choose(opts) : null;
    }
    if (chicken.wanderTarget) {
      const d = world.tc(chicken.wanderTarget).sub(chicken.pos);
      if (d.len() > 2) {
        if (Math.abs(d.x) > 1) chicken.flipX = d.x < 0;
        chicken.move(d.unit().scale(CHICKEN_SPEED * 0.4));
      } else chicken.wanderTarget = null;
    }
  });

  chicken.onStateUpdate("chase", () => {
    chicken.chaseTimer -= k.dt();
    const tgt = chicken.chaseTarget;
    const alive = tgt && tgt.exists && tgt.exists();
    if (chicken.chaseTimer <= 0 || !alive) {
      chicken.chaseTarget = null;
      chicken.enterState("idle");
      return;
    }
    const d = tgt.pos.sub(chicken.pos);
    if (d.len() > 2) {
      if (Math.abs(d.x) > 1) chicken.flipX = d.x < 0;
      chicken.move(d.unit().scale(CHICKEN_SPEED));
    }
  });

  chicken.onUpdate(() => {
    if (chicken.hitCooldown > 0) chicken.hitCooldown -= k.dt();
    chicken.z = chicken.pos.y;
  });

  return chicken;
}
