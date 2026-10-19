import { mesh } from "@aperture-engine/app/systems";
import type { RoofFace, RoofPoint } from "./roof.ts";

type SectionPoint = readonly [z: number, y: number];
type Span = readonly [min: number, max: number];

/** A two-slope bed envelope. All coordinates are in the caller's local frame. */
export interface RoofEnvelopeOptions {
  readonly roofX: Span;
  readonly wallX: Span;
  readonly wallZ: Span;
  readonly profile: readonly [SectionPoint, SectionPoint, SectionPoint];
  readonly baseY: number;
  /** Positive vertical bed thickness, not normal thickness. */
  readonly thickness: number;
}

export interface RoofEnvelopeFace {
  readonly name: string;
  readonly outline: readonly RoofPoint[];
}

export interface RoofEnvelopeSolid {
  readonly faces: readonly RoofEnvelopeFace[];
  readonly mesh: ReturnType<typeof mesh.polygons>;
}

export interface RoofEnvelope {
  readonly roof: RoofEnvelopeSolid;
  readonly wall: RoofEnvelopeSolid;
  readonly tileFaces: { readonly back: RoofFace; readonly front: RoofFace };
  /** Bed ridge only. Tile caps still require explicit covering width and offset. */
  readonly ridge: { readonly start: RoofPoint; readonly end: RoofPoint };
  readonly landmarks: Readonly<Record<string, RoofPoint>>;
}

/** Closed bed/overhang and fitted wall solids, with no separate guessed gable. */
export function roofEnvelope(options: RoofEnvelopeOptions): RoofEnvelope {
  validate(options);
  const { roofX, wallX, wallZ, profile, baseY, thickness } = options;
  const [back, ridge, front] = profile;
  const lower = ([z, y]: SectionPoint): SectionPoint => [z, y - thickness];
  const height = (z: number): number => {
    const [a, b] = z <= ridge[0] ? [back, ridge] : [ridge, front];
    return a[1] + ((z - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  };
  const wallBack: SectionPoint = [wallZ[0], height(wallZ[0]) - thickness];
  const wallFront: SectionPoint = [wallZ[1], height(wallZ[1]) - thickness];
  const roof = prism(
    roofX,
    [back, ridge, front, lower(front), lower(ridge), lower(back)],
    [
      "back-top",
      "front-top",
      "front-fascia",
      "front-underside",
      "back-underside",
      "back-fascia",
    ],
  );
  const wall = prism(
    wallX,
    [wallBack, lower(ridge), wallFront, [wallZ[1], baseY], [wallZ[0], baseY]],
    ["back-top", "front-top", "front-wall", "base", "back-wall"],
  );
  const middleX = (roofX[0] + roofX[1]) / 2;
  const halfWidth = (roofX[1] - roofX[0]) / 2;
  const tileFace = (eave: SectionPoint, acrossX: number): RoofFace => {
    const rise = ridge[1] - eave[1],
      run = ridge[0] - eave[0];
    const length = Math.hypot(rise, run);
    return {
      origin: [middleX, eave[1], eave[0]],
      across: [acrossX, 0, 0],
      uphill: [0, rise / length, run / length],
      boundary: [
        [-halfWidth, 0],
        [halfWidth, 0],
        [halfWidth, length],
        [-halfWidth, length],
      ],
    };
  };
  const point = (x: number, [z, y]: SectionPoint): RoofPoint => [x, y, z];
  return {
    roof,
    wall,
    tileFaces: { back: tileFace(back, -1), front: tileFace(front, 1) },
    ridge: { start: point(roofX[0], ridge), end: point(roofX[1], ridge) },
    landmarks: {
      "wall.back-left": point(wallX[0], wallBack),
      "wall.back-right": point(wallX[1], wallBack),
      "wall.front-left": point(wallX[0], wallFront),
      "wall.front-right": point(wallX[1], wallFront),
      "wall.ridge-left": point(wallX[0], lower(ridge)),
      "wall.ridge-right": point(wallX[1], lower(ridge)),
      "roof.back-left": point(roofX[0], back),
      "roof.back-right": point(roofX[1], back),
      "roof.front-left": point(roofX[0], front),
      "roof.front-right": point(roofX[1], front),
    },
  };
}

/** Profile winding is +X; the concave roof cap is triangulated by public polygons. */
function prism(
  x: Span,
  section: readonly SectionPoint[],
  names: readonly string[],
): RoofEnvelopeSolid {
  const left = section.map(([z, y]): RoofPoint => [x[0], y, z]);
  const right = section.map(([z, y]): RoofPoint => [x[1], y, z]);
  const faces: RoofEnvelopeFace[] = [
    { name: "left-end", outline: [...left].reverse() },
    { name: "right-end", outline: right },
    ...section.map((_, i) => {
      const next = (i + 1) % section.length;
      return {
        name: names[i]!,
        outline: [left[i]!, left[next]!, right[next]!, right[i]!],
      };
    }),
  ];
  return {
    faces,
    mesh: mesh.polygons({ faces: faces.map(({ outline }) => ({ outline })) }),
  };
}

function validate(options: RoofEnvelopeOptions): void {
  const fail = (message: string): never => {
    throw new RangeError(`roof envelope: ${message}`);
  };
  if (options === null || typeof options !== "object" || Array.isArray(options))
    fail("expected options object.");
  for (const key of Object.keys(options))
    if (
      !["roofX", "wallX", "wallZ", "profile", "baseY", "thickness"].includes(
        key,
      )
    )
      fail(`unknown input ${key}; derive slopes from profile only.`);
  const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e6;
  const pair = (p: unknown): p is Span =>
    Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]);
  if (
    ![options.roofX, options.wallX, options.wallZ].every(pair) ||
    !Array.isArray(options.profile) ||
    options.profile.length !== 3 ||
    !pair(options.profile[0]) ||
    !pair(options.profile[1]) ||
    !pair(options.profile[2]) ||
    !finite(options.baseY) ||
    !finite(options.thickness)
  )
    fail(
      "finite coordinate pairs, three profile points, baseY and thickness within +/-1e6 are required.",
    );
  const {
    roofX,
    wallX,
    wallZ,
    profile: [back, ridge, front],
    baseY,
    thickness,
  } = options;
  const spans = [
    roofX[1] - roofX[0],
    wallX[1] - wallX[0],
    wallZ[1] - wallZ[0],
    ridge[0] - back[0],
    front[0] - ridge[0],
  ];
  const scale = Math.max(
    1,
    ...[
      ...roofX,
      ...wallX,
      ...wallZ,
      ...back,
      ...ridge,
      ...front,
      baseY,
      thickness,
    ].map(Math.abs),
    ...spans,
  );
  const minimum = 64 * 32 * 2 ** -23 * scale;
  if (
    [
      ...spans,
      ridge[1] - back[1],
      ridge[1] - front[1],
      thickness,
      ridge[0] - wallZ[0],
      wallZ[1] - ridge[0],
    ].some((n) => n <= minimum)
  )
    fail(
      "positive spans, ridge rises, thickness and ridge-to-wall runs must exceed the Float32 precision minimum.",
    );
  if (
    wallX[0] < roofX[0] ||
    wallX[1] > roofX[1] ||
    wallZ[0] < back[0] ||
    wallZ[1] > front[0]
  )
    fail("wall supports must lie within the roof envelope.");
  const backY =
    back[1] +
    ((ridge[1] - back[1]) * (wallZ[0] - back[0])) / (ridge[0] - back[0]);
  const frontY =
    ridge[1] +
    ((front[1] - ridge[1]) * (wallZ[1] - ridge[0])) / (front[0] - ridge[0]);
  if (Math.min(backY, frontY) - thickness - baseY <= minimum)
    fail(
      "wall underside intersections must lie above baseY by the precision minimum.",
    );
}
