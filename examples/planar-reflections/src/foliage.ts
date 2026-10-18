import { mesh } from "@aperture-engine/app/systems";

export type FoliagePoint = readonly [number, number, number];
export type LeafletProfile = "diamond" | "oval";

export interface LeafletDimensions {
  /** Full tip-to-tip length along local Y. */
  readonly length: number;
  /** Full width along local X. */
  readonly width: number;
  /** Full thickness along local Z; keep positive for a closed volume. */
  readonly thickness: number;
}

export interface LeafletCluster {
  readonly center: FoliagePoint;
  /** Ellipsoid radii for leaflet centers, before the cluster rotation. */
  readonly spread: FoliagePoint;
  readonly count: number;
  /** Clusters sharing an ID become one single-material descriptor. */
  readonly batch?: number;
  /** Rotate the center distribution in the same XYZ convention as spawn.mesh. */
  readonly rotationEulerDegrees?: FoliagePoint;
  /** Optional physical leaf size independent of the cluster's spread. */
  readonly leaflet?: LeafletDimensions;
}

export interface FoliageOptions {
  readonly seed: number;
  /** At most 1,024 clusters and 40,000 leaves across the whole call. */
  readonly clusters: readonly LeafletCluster[];
  readonly leaflet: LeafletDimensions;
  /** Closed four-corner diamond (default) or rounded twelve-corner oval. */
  readonly leafletProfile?: LeafletProfile;
  /** Fractional uniform size variation in [0, 0.8]; default 0.2. */
  readonly sizeVariation?: number;
  /** Maximum blade tilt from upright in degrees, in [0, 85]; default 30. */
  readonly leafTiltDegrees?: number;
}

export interface FoliageBatch {
  readonly batch: number;
  readonly mesh: ReturnType<typeof mesh.triangleList>;
  readonly leafletCount: number;
  readonly triangleCount: number;
}

export interface LeafletBranch {
  /** Base-to-tip attachment path with 2–512 points; shared with caller tubes. */
  readonly path: readonly FoliagePoint[];
  /** Candidate opposite leaf pairs, before gaps and density remove whole pairs. */
  readonly pairs: number;
  readonly batch?: number;
  readonly leaflet?: LeafletDimensions;
  /** Normalized arc-length interval to populate; default [0.15, 0.95]. */
  readonly range?: readonly [number, number];
  /** Up to 512 bare intervals in normalized full-path arc length. */
  readonly gaps?: readonly (readonly [number, number])[];
  /** Pair retention at range start/end, each in [0, 1]; default [1, 1]. */
  readonly density?: readonly [number, number];
  /** Blade angle away from the growing tangent, in [0, 85]; default 35. */
  readonly leafAngleDegrees?: number;
  /** Preferred blade face normal at the base; transported along the path. */
  readonly up?: FoliagePoint;
}

export interface BranchFoliageOptions {
  readonly seed: number;
  /** At most 1,024 branches and 20,000 candidate pairs across the whole call. */
  readonly branches: readonly LeafletBranch[];
  readonly leaflet: LeafletDimensions;
  /** Closed four-corner diamond (default) or rounded twelve-corner oval. */
  readonly leafletProfile?: LeafletProfile;
  /** Fractional uniform size variation in [0, 0.8]; default 0.2. */
  readonly sizeVariation?: number;
  /** Blade roll around its growth direction, in [0, 85]; default 40. */
  readonly leafTiltDegrees?: number;
}

/** Closed rim with shallow raised face centers; dimensions are full extents. */
export function leafletTriangles(
  size: LeafletDimensions,
  profile: LeafletProfile = "diamond",
): FoliagePoint[] {
  if (profile !== "diamond" && profile !== "oval")
    throw new RangeError('leafletProfile must be "diamond" or "oval".');
  for (const name of ["length", "width", "thickness"] as const) {
    const value = size[name];
    if (!Number.isFinite(value) || value <= 0)
      throw new RangeError(`leaflet.${name} must be finite and positive.`);
  }
  const diamond: FoliagePoint[] = [
    [0, size.length / 2, 0],
    [-size.width / 2, 0, 0],
    [0, -size.length / 2, 0],
    [size.width / 2, 0, 0],
  ];
  // Exact cardinal points preserve the authored extents and attachment tip.
  // The intermediate ellipse samples taper gradually into each rounded end.
  const s = Math.sqrt(3) / 2;
  const rim: FoliagePoint[] =
    profile === "diamond"
      ? diamond
      : [
          [0, 1, 0],
          [-0.5, s, 0],
          [-s, 0.5, 0],
          [-1, 0, 0],
          [-s, -0.5, 0],
          [-0.5, -s, 0],
          [0, -1, 0],
          [0.5, -s, 0],
          [s, -0.5, 0],
          [1, 0, 0],
          [s, 0.5, 0],
          [0.5, s, 0],
        ].map(
          ([x, y]): FoliagePoint => [
            (x! * size.width) / 2,
            (y! * size.length) / 2,
            0,
          ],
        );
  const front: FoliagePoint = [0, 0, size.thickness / 2];
  const back: FoliagePoint = [0, 0, -size.thickness / 2];
  const positions: FoliagePoint[] = [];
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]!,
      b = rim[(i + 1) % rim.length]!;
    positions.push(front, a, b, back, b, a);
  }
  return positions;
}

/**
 * Pure seeded geometry only: no tree layout, materials, ECS entities or globals.
 * Leaf centers fill each ellipsoid; individual leaves keep a small closed volume.
 * Flat triangle normals come from triangleList, including the underside.
 */
export function foliageBatches(options: FoliageOptions): FoliageBatch[] {
  if (!Number.isSafeInteger(options.seed))
    throw new RangeError("foliage.seed must be a safe integer.");
  if (options.clusters.length > 1024)
    throw new RangeError(
      "foliage.clusters must contain at most 1024 clusters.",
    );
  let candidateLeaves = 0;
  for (const cluster of options.clusters) {
    if (!Number.isSafeInteger(cluster.count) || cluster.count < 0)
      throw new RangeError("cluster.count must be a nonnegative integer.");
    candidateLeaves += cluster.count;
    if (candidateLeaves > 40000)
      throw new RangeError("foliage.clusters must total at most 40000 leaves.");
  }
  const variation = options.sizeVariation ?? 0.2;
  if (!Number.isFinite(variation) || variation < 0 || variation > 0.8)
    throw new RangeError("foliage.sizeVariation must be in [0, 0.8].");
  const tilt = options.leafTiltDegrees ?? 30;
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 85)
    throw new RangeError("foliage.leafTiltDegrees must be in [0, 85].");
  leafletTriangles(options.leaflet, options.leafletProfile);
  let state = options.seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const groups = new Map<
    number,
    { positions: FoliagePoint[]; count: number }
  >();
  for (const cluster of options.clusters) {
    finitePoint(cluster.center, "cluster.center");
    finitePoint(cluster.spread, "cluster.spread");
    if (cluster.spread.some((v) => v < 0))
      throw new RangeError("cluster.spread must be nonnegative.");
    const batch = cluster.batch ?? 0;
    if (!Number.isSafeInteger(batch) || batch < 0)
      throw new RangeError("cluster.batch must be a nonnegative integer.");
    const rotateCluster = rotation(cluster.rotationEulerDegrees ?? [0, 0, 0]);
    const leaf = leafletTriangles(
      cluster.leaflet ?? options.leaflet,
      options.leafletProfile,
    );
    if (cluster.count === 0) continue;
    const group = groups.get(batch) ?? { positions: [], count: 0 };
    groups.set(batch, group);
    for (let i = 0; i < cluster.count; i++) {
      const azimuth = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const radial = Math.cbrt(random());
      const ring = Math.sqrt(1 - y * y);
      const offset = rotateCluster([
        Math.cos(azimuth) * ring * radial * cluster.spread[0],
        y * radial * cluster.spread[1],
        Math.sin(azimuth) * ring * radial * cluster.spread[2],
      ]);
      // Upright blades share a growth direction while yaw exposes different faces.
      // Cluster rotation shapes their distribution, not the gravity-relative blades.
      const rotateLeaf = rotation([
        (random() * 2 - 1) * tilt,
        random() * 360,
        (random() * 2 - 1) * tilt,
      ]);
      const scale = 1 + (random() * 2 - 1) * variation;
      const leafStart = group.positions.length;
      for (const point of leaf) {
        const p = rotateLeaf(point);
        const q: FoliagePoint = [
          offset[0] + p[0] * scale,
          offset[1] + p[1] * scale,
          offset[2] + p[2] * scale,
        ];
        const position: FoliagePoint = [
          cluster.center[0] + q[0],
          cluster.center[1] + q[1],
          cluster.center[2] + q[2],
        ];
        finitePoint(position, "generated leaflet position");
        group.positions.push(
          options.leafletProfile === "oval"
            ? (position.map(Math.fround) as [number, number, number])
            : position,
        );
      }
      if (options.leafletProfile === "oval")
        validateFloat32Leaf(group.positions.slice(leafStart), "oval leaflet");
      group.count++;
    }
  }
  return [...groups].map(([batch, group]) => ({
    batch,
    mesh: mesh.triangleList({ positions: group.positions }),
    leafletCount: group.count,
    triangleCount: group.positions.length / 3,
  }));
}

/**
 * Attach closed leaf pairs to caller-authored paths. Paths describe geometry,
 * not scene ownership: the caller still authors tubes, materials and ECS entities.
 * Gaps remove attachment sites, so leaves may extend into a gap by their length.
 */
export function branchFoliageBatches(
  options: BranchFoliageOptions,
): FoliageBatch[] {
  if (!Number.isSafeInteger(options.seed))
    throw new RangeError("foliage.seed must be a safe integer.");
  if (options.branches.length > 1024)
    throw new RangeError(
      "foliage.branches must contain at most 1024 branches.",
    );
  let candidatePairs = 0;
  for (const branch of options.branches) {
    if (!Number.isSafeInteger(branch.pairs) || branch.pairs < 0)
      throw new RangeError("branch.pairs must be a nonnegative integer.");
    candidatePairs += branch.pairs;
    if (candidatePairs > 20000)
      throw new RangeError(
        "foliage.branches must total at most 20000 candidate pairs.",
      );
  }
  const variation = bounded(options.sizeVariation ?? 0.2, 0.8, "sizeVariation");
  const tilt = bounded(options.leafTiltDegrees ?? 40, 85, "leafTiltDegrees");
  const validateLeaf = (size: LeafletDimensions): FoliagePoint[] =>
    leafletTriangles(size, options.leafletProfile);
  validateLeaf(options.leaflet);
  let state = options.seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const groups = new Map<
    number,
    { positions: FoliagePoint[]; count: number }
  >();
  for (const branch of options.branches) {
    const batch = branch.batch ?? 0;
    if (!Number.isSafeInteger(batch) || batch < 0)
      throw new RangeError("branch.batch must be a nonnegative integer.");
    const range = branch.range ?? [0.15, 0.95];
    const gaps = branch.gaps ?? [];
    if (gaps.length > 512)
      throw new RangeError("branch.gaps must contain at most 512 intervals.");
    for (const interval of [range, ...gaps]) {
      if (
        interval.length !== 2 ||
        !interval.every(Number.isFinite) ||
        interval[0] < 0 ||
        interval[1] > 1 ||
        interval[0] >= interval[1]
      )
        throw new RangeError(
          "branch range/gaps must be increasing intervals in [0, 1].",
        );
    }
    const density = branch.density ?? [1, 1];
    if (density.length !== 2)
      throw new RangeError("branch.density needs start and end retention.");
    density.forEach((value) => bounded(value, 1, "branch.density"));
    const angle =
      (bounded(branch.leafAngleDegrees ?? 35, 85, "branch.leafAngleDegrees") *
        Math.PI) /
      180;
    const size = branch.leaflet ?? options.leaflet;
    const leaf = validateLeaf(size);
    const segments = branchSegments(branch.path, branch.up ?? [0, 1, 0]);
    const length = segments.at(-1)!.end;
    let segmentIndex = 0;
    for (let i = 0; i < branch.pairs; i++) {
      // Consume the same draws even for skipped pairs: thinning preserves the
      // surviving leaves and every later branch for controlled comparisons.
      const t = (i + 0.3 + random() * 0.4) / branch.pairs;
      const fraction = range[0] + (range[1] - range[0]) * t;
      const keep = random() < density[0] + (density[1] - density[0]) * t;
      const rolls = [random(), random()];
      const scales = [random(), random()];
      if (!keep || gaps.some(([a, b]) => fraction >= a && fraction <= b))
        continue;
      const distance = fraction * length;
      while (segments[segmentIndex]!.end < distance) segmentIndex++;
      const segment = segments[segmentIndex]!;
      const attachment = sum(
        segment.start,
        segment.tangent,
        distance - segment.offset,
      );
      const side = cross(segment.tangent, segment.normal);
      const group = groups.get(batch) ?? { positions: [], count: 0 };
      groups.set(batch, group);
      for (let j = 0; j < 2; j++) {
        const sign = j === 0 ? -1 : 1;
        const y = sum(
          scale(segment.tangent, Math.cos(angle)),
          side,
          sign * Math.sin(angle),
        );
        const x = cross(y, segment.normal);
        const roll = ((rolls[j]! * 2 - 1) * tilt * Math.PI) / 180;
        const bladeX = sum(
          scale(x, Math.cos(roll)),
          segment.normal,
          Math.sin(roll),
        );
        const bladeZ = cross(bladeX, y);
        const sizeScale = 1 + (scales[j]! * 2 - 1) * variation;
        const center = sum(attachment, y, (size.length * sizeScale) / 2);
        const positions = leaf.map(
          ([px, py, pz]): FoliagePoint =>
            sum(
              sum(sum(center, bladeX, px * sizeScale), y, py * sizeScale),
              bladeZ,
              pz * sizeScale,
            ).map(Math.fround) as [number, number, number],
        );
        validateFloat32Leaf(positions, "branch leaflet");
        group.positions.push(...positions);
        group.count++;
      }
    }
  }
  return [...groups].map(([batch, group]) => ({
    batch,
    mesh: mesh.triangleList({ positions: group.positions }),
    leafletCount: group.count,
    triangleCount: group.positions.length / 3,
  }));
}

function validateFloat32Leaf(
  positions: readonly FoliagePoint[],
  name: string,
): void {
  // Shared rim points keep closure; positive outward faces also catch collapse.
  const centroid = positions.reduce<FoliagePoint>(
    (c, p) => sum(c, p, 1 / positions.length),
    [0, 0, 0],
  );
  for (let k = 0; k < positions.length; k += 3) {
    const a = positions[k]!,
      b = positions[k + 1]!,
      c = positions[k + 2]!;
    const normal = cross(sum(b, a, -1), sum(c, a, -1));
    if (!a.every(Number.isFinite) || !(dot(normal, sum(a, centroid, -1)) > 0))
      throw new RangeError(
        `${name} collapses at Float32 precision; use local coordinates or larger dimensions.`,
      );
  }
}

interface BranchSegment {
  readonly start: FoliagePoint;
  readonly tangent: FoliagePoint;
  readonly normal: FoliagePoint;
  readonly offset: number;
  readonly end: number;
}

function branchSegments(
  path: readonly FoliagePoint[],
  up: FoliagePoint,
): BranchSegment[] {
  if (path.length < 2 || path.length > 512)
    throw new RangeError("branch.path needs between 2 and 512 points.");
  path.forEach((point) => finitePoint(point, "branch.path point"));
  finitePoint(up, "branch.up");
  let normal = unit(up),
    previous: FoliagePoint | undefined;
  const segments: BranchSegment[] = [];
  let offset = 0;
  for (let i = 1; i < path.length; i++) {
    const delta = sum(path[i]!, path[i - 1]!, -1);
    const length = Math.hypot(...delta);
    if (
      !Number.isFinite(length) ||
      length === 0 ||
      !Number.isFinite(offset + length)
    )
      throw new RangeError(
        "branch.path needs finite, distinct consecutive points and finite length.",
      );
    const tangent = unit(delta);
    if (previous) {
      // Minimal rotation between tangents, preserving roll through curved paths.
      const alignment = dot(previous, tangent);
      if (alignment > -1 + 1e-8)
        normal = sum(
          normal,
          sum(previous, tangent, 1),
          -dot(normal, tangent) / (1 + alignment),
        );
    }
    normal = sum(normal, tangent, -dot(normal, tangent));
    if (Math.hypot(...normal) < 1e-6) {
      const fallback: FoliagePoint =
        Math.abs(tangent[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1];
      normal = sum(fallback, tangent, -dot(fallback, tangent));
    }
    normal = unit(normal);
    segments.push({
      start: path[i - 1]!,
      tangent,
      normal,
      offset,
      end: offset + length,
    });
    offset += length;
    previous = tangent;
  }
  return segments;
}

function bounded(value: number, maximum: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > maximum)
    throw new RangeError(`foliage.${name} must be in [0, ${maximum}].`);
  return value;
}

function sum(a: FoliagePoint, b: FoliagePoint, amount: number): FoliagePoint {
  return [a[0] + b[0] * amount, a[1] + b[1] * amount, a[2] + b[2] * amount];
}

function scale(a: FoliagePoint, amount: number): FoliagePoint {
  return [a[0] * amount, a[1] * amount, a[2] * amount];
}

function dot(a: FoliagePoint, b: FoliagePoint): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: FoliagePoint, b: FoliagePoint): FoliagePoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function unit(a: FoliagePoint): FoliagePoint {
  const length = Math.hypot(...a);
  if (!Number.isFinite(length) || length === 0)
    throw new RangeError("branch direction must have a finite nonzero length.");
  return scale(a, 1 / length);
}

function finitePoint(point: FoliagePoint, name: string): void {
  if (point.length !== 3 || !point.every(Number.isFinite))
    throw new RangeError(`${name} must contain three finite values.`);
}

function rotation(degrees: FoliagePoint): (p: FoliagePoint) => FoliagePoint {
  finitePoint(degrees, "rotationEulerDegrees");
  const [x, y, z] = degrees.map((v) => (v * Math.PI) / 180) as [
    number,
    number,
    number,
  ];
  const cx = Math.cos(x),
    sx = Math.sin(x);
  const cy = Math.cos(y),
    sy = Math.sin(y);
  const cz = Math.cos(z),
    sz = Math.sin(z);
  // R = Rx Ry Rz, matching the XYZ quaternion in the spawn transform helper.
  return ([px, py, pz]): FoliagePoint => {
    const x1 = px * cz - py * sz,
      y1 = px * sz + py * cz;
    const x2 = x1 * cy + pz * sy,
      z2 = -x1 * sy + pz * cy;
    return [x2, y1 * cx - z2 * sx, y1 * sx + z2 * cx];
  };
}
