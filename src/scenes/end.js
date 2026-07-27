// Win / lose screens. Show the result and offer retry (same seed) or a new scene.

import { CANVAS_W, CANVAS_H } from "../config.js";

export function registerEndScenes(k) {
  const screen = (title, subtitle, tint) => (opts = {}) => {
    k.add([k.rect(CANVAS_W, CANVAS_H), k.pos(0, 0), k.color(...tint)]);
    k.add([
      k.text(title, { size: 48 }),
      k.pos(CANVAS_W / 2, CANVAS_H / 2 - 60),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);
    k.add([
      k.text(subtitle, { size: 20, width: CANVAS_W - 120, align: "center" }),
      k.pos(CANVAS_W / 2, CANVAS_H / 2 + 10),
      k.anchor("center"),
      k.color(235, 235, 235),
    ]);
    k.add([
      k.text("R: retry same scene     N: new scene", { size: 18 }),
      k.pos(CANVAS_W / 2, CANVAS_H - 50),
      k.anchor("center"),
      k.color(220, 220, 220),
      k.opacity(0.85),
    ]);

    k.onKeyPress("r", () => k.go("game", { seed: opts.seed }));
    k.onKeyPress("n", () => k.go("game"));
  };

  k.scene(
    "win",
    screen("You cleaned up!", "Every shard swept before Link slipped away.", [30, 90, 60])
  );
  k.scene(
    "lose",
    (opts = {}) =>
      screen(
        "Too slow!",
        `Link left with ${opts.left ?? 0} shard${opts.left === 1 ? "" : "s"} still on the ground.`,
        [110, 50, 50]
      )(opts)
  );
}
