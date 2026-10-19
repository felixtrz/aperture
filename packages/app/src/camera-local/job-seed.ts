import {
  Parent,
  composeTrsMatrix,
  invertMat4,
  multiplyMat4,
  quatLookAt,
  type Entity,
} from "@aperture-engine/simulation";
import type {
  CameraLocalDiagnostic,
  CameraLocalInspectionReport,
  CameraLocalInspectionRequest,
  CameraLocalJobSeed,
  CameraLocalVec3,
} from "./types.js";
import { project, unit, type LocalCamera } from "./projection.js";
import { jobProjection } from "./job-projection.js";
import { finite } from "./validation.js";

export function exportJobSeed(
  entity: Entity,
  camera: LocalCamera,
  request: CameraLocalInspectionRequest,
  subjects: CameraLocalInspectionReport["subjects"],
  cameraDependent: boolean,
): {
  cameraJob: CameraLocalJobSeed | null;
  cameraJobDiagnostics: readonly CameraLocalDiagnostic[];
} {
  if (request.cameraJob === undefined)
    return { cameraJob: null, cameraJobDiagnostics: [] };
  const diagnostics: CameraLocalDiagnostic[] = [];
  const reject = (reason: string, data?: Readonly<Record<string, unknown>>) =>
    diagnostics.push({
      code: "aperture.camera.local.unsupportedJobExport",
      severity: "warning",
      message: reason,
      ...(data === undefined ? {} : { data }),
    });
  const unsupported = () => ({
    cameraJob: null,
    cameraJobDiagnostics: diagnostics,
  });
  if (entity.hasComponent(Parent) && entity.getValue(Parent, "entity") !== null)
    reject(
      "The existing fit job requires an unparented camera. Inspection supports the resolved parented pose.",
    );
  if (cameraDependent)
    reject(
      "A landmark is descended from the selected camera; fitting assumes fixed world landmarks.",
    );
  if (
    Math.fround(request.viewport.width / request.viewport.height) !==
    Math.fround(camera.aspect)
  )
    reject(
      "The existing fit job requires camera aspect to match viewport width/height.",
    );
  const translation: CameraLocalVec3 = [
    camera.world[12]!,
    camera.world[13]!,
    camera.world[14]!,
  ];
  const backward = unit([
    camera.world[8]!,
    camera.world[9]!,
    camera.world[10]!,
  ])!;
  const distance = request.cameraJob.referenceDistance;
  const lookAt: CameraLocalVec3 = [
    translation[0] - backward[0] * distance,
    translation[1] - backward[1] * distance,
    translation[2] - backward[2] * distance,
  ];
  const actualDistance = Math.hypot(
    ...translation.map((v, i) => v - lookAt[i]!),
  );
  if (
    ![
      ...translation,
      ...lookAt,
      camera.near,
      camera.far,
      ...(camera.projection === "orthographic"
        ? [camera.orthographicHeight]
        : []),
    ].every(finite) ||
    actualDistance <= 1e-6 ||
    actualDistance > 1e12
  )
    reject(
      "Camera coordinates or reference distance cannot be represented in the existing camera job domain.",
    );
  if (Math.abs(backward[1]) > Math.sin((89.9 * Math.PI) / 180))
    reject("The existing fit orbit excludes elevations outside ±89.9 degrees.");
  const landmarks = subjects.flatMap((subject) =>
    subject.points.map((point) => ({
      name: JSON.stringify([subject.name, point.name]),
      world: [...point.world] as CameraLocalVec3,
      ...(point.target === undefined
        ? {}
        : { target: [...point.target] as [number, number] }),
      ...(point.weight === undefined ? {} : { weight: point.weight }),
    })),
  );
  if (landmarks.length === 0)
    reject(
      "Export requires at least one explicit local point; faces and source-box corners are not invented fit landmarks.",
    );
  if (landmarks.some((point) => !point.world.every(finite)))
    reject(
      "A resolved landmark exceeds the existing job coordinate domain of ±1e12.",
    );
  const fovYDegrees = (camera.fovYRadians * 180) / Math.PI;
  if (
    camera.projection === "perspective" &&
    (fovYDegrees < 0.1 || fovYDegrees > 179)
  )
    reject(
      "The existing fit job requires perspective FOV in [0.1, 179] degrees.",
    );
  if (diagnostics.length > 0) return unsupported();
  const seed: CameraLocalJobSeed = {
    viewport: { ...request.viewport },
    camera: {
      translation,
      lookAt,
      near: camera.near,
      far: camera.far,
      ...(camera.projection === "perspective"
        ? { projection: "perspective", fovYDegrees }
        : {
            projection: "orthographic",
            orthographicHeight: camera.orthographicHeight,
          }),
    },
    landmarks,
  };
  const analytic = jobProjection(seed);
  const reconstructed = composeTrsMatrix(
    analytic.translation,
    quatLookAt(analytic.translation, lookAt),
    [1, 1, 1],
  );
  if (
    Array.from(camera.world).some(
      (v, i) => i < 12 && Math.abs(v - reconstructed[i]!) > 1e-6,
    )
  )
    reject(
      "The existing fit job supports unit scale and zero roll with world Y up. This resolved camera has an incompatible rotation, scale, reflection, or shear.",
    );
  const reconstructedView = invertMat4(reconstructed);
  if (reconstructedView === null || !reconstructedView.every(Number.isFinite))
    reject("The exported camera transform is not finite and invertible.");
  if (diagnostics.length > 0 || reconstructedView === null)
    return unsupported();
  const exported = {
    ...camera,
    view: reconstructedView,
    viewProjection: multiplyMat4(camera.projectionMatrix, reconstructedView),
  };
  if (!exported.viewProjection.every(Number.isFinite)) {
    reject("The exported view-projection matrix is not finite.");
    return unsupported();
  }
  // Check BOTH the actual emitted engine camera and the analytic fitting model.
  // Float32 matrix cancellation can make identical engine matrices disagree with
  // an analytic camera by hundreds of pixels at large world coordinates.
  let maxEngineDelta = 0;
  let maxAnalyticDelta = 0;
  let undefinedProjection = false;
  for (let index = 0; index < landmarks.length; index++) {
    const point = landmarks[index]!;
    const before = project(camera, point.world).pixel;
    const after = project(exported, point.world).pixel;
    const model = analytic.pixels[index]!;
    if (before === null || after === null || model === null) {
      undefinedProjection = true;
      continue;
    }
    maxEngineDelta = Math.max(
      maxEngineDelta,
      Math.hypot(before[0] - after[0], before[1] - after[1]),
    );
    maxAnalyticDelta = Math.max(
      maxAnalyticDelta,
      Math.hypot(before[0] - model[0], before[1] - model[1]),
    );
  }
  if (undefinedProjection || maxEngineDelta > 0.05 || maxAnalyticDelta > 0.05)
    reject(
      "The existing camera job cannot reproduce all explicit landmark projections within 0.05 pixels, or a projection is undefined. Keep inspection evidence; use a numerically representable camera/coordinate range before exporting.",
      {
        tolerancePixels: 0.05,
        maxEngineDeltaPixels: Number.isFinite(maxEngineDelta)
          ? maxEngineDelta
          : null,
        maxAnalyticDeltaPixels: Number.isFinite(maxAnalyticDelta)
          ? maxAnalyticDelta
          : null,
        undefinedProjection,
      },
    );
  return diagnostics.length > 0
    ? unsupported()
    : { cameraJob: seed, cameraJobDiagnostics: [] };
}
