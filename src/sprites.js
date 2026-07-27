// Placeholder visuals. Each factory returns the drawing components for a kind of
// thing (shape + color + outline, anchored at center). Game logic never depends
// on these, so a real sprite atlas can replace them later via loadSprite without
// touching the rest of the game.

const SPEC = {
  obstacle: { shape: "rect", w: 34, h: 34, radius: 6, color: [96, 90, 82], outline: [52, 48, 42] },
  pot:      { shape: "rect", w: 24, h: 28, radius: 8, color: [196, 110, 62], outline: [122, 66, 36] },
  grass:    { shape: "rect", w: 18, h: 18, radius: 3, color: [150, 205, 96], outline: [86, 146, 54] },
  chicken:  { shape: "circle", r: 12,             color: [242, 242, 236], outline: [206, 176, 60] },
  link:     { shape: "rect", w: 28, h: 32, radius: 5, color: [34, 148, 70], outline: [14, 66, 32] },
  player:   { shape: "rect", w: 24, h: 28, radius: 5, color: [80, 150, 230], outline: [36, 82, 152] },
  shard:    { shape: "rect", w: 12, h: 12, radius: 2, color: [212, 152, 90], outline: [132, 82, 40] },
};

export function visual(k, kind) {
  const s = SPEC[kind];
  const comps =
    s.shape === "circle"
      ? [k.circle(s.r)]
      : [k.rect(s.w, s.h, { radius: s.radius ?? 0 })];
  comps.push(k.color(...s.color));
  if (s.outline) comps.push(k.outline(2, k.rgb(...s.outline)));
  comps.push(k.anchor("center"));
  return comps;
}
