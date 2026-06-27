// A small, dependency-free seeded PRNG so systems have a sanctioned source of
// randomness that replays bit-identically. Replay determinism holds only when
// systems use `context.random` instead of `Math.random()`.

export interface ApertureRandom {
  /** The seed this stream was created from. */
  readonly seed: number;
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Next float in [min, max). */
  range(min: number, max: number): number;
  /** A deterministic independent sub-stream derived from a label. */
  fork(label: string): ApertureRandom;
}

export function createApertureRandom(seed = 0): ApertureRandom {
  // mulberry32
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed,
    next,
    int(maxExclusive: number): number {
      return Math.floor(next() * Math.max(0, maxExclusive));
    },
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    fork(label: string): ApertureRandom {
      return createApertureRandom(hashSeed(seed, label));
    },
  };
}

function hashSeed(seed: number, label: string): number {
  // FNV-1a over the label, mixed with the parent seed.
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = Math.imul(hash ^ label.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}
