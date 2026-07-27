// Tunable constants. Ranges are [min, max] inclusive and rolled per-scene.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 14;
export const CANVAS_W = TILE * COLS; // 960
export const CANVAS_H = TILE * ROWS; // 560

// Movement (px/sec). Link is slightly faster than the player.
export const PLAYER_SPEED = 130;
export const LINK_SPEED = 150;

// Per-scene entity counts.
export const OBSTACLE_COUNT = [6, 12];
export const POT_COUNT = [5, 8];
export const GRASS_COUNT = [8, 15];
export const CHICKEN_COUNT = [2, 4];

// Gameplay tuning (used from later milestones).
export const THROW_TILES = [2, 3];
export const SHARDS_PER_POT = [1, 3];
export const DISTRACT_RADIUS = 4; // tiles
export const FLEE_TIME = 1.5; // seconds

// Draw layers. World entities use z = pos.y so lower sprites overlap higher
// ones; ground sits below everything, flying pots and HUD above.
export const Z = {
  GROUND: -10,
  FLYING: 5000,
  HUD: 10000,
};
