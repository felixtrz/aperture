// Pure level data + geometry helpers (no ECS) so they're unit-testable and
// shared between the setup and player systems.
export interface Platform {
  readonly x0: number;
  readonly x1: number;
  readonly top: number;
}

// A ground strip from x=-10..-2, a PIT from -2..2, a landing strip 2..10,
// and a raised platform 4..6 at height 2.
export const PLATFORMS: readonly Platform[] = [
  { x0: -10, x1: -2, top: 0 },
  { x0: 2, x1: 10, top: 0 },
  { x0: 4, x1: 6, top: 2 },
];

export const COINS: readonly { readonly key: string; readonly x: number; readonly y: number }[] = [
  { key: "coin.a", x: -4, y: 1 },
  { key: "coin.b", x: 5, y: 3 },
  { key: "coin.c", x: 8, y: 1 },
];

export const PLAYER_SPAWN: readonly [number, number] = [-8, 1.5];
export const GOAL_X = 9;
export const DEATH_Y = -3;

// Highest solid platform top at world X that is at or below `fromY` (so the
// player lands on the surface it's falling onto, not one above it).
export function groundTopAt(x: number, fromY: number): number {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x < p.x0 || x > p.x1) continue;
    if (p.top <= fromY + 1e-3 && p.top > best) best = p.top;
  }
  return best;
}
