import type { Vec4Like } from "@aperture-engine/simulation";

/**
 * D2 (clipping planes). Maximum number of simultaneously active clip planes per
 * view (and per resolved camera+material set). The fragment discard path unrolls
 * over a fixed-size `array<vec4f, MAX_CLIP_PLANES>` in the view uniform, so this
 * is both the packed-transport capacity and the documented authoring limit. A
 * camera (or material) that requests more planes has the extras dropped and a
 * structured diagnostic emitted (loud-over-silent) rather than crashing.
 */
export const MAX_CLIP_PLANES = 8;

/**
 * A world-space clip plane `(nx, ny, nz, d)`. A world-space point `p` is KEPT
 * when `dot(p, (nx, ny, nz)) + d >= 0` and clipped (discarded) otherwise —
 * matching three.js `THREE.Plane` (`normal`, `constant`) semantics.
 */
export type ClipPlane = readonly [number, number, number, number];

export interface ResolveClipPlanesInput {
  /** Per-camera (view-wide) planes; three.js `renderer.clippingPlanes` analog. */
  readonly cameraPlanes?: readonly Vec4Like[] | null;
  /** Per-material planes; three.js `Material.clippingPlanes` analog. */
  readonly materialPlanes?: readonly Vec4Like[] | null;
  /** Override the plane cap (defaults to {@link MAX_CLIP_PLANES}). */
  readonly limit?: number;
}

export interface ResolvedClipPlanes {
  /** The effective planes after union + cap, in `[camera…, material…]` order. */
  readonly planes: readonly ClipPlane[];
  /** Total requested plane count before the cap (finite planes only). */
  readonly requested: number;
  /** How many planes were dropped by the cap (0 when within the limit). */
  readonly dropped: number;
  /** True when the cap dropped at least one plane. */
  readonly exceeded: boolean;
  /** Effective cap applied (clamped `limit`). */
  readonly limit: number;
}

/**
 * Coerce a single plane-like value into a finite `ClipPlane`, or `null` when it
 * is missing or carries a non-finite component (so malformed authored planes are
 * dropped rather than poisoning the uniform with NaN/Infinity).
 */
export function normalizeClipPlane(
  value: Vec4Like | null | undefined,
): ClipPlane | null {
  if (value === null || value === undefined) {
    return null;
  }

  const nx = value[0];
  const ny = value[1];
  const nz = value[2];
  const d = value[3];

  if (
    typeof nx !== "number" ||
    typeof ny !== "number" ||
    typeof nz !== "number" ||
    typeof d !== "number" ||
    !Number.isFinite(nx) ||
    !Number.isFinite(ny) ||
    !Number.isFinite(nz) ||
    !Number.isFinite(d)
  ) {
    return null;
  }

  return [nx, ny, nz, d];
}

/** Coerce a list of plane-likes to finite `ClipPlane`s, dropping malformed ones. */
export function normalizeClipPlanes(
  values: readonly Vec4Like[] | null | undefined,
): ClipPlane[] {
  if (values === null || values === undefined) {
    return [];
  }

  const planes: ClipPlane[] = [];

  for (const value of values) {
    const plane = normalizeClipPlane(value);

    if (plane !== null) {
      planes.push(plane);
    }
  }

  return planes;
}

/**
 * Resolve the effective clip-plane set for a draw from its camera and (optional)
 * material planes. Material planes UNION with the camera planes (three.js applies
 * both), camera planes first. The union is capped at {@link MAX_CLIP_PLANES}; the
 * overflow is reported through `dropped`/`exceeded` so callers can emit a
 * structured diagnostic. Zero planes in ⇒ zero planes out (the byte-identical,
 * no-clip case).
 */
export function resolveClipPlanes(
  input: ResolveClipPlanesInput,
): ResolvedClipPlanes {
  const limit = clampLimit(input.limit);
  const union = [
    ...normalizeClipPlanes(input.cameraPlanes),
    ...normalizeClipPlanes(input.materialPlanes),
  ];
  const requested = union.length;
  const planes = requested > limit ? union.slice(0, limit) : union;
  const dropped = requested - planes.length;

  return {
    planes,
    requested,
    dropped,
    exceeded: dropped > 0,
    limit,
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return MAX_CLIP_PLANES;
  }

  return Math.max(0, Math.min(MAX_CLIP_PLANES, Math.floor(limit)));
}
