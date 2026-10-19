import {
  composeTrsMatrix,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/simulation";
import type { CameraLandmarkJob } from "./landmarks.js";

/** Check emitted unparented spawn-camera data through the actual Float32 engine matrix path. */
export function engineProjectionCheck(
  job: CameraLandmarkJob,
  pose: {
    translation: readonly [number, number, number];
    lookAt: readonly [number, number, number];
    rotation: readonly [number, number, number, number];
  },
  values: { fovYDegrees?: number; orthographicHeight?: number },
  points: readonly {
    name: string;
    world: readonly [number, number, number];
    pixel: readonly [number, number] | null;
    target: readonly [number, number] | null;
  }[],
) {
  const tolerancePixels = 0.05;
  const near = Math.fround(job.camera.near),
    far = Math.fround(job.camera.far);
  const aspect = Math.fround(job.viewport.width / job.viewport.height);
  if (!(near > 0 && far > near))
    return {
      withinTolerance: false,
      tolerancePixels,
      maxPixelDelta: null,
      maxTargetPointErrorPixels: null,
      reason: "Near/far planes collapse in Float32.",
      landmarks: [],
    };
  const translation = pose.translation.map(Math.fround) as [
    number,
    number,
    number,
  ];
  const world = composeTrsMatrix(translation, pose.rotation, [1, 1, 1]);
  const view = invertMat4(world);
  if (view === null)
    return {
      withinTolerance: false,
      tolerancePixels,
      maxPixelDelta: null,
      maxTargetPointErrorPixels: null,
      reason: "Float32 camera matrix is singular.",
      landmarks: [],
    };
  const height = Math.fround(values.orthographicHeight ?? 1);
  if (height <= 0)
    return {
      withinTolerance: false,
      tolerancePixels,
      maxPixelDelta: null,
      maxTargetPointErrorPixels: null,
      reason: "Orthographic height collapses in Float32.",
      landmarks: [],
    };
  const projection =
    job.camera.projection === "perspective"
      ? makePerspective(
          Math.fround((values.fovYDegrees! * Math.PI) / 180),
          aspect,
          near,
          far,
        )
      : makeOrthographic(
          (-height * aspect) / 2,
          (height * aspect) / 2,
          -height / 2,
          height / 2,
          near,
          far,
        );
  const matrix = multiplyMat4(projection, view);
  const landmarks = points.map((point) => {
    const clip = [0, 1, 2, 3].map(
      (row) =>
        matrix[row]! * point.world[0] +
        matrix[row + 4]! * point.world[1] +
        matrix[row + 8]! * point.world[2] +
        matrix[row + 12]!,
    );
    const x = ((clip[0]! / clip[3]! + 1) * job.viewport.width) / 2;
    const y = ((1 - clip[1]! / clip[3]!) * job.viewport.height) / 2;
    const pixel = Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    const deltaPixels =
      pixel !== null && point.pixel !== null
        ? Math.hypot(x - point.pixel[0], y - point.pixel[1])
        : null;
    const residual =
      pixel !== null && point.target !== null
        ? [x - point.target[0], y - point.target[1]]
        : null;
    return {
      name: point.name,
      pixel,
      deltaPixels,
      residual,
      residualDistance: residual === null ? null : Math.hypot(...residual),
    };
  });
  const deltas = landmarks.flatMap((point) =>
    point.deltaPixels === null ? [] : [point.deltaPixels],
  );
  const maxPixelDelta = deltas.length > 0 ? Math.max(...deltas) : null;
  const targets = landmarks.filter((_, i) => points[i]!.target !== null);
  const maxTargetPointErrorPixels =
    targets.length === 0 ||
    targets.some((point) => point.residualDistance === null)
      ? null
      : Math.max(...targets.map((point) => point.residualDistance!));
  return {
    withinTolerance: landmarks.every(
      (point, i) =>
        points[i]!.pixel === null ||
        (point.deltaPixels !== null && point.deltaPixels <= tolerancePixels),
    ),
    tolerancePixels,
    maxPixelDelta,
    maxTargetPointErrorPixels,
    reason:
      "Compares unparented Float32 engine camera matrices against double-precision landmark projection; world points stay fixed.",
    landmarks,
  };
}
