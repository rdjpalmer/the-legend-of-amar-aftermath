import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { CANVAS_W, CANVAS_H } from "./config.js";
import { registerGameScene } from "./scenes/game.js";
import { registerEndScenes } from "./scenes/end.js";

const k = kaplay({
  width: CANVAS_W,
  height: CANVAS_H,
  background: [24, 26, 34],
  letterbox: true,
  global: false,
  pixelDensity: 1,
});

// No gravity: this is a top-down game.
k.setGravity(0);

registerGameScene(k);
registerEndScenes(k);
k.go("game");

// Dev-only handle for headless checks / console poking: open with ?debug.
if (location.search.includes("debug")) window.__k = k;
