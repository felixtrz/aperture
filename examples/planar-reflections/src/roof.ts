import {
  mesh,
  type PolygonMeshDescriptorOptions,
} from "@aperture-engine/app/systems";

export type RoofPoint = readonly [number, number, number];
export type RoofCoordinate = readonly [across: number, uphill: number];
type Face = RoofPoint[];

export interface RoofFace {
  readonly origin: RoofPoint;
  /** Perpendicular directions; lengths are ignored. across × uphill faces outward. */
  readonly across: RoofPoint;
  readonly uphill: RoofPoint;
  /** Convex face boundary in roof-plane distances; either winding is accepted. */
  readonly boundary: readonly RoofCoordinate[];
}

export interface BarrelTile {
  readonly width: number;
  readonly length: number;
  readonly thickness: number;
  /** Covered length, greater than zero and less than half the tile length. */
  readonly overlap: number;
  /** Downhill lip lift above the uphill tail; defaults to 1.6 × thickness × length / pitch. */
  readonly lipRise?: number;
  /** Fractional narrowing toward the uphill tail, in [0, 0.35]; default 0.12. */
  readonly taper?: number;
  /** Facets across a half-barrel, in [4, 16]; default 6. */
  readonly radialSegments?: number;
  /** Clearance along the roof normal; default 0.005 × width. */
  readonly clearance?: number;
}

export interface RoofTileOptions {
  readonly tile: BarrelTile;
  readonly seed: number;
  /** Related material variants, in [1, 16]; default 4. */
  readonly materialCount?: number;
}

export interface RoofFaceTileOptions extends RoofTileOptions {
  readonly face: RoofFace;
  /** Centerline spacing; default tile.width. Keep near width to avoid exposed bed. */
  readonly columnPitch?: number;
  /** Across-distance of column zero; default 0. Shift the grid without moving the face. */
  readonly columnOffset?: number;
  /** Omit hip slivers smaller than this fraction of width/length; default 0.04. */
  readonly minimumFragment?: number;
}

export interface RoofCapTileOptions extends RoofTileOptions {
  /** Explicit eave-to-peak or ridge endpoints; geometry never extends past them. */
  readonly start: RoofPoint;
  readonly end: RoofPoint;
  /** Outward hint, projected perpendicular to the cap axis. */
  readonly up: RoofPoint;
}

export interface RoofTilePiece {
  readonly column: number;
  readonly course: number;
  /** Closed world-space faces retained for inspection; no entities or materials. */
  readonly faces: PolygonMeshDescriptorOptions["faces"];
}

export interface RoofTileBatch {
  readonly batch: number;
  /** A material can have multiple chunks; include chunk in the ECS key. */
  readonly chunk: number;
  readonly mesh: ReturnType<typeof mesh.polygons>;
  readonly pieces: readonly RoofTilePiece[];
}

/**
 * Parallel barrel courses with real lap height, tapered tails and closed hip cuts.
 * Pure authored geometry; the caller owns roof layout, materials and ECS entities.
 */
export function roofFaceTileBatches(
  options: RoofFaceTileOptions,
): RoofTileBatch[] {
  const settings = validate(options);
  const { face } = options;
  finitePoint(face.origin, "face.origin");
  const across = unit(face.across, "face.across");
  const uphill = unit(face.uphill, "face.uphill");
  if (Math.abs(dot(across, uphill)) > 1e-7)
    throw new RangeError(
      "roof face.across and face.uphill must be perpendicular.",
    );
  const normal = cross(across, uphill);
  const boundary = convexBoundary(face.boundary);
  const xs = boundary.map((p) => p[0]),
    ys = boundary.map((p) => p[1]);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs);
  const yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  const columnPitch = options.columnPitch ?? options.tile.width;
  positive(columnPitch, "columnPitch");
  if (
    columnPitch < options.tile.width * 0.9 ||
    columnPitch > options.tile.width * 1.25
  )
    throw new RangeError("roof columnPitch must be 0.9–1.25 times tile.width.");
  const minimumFragment = options.minimumFragment ?? 0.04;
  range(minimumFragment, 0.001, 0.25, "minimumFragment");
  const columnOffset = options.columnOffset ?? 0;
  if (!Number.isFinite(Math.fround(columnOffset)))
    throw new RangeError(
      "roof columnOffset must be a finite float32 distance.",
    );
  const first = Math.ceil(
    (xMin - options.tile.width / 2 - columnOffset) / columnPitch,
  );
  const last = Math.floor(
    (xMax + options.tile.width / 2 - columnOffset) / columnPitch,
  );
  const courses = Math.ceil((yMax - yMin) / settings.pitch);
  if (
    !Number.isSafeInteger(first) ||
    !Number.isSafeInteger(last) ||
    !Number.isSafeInteger(courses * (last - first + 1)) ||
    courses * (last - first + 1) > 20000
  )
    throw new RangeError(
      "roof face exceeds 20000 candidate tiles or safe column indices; split the face, enlarge tiles or reduce columnOffset.",
    );
  const epsilon =
    Math.min(options.tile.width, options.tile.length, options.tile.thickness) *
    1e-8;
  const groups = new Map<number, RoofTilePiece[]>();
  let state = options.seed >>> 0;
  for (let course = 0; course < courses; course++) {
    for (let column = first; column <= last; column++) {
      // Every candidate advances the private stream, even when clipping removes it.
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const batch = Math.floor((state / 4294967296) * settings.materialCount);
      let faces = tileFaces(
        options.tile,
        settings,
        columnOffset + column * columnPitch,
        yMin + course * settings.pitch,
      );
      for (let edge = 0; edge < boundary.length && faces.length; edge++) {
        const a = boundary[edge]!,
          b = boundary[(edge + 1) % boundary.length]!;
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        const length = Math.hypot(dx, dy);
        faces = clip(
          faces,
          (p) => (dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length,
          epsilon,
        );
      }
      if (!faces.length) continue;
      const points = faces.flat();
      const extent = (axis: number): number =>
        Math.max(...points.map((p) => p[axis]!)) -
        Math.min(...points.map((p) => p[axis]!));
      if (
        extent(0) < options.tile.width * minimumFragment ||
        extent(1) < options.tile.length * minimumFragment
      )
        continue;
      const world = faces.map((outline) => ({
        outline: outline.map(
          (p): RoofPoint => [
            face.origin[0] +
              across[0] * p[0] +
              uphill[0] * p[1] +
              normal[0] * p[2],
            face.origin[1] +
              across[1] * p[0] +
              uphill[1] * p[1] +
              normal[1] * p[2],
            face.origin[2] +
              across[2] * p[0] +
              uphill[2] * p[1] +
              normal[2] * p[2],
          ],
        ),
      }));
      for (const { outline } of world) {
        const rounded = outline.map(
          (p): RoofPoint => [
            Math.fround(p[0]),
            Math.fround(p[1]),
            Math.fround(p[2]),
          ],
        );
        if (
          rounded.some(
            (p, i) =>
              !p.every(Number.isFinite) ||
              Math.hypot(...subtract(p, rounded[(i + 1) % rounded.length]!)) ===
                0,
          )
        )
          throw new RangeError(
            "roof tile edges collapse in float32; reduce origin magnitude or increase tile/fragment dimensions.",
          );
      }
      const group = groups.get(batch) ?? [];
      group.push({ column, course, faces: world });
      groups.set(batch, group);
    }
  }
  const result: RoofTileBatch[] = [];
  for (const [batch, pieces] of [...groups].sort(([a], [b]) => a - b)) {
    let chunk = 0,
      count = 0,
      current: RoofTilePiece[] = [];
    const flush = (): void => {
      if (!current.length) return;
      result.push({
        batch,
        chunk: chunk++,
        pieces: current,
        mesh: mesh.polygons({ faces: current.flatMap((p) => p.faces) }),
      });
      current = [];
      count = 0;
    };
    for (const piece of pieces) {
      // <= 1024 faces and <= 65536 corners, comfortably below facade limits.
      const corners = piece.faces.reduce((sum, f) => sum + f.outline.length, 0);
      if (count + corners > 16000) flush();
      current.push(piece);
      count += corners;
      if (current.reduce((sum, p) => sum + p.faces.length, 0) >= 900) flush();
    }
    flush();
  }
  return result;
}

/** One fitted cap course. Supply a wider tile and explicit offset endpoints to cover hips. */
export function roofCapTileBatches(
  options: RoofCapTileOptions,
): RoofTileBatch[] {
  finitePoint(options.start, "cap.start");
  finitePoint(options.end, "cap.end");
  const axis = subtract(options.end, options.start);
  const length = Math.hypot(...axis);
  const uphill = unit(axis, "cap axis");
  const up = unit(options.up, "cap.up");
  const across = unit(cross(uphill, up), "cap up/axis cross product");
  return roofFaceTileBatches({
    ...options,
    columnPitch: options.tile.width,
    face: {
      origin: options.start,
      across,
      uphill,
      boundary: [
        [-options.tile.width / 2, 0],
        [options.tile.width / 2, 0],
        [options.tile.width / 2, length],
        [-options.tile.width / 2, length],
      ],
    },
  });
}

interface Settings {
  pitch: number;
  lipRise: number;
  taper: number;
  segments: number;
  clearance: number;
  materialCount: number;
}

function validate(options: RoofTileOptions): Settings {
  const t = options.tile;
  for (const key of ["width", "length", "thickness", "overlap"] as const)
    positive(t[key], `tile.${key}`);
  if (t.overlap >= t.length / 2)
    throw new RangeError(
      "roof tile.overlap must be less than half tile.length.",
    );
  const pitch = t.length - t.overlap;
  const lipRise = t.lipRise ?? (1.6 * t.thickness * t.length) / pitch;
  positive(lipRise, "tile.lipRise");
  if ((lipRise * pitch) / t.length <= t.thickness * 1.05)
    throw new RangeError(
      "roof tile.lipRise must lift each overlap more than 1.05 × thickness; coplanar laps are invalid.",
    );
  const taper = t.taper ?? 0.12;
  range(taper, 0, 0.35, "tile.taper");
  if (t.thickness >= (t.width * (1 - taper)) / 2)
    throw new RangeError(
      "roof tile.thickness must be smaller than the tapered inner radius.",
    );
  const segments = t.radialSegments ?? 6;
  integer(segments, 4, 16, "tile.radialSegments");
  const clearance = t.clearance ?? t.width * 0.005;
  range(clearance, 0, t.width, "tile.clearance");
  const materialCount = options.materialCount ?? 4;
  integer(materialCount, 1, 16, "materialCount");
  if (!Number.isSafeInteger(options.seed))
    throw new RangeError("roof seed must be a safe integer.");
  return { pitch, lipRise, taper, segments, clearance, materialCount };
}

function tileFaces(
  tile: BarrelTile,
  s: Settings,
  x: number,
  y: number,
): Face[] {
  const section = (tail: boolean): Face => {
    const radius = (tile.width / 2) * (tail ? 1 - s.taper : 1);
    const lift = s.clearance + (tail ? 0 : s.lipRise);
    const arc = (r: number): Face =>
      Array.from({ length: s.segments + 1 }, (_, i): RoofPoint => {
        const a = (i * Math.PI) / s.segments;
        return [
          x + Math.cos(a) * r,
          y + (tail ? tile.length : 0),
          lift + (i === 0 || i === s.segments ? 0 : Math.sin(a) * r),
        ];
      });
    return [...arc(radius), ...arc(radius - tile.thickness).reverse()];
  };
  const low = section(false),
    high = section(true);
  const faces: Face[] = [low, [...high].reverse()];
  for (let i = 0; i < low.length; i++) {
    const j = (i + 1) % low.length;
    faces.push([low[i]!, high[i]!, high[j]!, low[j]!]);
  }
  return faces;
}

/** Clip every face, then reverse the exposed boundary to close the cut. */
function clip(
  faces: Face[],
  distance: (p: RoofPoint) => number,
  epsilon: number,
): Face[] {
  const key = (p: RoofPoint): string => p.join(",");
  const intersections = new Map<string, RoofPoint>();
  const clipped: Face[] = [];
  const boundary = new Map<string, readonly [RoofPoint, RoofPoint]>();
  const d = (p: RoofPoint): number => {
    const v = distance(p);
    return Math.abs(v) <= epsilon ? 0 : v;
  };
  for (const face of faces) {
    const output: Face = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!,
        b = face[(i + 1) % face.length]!,
        da = d(a),
        db = d(b);
      if (da >= 0) output.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
        const ka = key(a),
          kb = key(b),
          edge = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        let p = intersections.get(edge);
        if (!p) {
          const t = da / (da - db);
          p = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ];
          intersections.set(edge, p);
        }
        output.push(p);
      }
    }
    if (output.length < 3) continue;
    clipped.push(output);
    for (let i = 0; i < output.length; i++) {
      const a = output[i]!,
        b = output[(i + 1) % output.length]!;
      if (Math.abs(distance(a)) > epsilon || Math.abs(distance(b)) > epsilon)
        continue;
      const edge = `${key(a)}|${key(b)}`,
        reverse = `${key(b)}|${key(a)}`;
      if (boundary.has(reverse)) boundary.delete(reverse);
      else boundary.set(edge, [a, b]);
    }
  }
  // The half-barrel is a continuous shell over a convex footprint. Its cut has one loop.
  if (boundary.size) {
    const next = new Map([...boundary.values()].map(([a, b]) => [key(b), a]));
    const start = boundary.values().next().value![0];
    const cap: Face = [start];
    let current = next.get(key(start));
    while (
      current &&
      key(current) !== key(start) &&
      cap.length <= boundary.size
    ) {
      cap.push(current);
      current = next.get(key(current));
    }
    if (!current || cap.length !== boundary.size)
      throw new RangeError(
        "roof clip could not close a boundary; avoid nearly coincident edges.",
      );
    if (cap.length >= 3) clipped.push(cap);
  }
  return clipped;
}

function convexBoundary(input: readonly RoofCoordinate[]): RoofCoordinate[] {
  if (
    input.length < 3 ||
    input.length > 16 ||
    input.some((p) => p.length !== 2 || !p.every(Number.isFinite))
  )
    throw new RangeError(
      "roof face.boundary must contain 3–16 finite 2D points.",
    );
  const points = [...input];
  const turn = (
    a: RoofCoordinate,
    b: RoofCoordinate,
    c: RoofCoordinate,
  ): number => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  if (turn(points[0]!, points[1]!, points[2]!) < 0) points.reverse();
  // Every vertex must be strictly left of every nonincident edge: also rejects stars.
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < points.length; j++) {
      if (j === i || j === (i + 1) % points.length) continue;
      if (turn(points[i]!, points[(i + 1) % points.length]!, points[j]!) <= 0)
        throw new RangeError(
          "roof face.boundary must be strictly convex without repeated/collinear corners.",
        );
    }
  return points;
}
function finitePoint(p: RoofPoint, name: string): void {
  if (p.length !== 3 || !p.every((v) => Number.isFinite(Math.fround(v))))
    throw new RangeError(
      `roof ${name} must contain three finite float32 coordinates.`,
    );
}
function positive(v: number, name: string): void {
  if (!Number.isFinite(Math.fround(v)) || Math.fround(v) <= 0)
    throw new RangeError(`roof ${name} must be finite and positive.`);
}
function range(v: number, min: number, max: number, name: string): void {
  if (!Number.isFinite(v) || v < min || v > max)
    throw new RangeError(`roof ${name} must be in [${min}, ${max}].`);
}
function integer(v: number, min: number, max: number, name: string): void {
  range(v, min, max, name);
  if (!Number.isSafeInteger(v))
    throw new RangeError(`roof ${name} must be an integer.`);
}
function subtract(a: RoofPoint, b: RoofPoint): RoofPoint {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: RoofPoint, b: RoofPoint): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: RoofPoint, b: RoofPoint): RoofPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function unit(p: RoofPoint, name: string): RoofPoint {
  finitePoint(p, name);
  const length = Math.hypot(...p);
  positive(length, `${name} length`);
  return [p[0] / length, p[1] / length, p[2] / length];
}
