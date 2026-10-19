import { ApertureCliError } from "../errors.js";
import { quatLookAt } from "@aperture-engine/simulation";
import { engineProjectionCheck } from "./engine-projection.js";

type Vec3 = readonly [number, number, number];
type Vec2 = readonly [number, number];
type Parameter =
  | "azimuthDegrees"
  | "elevationDegrees"
  | "distance"
  | "panX"
  | "panY"
  | "fovYDegrees"
  | "orthographicHeight";
type Constraint = "fixed" | { readonly min: number; readonly max: number };
type Parameters = Partial<Record<Parameter, number>>;

export interface CameraLandmarkJob {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly camera: {
    readonly translation: Vec3;
    readonly lookAt: Vec3;
    readonly near: number;
    readonly far: number;
  } & (
    | { readonly projection: "perspective"; readonly fovYDegrees: number }
    | {
        readonly projection: "orthographic";
        readonly orthographicHeight: number;
      }
  );
  readonly landmarks: readonly {
    readonly name: string;
    readonly world: Vec3;
    readonly target?: Vec2;
    readonly weight?: number;
  }[];
  readonly fit?: {
    readonly parameters: Partial<Record<Parameter, Constraint>>;
    readonly maxIterations?: number;
    readonly tolerancePixels?: number;
  };
}

const radians = Math.PI / 180;
const commonParameters: Parameter[] = [
  "azimuthDegrees",
  "elevationDegrees",
  "distance",
  "panX",
  "panY",
];
const fail = (message: string): never => {
  throw new ApertureCliError("aperture.camera.invalidJob", message);
};

function object(
  value: unknown,
  label: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return fail(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) fail(`${label}.${key} is not supported.`);
  return value as Record<string, unknown>;
}
function finite(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1e12
  )
    return fail(`${label} must be finite and within ±1e12.`);
  return value;
}
function positive(value: unknown, label: string): number {
  const number = finite(value, label);
  if (number <= 0) fail(`${label} must be positive.`);
  return number;
}
function tuple(value: unknown, length: number, label: string): void {
  if (!Array.isArray(value) || value.length !== length)
    fail(`${label} must contain ${length} numbers.`);
  (value as unknown[]).forEach((number, index) =>
    finite(number, `${label}[${index}]`),
  );
}

/** Strict JSON boundary: misspelled or unsupported camera freedoms must not be silently ignored. */
export function parseCameraLandmarkJob(input: unknown): CameraLandmarkJob {
  const job = object(input, "job", ["viewport", "camera", "landmarks", "fit"]);
  const viewport = object(job["viewport"], "viewport", ["width", "height"]);
  for (const key of ["width", "height"]) {
    const value = positive(viewport[key], `viewport.${key}`);
    if (!Number.isInteger(value) || value > 1e6)
      fail(`viewport.${key} must be an integer no greater than 1000000.`);
  }
  const camera = object(job["camera"], "camera", [
    "projection",
    "translation",
    "lookAt",
    "near",
    "far",
    "fovYDegrees",
    "orthographicHeight",
  ]);
  tuple(camera["translation"], 3, "camera.translation");
  tuple(camera["lookAt"], 3, "camera.lookAt");
  if (
    positive(camera["near"], "camera.near") >=
    positive(camera["far"], "camera.far")
  )
    fail("camera.near must be less than camera.far.");
  if (camera["projection"] === "perspective") {
    const fov = positive(camera["fovYDegrees"], "camera.fovYDegrees");
    if (fov < 0.1 || fov > 179 || camera["orthographicHeight"] !== undefined)
      fail(
        "Perspective cameras require fovYDegrees in [0.1, 179] and no orthographicHeight.",
      );
  } else if (camera["projection"] === "orthographic") {
    positive(camera["orthographicHeight"], "camera.orthographicHeight");
    if (camera["fovYDegrees"] !== undefined)
      fail("Orthographic cameras do not use fovYDegrees.");
  } else
    fail("camera.projection must explicitly be perspective or orthographic.");
  if (
    !Array.isArray(job["landmarks"]) ||
    job["landmarks"].length === 0 ||
    job["landmarks"].length > 4096
  )
    fail("landmarks must contain 1–4096 named world points.");
  const names = new Set<string>();
  for (const value of job["landmarks"] as unknown[]) {
    const point = object(value, "landmark", [
      "name",
      "world",
      "target",
      "weight",
    ]);
    const name = point["name"];
    if (typeof name !== "string" || name.trim().length === 0 || names.has(name))
      fail("Each landmark needs a unique nonempty name.");
    names.add(name as string);
    tuple(point["world"], 3, `landmark ${name as string}.world`);
    if (point["target"] !== undefined)
      tuple(point["target"], 2, `landmark ${name as string}.target`);
    if (point["weight"] !== undefined) {
      positive(point["weight"], `landmark ${name as string}.weight`);
      if (point["target"] === undefined)
        fail("Weights require a target pixel pair.");
    }
  }
  const typed = input as CameraLandmarkJob;
  const initial = initialParameters(typed);
  if (job["fit"] !== undefined) {
    const fit = object(job["fit"], "fit", [
      "parameters",
      "maxIterations",
      "tolerancePixels",
    ]);
    const keys = parameterNames(typed);
    const constraints = object(fit["parameters"], "fit.parameters", keys);
    for (const key of keys) {
      const value = constraints[key];
      if (value === "fixed") continue;
      const bounds = object(value, `fit.parameters.${key}`, ["min", "max"]);
      const min = finite(bounds["min"], `${key}.min`);
      const max = finite(bounds["max"], `${key}.max`);
      if (min >= max || initial[key]! < min || initial[key]! > max)
        fail(
          `${key} requires min < max and an initial value within its bounds (${initial[key]}).`,
        );
      if (key === "elevationDegrees" && (min < -89.9 || max > 89.9))
        fail(
          "Elevation bounds must stay within [-89.9, 89.9] to avoid world-up poles.",
        );
      if (key === "azimuthDegrees" && max - min > 360)
        fail("Azimuth bounds may span at most 360 degrees.");
      if ((key === "distance" || key === "orthographicHeight") && min <= 1e-6)
        fail(`${key}.min must exceed 1e-6.`);
      if (key === "fovYDegrees" && (min < 0.1 || max > 179))
        fail("FOV bounds must stay within [0.1, 179].");
      if (key === "distance" && typed.camera.projection === "orthographic")
        fail(
          "Orthographic distance must be fixed: pixel landmarks cannot constrain it.",
        );
    }
    if (fit["maxIterations"] !== undefined) {
      const count = positive(fit["maxIterations"], "fit.maxIterations");
      if (!Number.isInteger(count) || count > 500)
        fail("fit.maxIterations must be an integer in [1, 500].");
    }
    if (fit["tolerancePixels"] !== undefined)
      positive(fit["tolerancePixels"], "fit.tolerancePixels");
  }
  return typed;
}

function parameterNames(job: CameraLandmarkJob): Parameter[] {
  return [
    ...commonParameters,
    job.camera.projection === "perspective"
      ? "fovYDegrees"
      : "orthographicHeight",
  ];
}
function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i]!, 0);
}
function initialParameters(job: CameraLandmarkJob): Parameters {
  const delta = subtract(job.camera.translation, job.camera.lookAt);
  const distance = Math.hypot(...delta);
  const elevationDegrees =
    Math.atan2(delta[1], Math.hypot(delta[0], delta[2])) / radians;
  if (distance <= 1e-6 || Math.abs(elevationDegrees) > 89.9)
    fail(
      "Camera translation and lookAt must be distinct and its direction must stay away from world-up poles (|elevation| ≤ 89.9°).",
    );
  return {
    azimuthDegrees: Math.atan2(delta[0], delta[2]) / radians,
    elevationDegrees,
    distance,
    panX: 0,
    panY: 0,
    ...(job.camera.projection === "perspective"
      ? { fovYDegrees: job.camera.fovYDegrees }
      : { orthographicHeight: job.camera.orthographicHeight }),
  };
}
function pose(job: CameraLandmarkJob, values: Parameters) {
  const az = values.azimuthDegrees! * radians,
    el = values.elevationDegrees! * radians;
  const back: Vec3 = [
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  ];
  const right: Vec3 = [Math.cos(az), 0, -Math.sin(az)];
  const up: Vec3 = [
    -Math.sin(az) * Math.sin(el),
    Math.cos(el),
    -Math.cos(az) * Math.sin(el),
  ];
  const lookAt = job.camera.lookAt.map(
    (v, i) => v + right[i]! * values.panX! + up[i]! * values.panY!,
  ) as unknown as Vec3;
  const translation = lookAt.map(
    (v, i) => v + back[i]! * values.distance!,
  ) as unknown as Vec3;
  return { back, right, up, lookAt, translation };
}

/** Double-precision equivalent of quatLookAt + WebGPU makePerspective/makeOrthographic. */
function project(job: CameraLandmarkJob, values: Parameters) {
  const { back, right, up, translation } = pose(job, values);
  const { width, height } = job.viewport;
  const { near, far } = job.camera;
  return job.landmarks.map((point) => {
    const delta = subtract(point.world, translation);
    const depth = -dot(delta, back);
    const perspective = job.camera.projection === "perspective";
    const scale = perspective
      ? height / (2 * Math.tan((values.fovYDegrees! * radians) / 2) * depth)
      : height / values.orthographicHeight!;
    const projected: Vec2 | null =
      perspective && Math.abs(depth) < 1e-10
        ? null
        : [
            width / 2 + dot(delta, right) * scale,
            height / 2 - dot(delta, up) * scale,
          ];
    const pixel =
      projected !== null && projected.every(Number.isFinite) ? projected : null;
    const ndcDepth = perspective
      ? depth === 0
        ? null
        : far / (far - near) - (far * near) / ((far - near) * depth)
      : (depth - near) / (far - near);
    const residual: Vec2 | null =
      pixel !== null && point.target !== undefined
        ? [pixel[0] - point.target[0], pixel[1] - point.target[1]]
        : null;
    const inFront = depth > 0;
    const depthInRange = depth >= near && depth <= far;
    const insideViewport =
      pixel !== null &&
      pixel[0] >= 0 &&
      pixel[0] <= width &&
      pixel[1] >= 0 &&
      pixel[1] <= height;
    return {
      name: point.name,
      world: point.world,
      target: point.target ?? null,
      weight: point.target === undefined ? null : (point.weight ?? 1),
      pixel,
      residual,
      residualDistance: residual === null ? null : Math.hypot(...residual),
      depth,
      ndcDepth:
        ndcDepth !== null && Number.isFinite(ndcDepth) ? ndcDepth : null,
      ndc:
        pixel === null || ndcDepth === null || !Number.isFinite(ndcDepth)
          ? null
          : [(2 * pixel[0]) / width - 1, 1 - (2 * pixel[1]) / height, ndcDepth],
      inFront,
      depthInRange,
      insideViewport,
      inFrustum: inFront && depthInRange && insideViewport,
    };
  });
}
function metrics(points: ReturnType<typeof project>) {
  const targets = points.filter((point) => point.target !== null);
  const measured = targets.filter((point) => point.residual !== null);
  if (measured.length === 0 || measured.length !== targets.length)
    return {
      targetCount: targets.length,
      evaluatedCount: measured.length,
      scalarCoordinateRmsPixels: null,
      pointRmsPixels: null,
      weightedScalarCoordinateRmsPixels: null,
      weightedPointRmsPixels: null,
      maxPointErrorPixels: null,
    };
  const sum = measured.reduce(
    (sum, point) => sum + dot(point.residual!, point.residual!),
    0,
  );
  const weighted = measured.reduce(
    (sum, point) => sum + point.weight! * dot(point.residual!, point.residual!),
    0,
  );
  const weights = measured.reduce((sum, point) => sum + point.weight!, 0);
  return {
    targetCount: targets.length,
    evaluatedCount: measured.length,
    scalarCoordinateRmsPixels: Math.sqrt(sum / (2 * measured.length)),
    pointRmsPixels: Math.sqrt(sum / measured.length),
    weightedScalarCoordinateRmsPixels: Math.sqrt(weighted / (2 * weights)),
    weightedPointRmsPixels: Math.sqrt(weighted / weights),
    maxPointErrorPixels: Math.max(
      ...measured.map((point) => point.residualDistance!),
    ),
  };
}
function report(job: CameraLandmarkJob, values: Parameters) {
  const cameraPose = pose(job, values);
  // Emit the checked Float32 quaternion explicitly so spawn does not recompute
  // it through its equivalent, but differently rounded, look-at helper.
  const rotation = Array.from(
    quatLookAt(cameraPose.translation, cameraPose.lookAt),
  ) as [number, number, number, number];
  const landmarks = project(job, values);
  const enginePrecision = engineProjectionCheck(
    job,
    { ...cameraPose, rotation },
    values,
    landmarks,
  );
  return {
    schemaVersion: 1,
    input: job,
    assumptions: {
      worldUp: [0, 1, 0],
      rollDegrees: 0,
      pixelOrigin: "top-left",
      principalPoint: [job.viewport.width / 2, job.viewport.height / 2],
      baseLookAt: job.camera.lookAt,
      geometry: "fixed",
      approximation:
        "local camera fit; residuals can reflect incorrect geometry or annotations",
    },
    parameters: values,
    spawnCamera: {
      transform: {
        translation: cameraPose.translation,
        lookAt: cameraPose.lookAt,
        rotation,
      },
      camera: {
        projection: job.camera.projection,
        aspect: job.viewport.width / job.viewport.height,
        autoAspect: false,
        near: job.camera.near,
        far: job.camera.far,
        ...(job.camera.projection === "perspective"
          ? { fovYRadians: values.fovYDegrees! * radians }
          : { orthographicHeight: values.orthographicHeight! }),
      },
    },
    landmarks,
    enginePrecision,
    metrics: metrics(landmarks),
  };
}

export function projectCameraLandmarks(input: unknown) {
  const job = parseCameraLandmarkJob(input);
  return { command: "project", ...report(job, initialParameters(job)) };
}

interface FreeParameter {
  readonly name: Parameter;
  readonly min: number;
  readonly max: number;
}

/** Small bounded, damped least-squares solve. All optimization coordinates use the explicit bound span. */
export function fitCameraLandmarks(input: unknown) {
  const job = parseCameraLandmarkJob(input);
  if (job.fit === undefined)
    fail(
      "camera fit requires fit.parameters with every parameter marked fixed or bounded.",
    );
  const settings = job.fit!;
  const initial = initialParameters(job);
  const free: FreeParameter[] = parameterNames(job).flatMap((name) => {
    const constraint = settings.parameters[name]!;
    return constraint === "fixed" ? [] : [{ name, ...constraint }];
  });
  const targetCount = job.landmarks.filter(
    (point) => point.target !== undefined,
  ).length;
  const meanWeight =
    job.landmarks.reduce(
      (sum, point) =>
        sum + (point.target === undefined ? 0 : (point.weight ?? 1)),
      0,
    ) / targetCount;
  if (free.length === 0 || 2 * targetCount < free.length)
    fail(
      "Fit requires at least one free parameter and at least as many target coordinates as free parameters; use project for an entirely fixed camera.",
    );
  const unpack = (u: number[]): Parameters => ({
    ...initial,
    ...Object.fromEntries(
      free.map((p, i) => [p.name, p.min + u[i]! * (p.max - p.min)]),
    ),
  });
  const residuals = (u: number[]): number[] | null => {
    const points = project(job, unpack(u)).filter(
      (point) => point.target !== null,
    );
    if (
      points.some(
        (point) =>
          point.pixel === null || !point.inFront || !point.depthInRange,
      )
    )
      return null;
    return points.flatMap((point) =>
      point.residual!.map((r) => r * Math.sqrt(point.weight! / meanWeight)),
    );
  };
  let u = free.map((p) => (initial[p.name]! - p.min) / (p.max - p.min));
  let residual = residuals(u);
  if (residual === null)
    fail(
      "All target landmarks must initially have positive depth inside camera near/far planes.",
    );
  let r = residual!;
  const initialMetrics = metrics(project(job, initial));
  let iterations = 0,
    damping = 1e-3;
  let termination = "iteration-limit";
  let converged = false;
  let conditioning = condition(jacobian(u, r, residuals));
  const initialConditioning = conditioning;
  if (!conditioning.wellConditioned)
    throw new ApertureCliError(
      "aperture.camera.illConditioned",
      `Initial landmark Jacobian has rank ${conditioning.rank}/${free.length}, condition ${conditioning.conditionNumber ?? "infinite"}. Fix more parameters or use landmarks with independent depth/height coverage.`,
    );
  for (; iterations < (settings.maxIterations ?? 100); iterations += 1) {
    const columns = jacobian(u, r, residuals);
    conditioning = condition(columns);
    if (!conditioning.wellConditioned) {
      termination = "ill-conditioned";
      break;
    }
    const gradient = columns.map((column) => dot(column, r));
    const optimality = projectedOptimality(u, columns, gradient, r);
    if (Math.hypot(...r) < 1e-7 || optimality < 1e-8) {
      termination = "first-order-optimality";
      converged = true;
      break;
    }
    const hessian = columns.map((a) => columns.map((b) => dot(a, b)));
    let improved = false;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const matrix = hessian.map((row, i) =>
        row.map(
          (v, j) =>
            v + (i === j ? damping * Math.max(hessian[i]![i]!, 1e-12) : 0),
        ),
      );
      const step = solve(
        matrix,
        gradient.map((v) => -v),
      );
      const candidate = u.map((v, i) => Math.max(0, Math.min(1, v + step[i]!)));
      residual = residuals(candidate);
      if (residual !== null && dot(residual, residual) < dot(r, r)) {
        u = candidate;
        r = residual;
        damping = Math.max(1e-12, damping / 3);
        improved = true;
        break;
      }
      damping *= 10;
    }
    if (!improved) {
      termination = "no-improving-step";
      break;
    }
  }
  const columns = jacobian(u, r, residuals);
  conditioning = condition(columns);
  const optimality = projectedOptimality(
    u,
    columns,
    columns.map((column) => dot(column, r)),
    r,
  );
  if (
    conditioning.wellConditioned &&
    (Math.hypot(...r) < 1e-7 || optimality < 1e-8)
  ) {
    converged = true;
    termination = "first-order-optimality";
  }
  if (!conditioning.wellConditioned) {
    converged = false;
    termination = "ill-conditioned";
  }
  const result = report(job, unpack(u));
  const tolerancePixels = settings.tolerancePixels ?? 1;
  const withinTolerance =
    result.metrics.maxPointErrorPixels! <= tolerancePixels;
  const engineWithinTolerance =
    result.enginePrecision.maxTargetPointErrorPixels !== null &&
    result.enginePrecision.maxTargetPointErrorPixels <= tolerancePixels;
  return {
    command: "fit",
    ...result,
    fit: {
      accepted:
        converged &&
        withinTolerance &&
        engineWithinTolerance &&
        result.enginePrecision.withinTolerance,
      converged,
      withinTolerance,
      engineWithinTolerance,
      tolerancePixels,
      toleranceMetric: "maximum unweighted Euclidean point residual in pixels",
      termination,
      iterations,
      maxIterations: settings.maxIterations ?? 100,
      freeParameterCount: free.length,
      residualCoordinateCount: targetCount * 2,
      degreesOfFreedom: targetCount * 2 - free.length,
      constraints: settings.parameters,
      boundHits: free
        .filter((_, i) => u[i]! <= 1e-7 || u[i]! >= 1 - 1e-7)
        .map((p, _i) => ({
          parameter: p.name,
          side:
            result.parameters[p.name]! - p.min <= 1e-7 * (p.max - p.min)
              ? "min"
              : "max",
        })),
      initialMetrics,
      initialConditioning,
      conditioning,
      projectedGradientOptimality: Number.isFinite(optimality)
        ? optimality
        : null,
      warnings: [
        "Local camera fit only: inspect signed landmark residuals before changing geometry.",
        ...(engineWithinTolerance
          ? []
          : [
              "Emitted Float32 camera target residual exceeds tolerancePixels.",
            ]),
        ...(result.enginePrecision.withinTolerance
          ? []
          : [
              "Float32 engine camera projection differs from the solver. Recenter/rescale the scene before applying this candidate.",
            ]),
        ...(withinTolerance
          ? []
          : [
              "Residual tolerance exceeded; camera freedom cannot establish that the proposed geometry matches the reference.",
            ]),
        ...(targetCount * 2 === free.length
          ? [
              "No residual degrees of freedom remain; add independent landmarks to assess model mismatch.",
            ]
          : []),
      ],
    },
  };
}

function jacobian(
  u: number[],
  r: number[],
  evaluate: (u: number[]) => number[] | null,
): number[][] {
  return u.map((value, index) => {
    const lo = [...u],
      hi = [...u];
    lo[index] = Math.max(0, value - 1e-5);
    hi[index] = Math.min(1, value + 1e-5);
    let a = evaluate(lo),
      b = evaluate(hi);
    if (a === null) {
      a = r;
      lo[index] = value;
    }
    if (b === null) {
      b = r;
      hi[index] = value;
    }
    const span = hi[index]! - lo[index]!;
    return r.map((_, row) => (span === 0 ? 0 : (b![row]! - a![row]!) / span));
  });
}
function projectedOptimality(
  u: number[],
  columns: number[][],
  gradient: number[],
  residual: number[],
): number {
  return Math.max(
    ...gradient.map((g, i) =>
      (u[i]! <= 1e-9 && g > 0) || (u[i]! >= 1 - 1e-9 && g < 0)
        ? 0
        : Math.abs(g) /
          (Math.hypot(...columns[i]!) * Math.max(1, Math.hypot(...residual))),
    ),
  );
}
function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let j = i + 1; j < n; j += 1)
      if (Math.abs(matrix[j]![i]!) > Math.abs(matrix[pivot]![i]!)) pivot = j;
    [matrix[i], matrix[pivot]] = [matrix[pivot]!, matrix[i]!];
    [rhs[i], rhs[pivot]] = [rhs[pivot]!, rhs[i]!];
    for (let j = i + 1; j < n; j += 1) {
      const factor = matrix[j]![i]! / matrix[i]![i]!;
      for (let k = i; k < n; k += 1)
        matrix[j]![k] = matrix[j]![k]! - factor * matrix[i]![k]!;
      rhs[j] = rhs[j]! - factor * rhs[i]!;
    }
  }
  const result = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1)
    result[i] =
      (rhs[i]! - dot(matrix[i]!.slice(i + 1), result.slice(i + 1))) /
      matrix[i]![i]!;
  return result;
}
function condition(columns: number[][]) {
  // Jacobi diagonalization of the tiny symmetric Gram matrix. The square-root
  // ratio is the Jacobian 2-norm condition estimate, not the squared normal condition.
  const gram = columns.map((a) => columns.map((b) => dot(a, b)));
  const n = columns.length;
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let p = 0,
      q = 0,
      largest = 0;
    for (let i = 0; i < n; i += 1)
      for (let j = i + 1; j < n; j += 1)
        if (Math.abs(gram[i]![j]!) > largest) {
          largest = Math.abs(gram[i]![j]!);
          p = i;
          q = j;
        }
    if (
      largest <=
      1e-15 * Math.max(1, ...gram.map((row, i) => Math.abs(row[i]!)))
    )
      break;
    const angle =
      0.5 * Math.atan2(2 * gram[p]![q]!, gram[q]![q]! - gram[p]![p]!);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const pp = gram[p]![p]!,
      qq = gram[q]![q]!,
      pq = gram[p]![q]!;
    for (let k = 0; k < n; k += 1)
      if (k !== p && k !== q) {
        const kp = gram[k]![p]!,
          kq = gram[k]![q]!;
        gram[k]![p] = gram[p]![k] = c * kp - s * kq;
        gram[k]![q] = gram[q]![k] = s * kp + c * kq;
      }
    gram[p]![p] = c * c * pp - 2 * c * s * pq + s * s * qq;
    gram[q]![q] = s * s * pp + 2 * c * s * pq + c * c * qq;
    gram[p]![q] = gram[q]![p] = 0;
  }
  const singularValues = gram
    .map((row, i) => Math.sqrt(Math.max(0, row[i]!)))
    .sort((a, b) => b - a);
  const maximum = singularValues[0]!,
    minimum = singularValues[n - 1]!;
  const rank = singularValues.filter(
    (value) => value > maximum * 1e-6 && value > 1e-10,
  ).length;
  return {
    rank,
    parameterCount: n,
    conditionNumber: minimum <= 0 ? null : maximum / minimum,
    singularValues,
    wellConditioned: rank === n,
    maximumConditionNumber: 1e6,
    scaling: "parameters normalized by explicit bound spans",
  };
}
