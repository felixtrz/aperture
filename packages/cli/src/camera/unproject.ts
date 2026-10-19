import { quatLookAt } from "@aperture-engine/simulation";
import { ApertureCliError } from "../errors.js";
import { engineCameraMatrices } from "./engine-projection.js";
import { parseCameraLandmarkJob, type CameraLandmarkJob } from "./landmarks.js";

type Vec3 = readonly [number, number, number];
type Vec2 = readonly [number, number];

export interface CameraUnprojectJob {
  readonly viewport: CameraLandmarkJob["viewport"];
  readonly camera: CameraLandmarkJob["camera"];
  readonly plane: { readonly normal: Vec3; readonly constant: number };
  readonly pixels: readonly { readonly name: string; readonly pixel: Vec2 }[];
}

function invalid(message: string): never {
  throw new ApertureCliError("aperture.camera.invalidJob", message);
}
function object(value: unknown, label: string, keys: readonly string[]) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) invalid(`${label}.${key} is not supported.`);
  return value as Record<string, unknown>;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    invalid(`${label} must be finite.`);
  return value;
}

/** Preserve the existing camera contract; a plane supplies the otherwise unknown depth. */
export function parseCameraUnprojectJob(input: unknown): CameraUnprojectJob {
  const job = object(input, "job", ["viewport", "camera", "plane", "pixels"]);
  if (
    !Array.isArray(job["pixels"]) ||
    job["pixels"].length === 0 ||
    job["pixels"].length > 4096
  )
    invalid("pixels must contain 1–4096 named pixel pairs.");
  const landmarks = (job["pixels"] as unknown[]).map((value) => {
    const point = object(value, "pixel", ["name", "pixel"]);
    return { name: point["name"], world: [0, 0, 0], target: point["pixel"] };
  });
  // Reuse strict viewport, camera, name and coordinate validation without
  // exposing fit/world-point fields in the inverse command's JSON contract.
  parseCameraLandmarkJob({
    viewport: job["viewport"],
    camera: job["camera"],
    landmarks,
  });
  for (const point of landmarks)
    if (point.target === undefined)
      invalid("Each pixel needs a pixel: [x,y] pair.");
  const plane = object(job["plane"], "plane", ["normal", "constant"]);
  const normal = plane["normal"];
  if (!Array.isArray(normal) || normal.length !== 3)
    invalid("plane.normal must contain three finite numbers.");
  normal.forEach((value, i) => finite(value, `plane.normal[${i}]`));
  if (normal.every((value) => value === 0))
    invalid("plane.normal must be nonzero.");
  finite(plane["constant"], "plane.constant");
  const typed = input as CameraUnprojectJob;
  normalizedPlane(typed.plane);
  return typed;
}

function normalizedPlane(plane: CameraUnprojectJob["plane"]) {
  // Dividing by the largest coefficient first preserves subnormal normals
  // and avoids overflow/underflow in length squared. The sign is preserved.
  const scale = Math.max(...plane.normal.map(Math.abs));
  const scaled = plane.normal.map((v) => v / scale) as unknown as Vec3;
  const length = Math.hypot(...scaled);
  const normal = scaled.map((v) => v / length) as unknown as Vec3;
  const quotient = plane.constant / scale;
  const constant = Number.isFinite(quotient)
    ? quotient / length
    : plane.constant / length / scale;
  if (!Number.isFinite(constant))
    invalid(
      "Normalized plane.constant is outside the finite numeric range; rescale the scene.",
    );
  return { normal, constant };
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalized(v: Vec3): Vec3 | null {
  const scale = Math.max(...v.map(Math.abs));
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const scaled = v.map((n) => n / scale);
  const length = Math.hypot(...scaled);
  return scaled.map((n) => n / length) as unknown as Vec3;
}

interface PointReport {
  name: string;
  pixel: Vec2;
  accepted: boolean;
  failure: string | null;
  ray: { origin: Vec3; direction: Vec3 } | null;
  incidenceCosine: number | null;
  distance: number | null;
  world: Vec3 | null;
  planeResidualWorldUnits: number | null;
  planeToleranceWorldUnits: number | null;
  reprojectedPixel: Vec2 | null;
  residual: Vec2 | null;
  residualDistance: number | null;
  depth: number | null;
  ndc: Vec3 | null;
  inFront: boolean;
  depthInRange: boolean;
  clipDepthInRange: boolean;
  clipXYInRange: boolean;
  insideViewport: boolean;
  inFrustum: boolean;
}

/** CPU ray/plane intersection with independently checked Float32 engine reprojection. */
export function unprojectCameraPixels(input: unknown) {
  const job = parseCameraUnprojectJob(input);
  const plane = normalizedPlane(job.plane);
  const rotation = Array.from(
    quatLookAt(job.camera.translation, job.camera.lookAt),
  ) as [number, number, number, number];
  const camera = engineCameraMatrices(
    job,
    { translation: job.camera.translation, rotation },
    job.camera,
  );
  const reprojectionTolerancePixels = 0.05;
  const minimumIncidenceCosine = 1e-8;
  let cameraFailure = camera.reason ?? null;
  const { view, projection, matrix } = camera;
  let inverseRows: readonly Vec3[] | null = null;
  if (view !== undefined && projection !== undefined && matrix !== undefined) {
    if (
      ![...view, ...projection, ...matrix].every(Number.isFinite) ||
      projection[0] === 0 ||
      projection[5] === 0
    ) {
      cameraFailure = "Float32 camera matrices are nonfinite or degenerate.";
    } else {
      // Invert only the affine view's 3x3 in doubles. Inverting a Float32
      // view-projection matrix at z=1 loses far endpoints for long clip ranges.
      const a: Vec3 = [view[0]!, view[4]!, view[8]!];
      const b: Vec3 = [view[1]!, view[5]!, view[9]!];
      const c: Vec3 = [view[2]!, view[6]!, view[10]!];
      const columns = [cross(b, c), cross(c, a), cross(a, b)];
      const determinant = dot(a, columns[0]!);
      if (Math.abs(determinant) <= 1e-12)
        cameraFailure = "Float32 camera view is singular or ill-conditioned.";
      else
        inverseRows = [0, 1, 2].map(
          (i) => columns.map((v) => v[i]! / determinant) as unknown as Vec3,
        );
    }
  }
  const points = job.pixels.map(({ name, pixel }): PointReport => {
    const point: PointReport = {
      name,
      pixel,
      accepted: false,
      failure: null,
      ray: null,
      incidenceCosine: null,
      distance: null,
      world: null,
      planeResidualWorldUnits: null,
      planeToleranceWorldUnits: null,
      reprojectedPixel: null,
      residual: null,
      residualDistance: null,
      depth: null,
      ndc: null,
      inFront: false,
      depthInRange: false,
      clipDepthInRange: false,
      clipXYInRange: false,
      insideViewport:
        pixel[0] >= 0 &&
        pixel[0] <= job.viewport.width &&
        pixel[1] >= 0 &&
        pixel[1] <= job.viewport.height,
      inFrustum: false,
    };
    const failure = (reason: string) => {
      point.failure = reason;
      return point;
    };
    if (
      cameraFailure !== null ||
      inverseRows === null ||
      view === undefined ||
      projection === undefined ||
      matrix === undefined
    )
      return failure("invalid-engine-camera");
    const transform = (v: Vec3): Vec3 =>
      inverseRows!.map((row) => dot(row, v)) as unknown as Vec3;
    const x = ((2 * pixel[0]) / job.viewport.width - 1) / projection[0]!;
    const y = (1 - (2 * pixel[1]) / job.viewport.height) / projection[5]!;
    const perspective = job.camera.projection === "perspective";
    const origin = transform([
      (perspective ? 0 : x) - view[12]!,
      (perspective ? 0 : y) - view[13]!,
      -view[14]!,
    ]);
    const direction = normalized(
      transform(perspective ? [x, y, -1] : [0, 0, -1]),
    );
    if (!origin.every(Number.isFinite) || direction === null)
      return failure("nonfinite-ray");
    point.ray = { origin, direction };
    const incidence = dot(plane.normal, direction);
    point.incidenceCosine = incidence;
    if (incidence === 0) return failure("parallel");
    if (Math.abs(incidence) <= minimumIncidenceCosine)
      return failure("ill-conditioned");
    const distance = -(dot(plane.normal, origin) + plane.constant) / incidence;
    if (!Number.isFinite(distance)) return failure("nonfinite-intersection");
    point.distance = distance;
    const world = origin.map(
      (v, i) => v + distance * direction[i]!,
    ) as unknown as Vec3;
    if (!world.every(Number.isFinite)) return failure("nonfinite-intersection");
    point.world = world;
    point.planeResidualWorldUnits = dot(plane.normal, world) + plane.constant;
    point.planeToleranceWorldUnits =
      64 *
      Number.EPSILON *
      Math.max(1, Math.abs(plane.constant), ...world.map(Math.abs));
    const depth = -(
      view[2]! * world[0] +
      view[6]! * world[1] +
      view[10]! * world[2] +
      view[14]!
    );
    if (
      !Number.isFinite(depth) ||
      !Number.isFinite(point.planeResidualWorldUnits)
    ) {
      point.planeResidualWorldUnits = Number.isFinite(
        point.planeResidualWorldUnits,
      )
        ? point.planeResidualWorldUnits
        : null;
      return failure("nonfinite-intersection");
    }
    point.depth = depth;
    point.inFront = distance > 0 && depth > 0;
    point.depthInRange = depth >= camera.near! && depth <= camera.far!;
    const clip = [0, 1, 2, 3].map(
      (row) =>
        matrix[row]! * world[0] +
        matrix[row + 4]! * world[1] +
        matrix[row + 8]! * world[2] +
        matrix[row + 12]!,
    );
    const ndc = clip.slice(0, 3).map((v) => v / clip[3]!) as unknown as Vec3;
    if (
      clip.every(Number.isFinite) &&
      clip[3] !== 0 &&
      ndc.every(Number.isFinite)
    ) {
      point.ndc = ndc;
      point.clipDepthInRange = ndc[2] >= 0 && ndc[2] <= 1;
      point.clipXYInRange = Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1;
      point.reprojectedPixel = [
        ((ndc[0] + 1) * job.viewport.width) / 2,
        ((1 - ndc[1]) * job.viewport.height) / 2,
      ];
      const residual: Vec2 = [
        point.reprojectedPixel[0] - pixel[0],
        point.reprojectedPixel[1] - pixel[1],
      ];
      const error = Math.hypot(...residual);
      if (!Number.isFinite(error)) {
        point.reprojectedPixel = null;
        return failure("nonfinite-reprojection");
      }
      point.residual = residual;
      point.residualDistance = error;
    }
    point.inFrustum =
      point.inFront &&
      point.depthInRange &&
      point.clipDepthInRange &&
      point.clipXYInRange;
    if (!point.inFront) return failure("behind-camera");
    if (!point.depthInRange || !point.clipDepthInRange)
      return failure("outside-clip-range");
    if (
      point.residualDistance === null ||
      point.residualDistance > reprojectionTolerancePixels
    )
      return failure("reprojection-error");
    if (
      Math.abs(point.planeResidualWorldUnits) > point.planeToleranceWorldUnits
    )
      return failure("plane-residual");
    point.accepted = true;
    return point;
  });
  return {
    schemaVersion: 1,
    command: "unproject",
    input: job,
    accepted: points.every((point) => point.accepted),
    assumptions: {
      pixelOrigin: "top-left",
      pixelCoordinates: "continuous; no half-pixel offset",
      worldUp: [0, 1, 0],
      rollDegrees: 0,
      units: "caller world units",
      planeEquation: "dot(normal, world) + constant = 0",
      rayOrigin:
        job.camera.projection === "perspective"
          ? "eye of the Float32 engine view matrix"
          : "pixel on the Float32 engine view's camera-depth-zero plane",
      rayDirection: "unit world vector; forward is camera local -Z",
      distance:
        "signed world units from ray origin; world = origin + distance * direction",
      offscreen:
        "allowed extrapolation; acceptance still requires positive depth inside near/far and clip depth [0,1]",
      matrices:
        "Float32 engine view/projection and combined projection; inverse view and intersections in double precision",
    },
    plane,
    reprojectionTolerancePixels,
    minimumIncidenceCosine,
    cameraFailure,
    spawnCamera: {
      transform: {
        translation: job.camera.translation,
        lookAt: job.camera.lookAt,
        rotation,
      },
      camera: {
        aspect: job.viewport.width / job.viewport.height,
        autoAspect: false,
        near: job.camera.near,
        far: job.camera.far,
        ...(job.camera.projection === "perspective"
          ? {
              projection: "perspective" as const,
              fovYRadians: (job.camera.fovYDegrees * Math.PI) / 180,
            }
          : {
              projection: "orthographic" as const,
              orthographicHeight: job.camera.orthographicHeight,
            }),
      },
    },
    points,
  };
}
