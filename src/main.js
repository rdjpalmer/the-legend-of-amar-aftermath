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

// Actor sprites.
k.loadSprite("link", "assets/link.png");

// Background music. Browsers block autoplay until the user interacts, so start
// looping on the first key/click and keep the handle across scene changes.
k.loadSound("bg-music", "src/assets/bg-music.mp3");
let music = null;
let muted = false;
function startMusic() {
  if (music || muted) return;
  music = k.play("bg-music", { loop: true, volume: 0.5 });
}
k.onKeyPress(startMusic);
k.onMousePress(startMusic);
k.onKeyPress("m", () => {
  muted = !muted;
  if (music) music.paused = muted;
});

registerGameScene(k);
registerEndScenes(k);
k.go("game");

// Dev-only handle for headless checks / console poking: open with ?debug.
if (location.search.includes("debug")) window.__k = k;
