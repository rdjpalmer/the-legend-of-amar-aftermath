// The player: input-driven, collides with solid obstacles/walls, cleans shards.

import { PLAYER_SPEED } from "../config.js";
import { visual } from "../sprites.js";

export function addPlayer(k, world) {
  const p = world.tc(world.level.playerSpawn);
  const player = k.add([
    ...visual(k, "player"),
    k.pos(p),
    k.area({ collisionIgnore: ["link", "chicken"], scale: 0.4 }),
    k.body(), // dynamic body: pushed out of static obstacles/walls
    "player",
  ]);

  player.onUpdate(() => {
    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;
    if (dir.x !== 0 || dir.y !== 0) {
      player.move(dir.unit().scale(PLAYER_SPEED)); // unit() => diagonals aren't faster
    }
    player.z = player.pos.y; // depth sort
  });

  // Sweep up shards on contact.
  player.onCollide("shard", (s) => {
    if (s.cleaned) return;
    s.cleaned = true;
    s.destroy();
    world.onShardsChanged();
  });

  return player;
}
