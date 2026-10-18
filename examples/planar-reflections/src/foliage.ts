import { mesh } from "@aperture-engine/app/systems";

export type FoliagePoint = readonly [number, number, number];

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
  readonly clusters: readonly LeafletCluster[];
  readonly leaflet: LeafletDimensions;
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

/** Eight outward triangles around a diamond rim and two raised face centers. */
export function leafletTriangles(size: LeafletDimensions): FoliagePoint[] {
  for (const [name, value] of Object.entries(size)) {
    if (!Number.isFinite(value) || value <= 0)
      throw new RangeError(`leaflet.${name} must be finite and positive.`);
  }
  const rim: FoliagePoint[] = [
    [0, size.length / 2, 0],
    [-size.width / 2, 0, 0],
    [0, -size.length / 2, 0],
    [size.width / 2, 0, 0],
  ];
  const front: FoliagePoint = [0, 0, size.thickness / 2];
  const back: FoliagePoint = [0, 0, -size.thickness / 2];
  const positions: FoliagePoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rim[i]!,
      b = rim[(i + 1) % 4]!;
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
  const variation = options.sizeVariation ?? 0.2;
  if (!Number.isFinite(variation) || variation < 0 || variation > 0.8)
    throw new RangeError("foliage.sizeVariation must be in [0, 0.8].");
  const tilt = options.leafTiltDegrees ?? 30;
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 85)
    throw new RangeError("foliage.leafTiltDegrees must be in [0, 85].");
  leafletTriangles(options.leaflet);
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
    if (!Number.isSafeInteger(cluster.count) || cluster.count < 0)
      throw new RangeError("cluster.count must be a nonnegative integer.");
    const batch = cluster.batch ?? 0;
    if (!Number.isSafeInteger(batch) || batch < 0)
      throw new RangeError("cluster.batch must be a nonnegative integer.");
    const rotateCluster = rotation(cluster.rotationEulerDegrees ?? [0, 0, 0]);
    const leaf = leafletTriangles(cluster.leaflet ?? options.leaflet);
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
        group.positions.push(position);
      }
      group.count++;
    }
  }
  return [...groups].map(([batch, group]) => ({
    batch,
    mesh: mesh.triangleList({ positions: group.positions }),
    leafletCount: group.count,
    triangleCount: group.count * 8,
  }));
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
