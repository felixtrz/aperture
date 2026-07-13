/**
 * Pure, deterministic mesh-LOD level selection (E2). No ECS, no camera, no
 * renderer state — just the distance → level-index math (with a hysteresis
 * band) so it is unit-testable in isolation and behaves identically on the
 * worker, in replay, and in tests.
 *
 * The model matches three.js `THREE.LOD`: N levels sorted by an ascending
 * distance threshold (level 0 = highest detail, threshold usually 0). The
 * active level is the highest index whose threshold the camera→object distance
 * has passed. A symmetric hysteresis band of `hysteresis` world units around
 * each boundary keeps the previously-selected level sticky, so a camera
 * loitering on a boundary does not pop back and forth between levels frame to
 * frame (three.js has no such band — this is a strict improvement).
 */

/** A resolved LOD level as stored on the `Lod` component. */
export interface LodResolvedLevel {
  /** Mesh asset handle id (`"mesh:<id>"`) drawn while this level is active. */
  readonly meshId: string;
  /** Ascending distance (world units) at which this level begins to show. */
  readonly distance: number;
}

/**
 * Select the LOD level for a camera→object distance.
 *
 * @param distance     camera→object distance in world units (>= 0).
 * @param thresholds   ascending per-level begin distances; `thresholds[i]` is
 *                     the distance at which level `i` starts. `thresholds[0]`
 *                     is normally 0. Length === level count.
 * @param currentLevel the level selected on the previous frame (the sticky
 *                     state that makes the hysteresis band directional).
 * @param hysteresis   half-width of the hysteresis band in world units (>= 0).
 *                     0 reproduces three.js' hard boundary switch.
 * @returns the selected level index in `[0, thresholds.length - 1]`.
 *
 * A switch to a COARSER level (index up) needs `distance >= thresholds[next] +
 * hysteresis`; a switch to a FINER level (index down) needs `distance <
 * thresholds[current] - hysteresis`. Between those the current level is kept.
 */
export function selectLodLevel(
  distance: number,
  thresholds: readonly number[],
  currentLevel: number,
  hysteresis: number,
): number {
  const levelCount = thresholds.length;

  if (levelCount === 0) {
    return 0;
  }

  const band = Number.isFinite(hysteresis) ? Math.max(0, hysteresis) : 0;
  const finiteDistance = Number.isFinite(distance) ? distance : 0;
  let level = clampLevel(Math.trunc(currentLevel), levelCount);

  // Climb to coarser levels while the distance has cleared the next boundary
  // plus the band.
  while (
    level < levelCount - 1 &&
    finiteDistance >= (thresholds[level + 1] ?? Infinity) + band
  ) {
    level += 1;
  }

  // Descend to finer levels while the distance has dropped below the current
  // boundary minus the band. Only one of the two loops can run for a given
  // distance because the thresholds are ascending and the bands are symmetric.
  while (level > 0 && finiteDistance < (thresholds[level] ?? 0) - band) {
    level -= 1;
  }

  return level;
}

/** Clamp a (possibly stale / out-of-range) level index into `[0, count-1]`. */
export function clampLevel(level: number, levelCount: number): number {
  if (levelCount <= 0) {
    return 0;
  }

  if (!Number.isFinite(level) || level < 0) {
    return 0;
  }

  return level > levelCount - 1 ? levelCount - 1 : Math.trunc(level);
}

/** Euclidean distance between two world-space points. */
export function lodDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
