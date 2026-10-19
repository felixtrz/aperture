import { Camera, validateCameraInput } from "@aperture-engine/render";
import {
  LocalTransform,
  WorldTransform,
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
  type Entity,
  type Mat4,
} from "@aperture-engine/simulation";
import type {
  CameraLocalInspectionRequest,
  CameraLocalProjection,
  CameraLocalVec3,
} from "./types.js";
import { requireLocal } from "./validation.js";

export function worldMatrix(entity: Entity): Mat4 {
  requireLocal(
    entity.hasComponent(LocalTransform) && entity.hasComponent(WorldTransform),
    `Entity ${entity.index} requires LocalTransform and WorldTransform for fresh resolution.`,
  );
  const matrix = identityMat4();
  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  requireLocal(
    matrix.every(Number.isFinite),
    `Entity ${entity.index} has a non-finite resolved transform.`,
  );
  return matrix;
}
export function affine(
  matrix: ArrayLike<number>,
  point: CameraLocalVec3,
): CameraLocalVec3 {
  const result = [0, 1, 2].map(
    (r) =>
      matrix[r]! * point[0] +
      matrix[r + 4]! * point[1] +
      matrix[r + 8]! * point[2] +
      matrix[r + 12]!,
  ) as [number, number, number];
  requireLocal(
    result.every(Number.isFinite),
    "Transformed coordinates overflowed.",
  );
  return result;
}
export function subtract(
  a: CameraLocalVec3,
  b: CameraLocalVec3,
): CameraLocalVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function cross(a: CameraLocalVec3, b: CameraLocalVec3): CameraLocalVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function unit(v: CameraLocalVec3): CameraLocalVec3 | null {
  const length = Math.hypot(...v);
  return length > 0 && Number.isFinite(length)
    ? [v[0] / length, v[1] / length, v[2] / length]
    : null;
}
export function cameraProjection(
  camera: Entity,
  viewport: CameraLocalInspectionRequest["viewport"],
) {
  requireLocal(camera.hasComponent(Camera), "Selected entity is not a camera.");
  for (const field of ["viewport", "scissor"] as const) {
    requireLocal(
      camera
        .getVectorView(Camera, field)
        .every((n, i) => n === [0, 0, 1, 1][i]),
      "Only full viewport and scissor cameras are supported; use an independent inspection camera.",
    );
  }
  requireLocal(
    (camera.getValue(Camera, "renderTargetId") ?? "") === "" &&
      camera.getValue(Camera, "temporalJitterX") === 0 &&
      camera.getValue(Camera, "temporalJitterY") === 0,
    "Render-target and temporally jittered cameras are unsupported.",
  );
  const projection = camera.getValue(Camera, "projection");
  requireLocal(
    projection === "perspective" || projection === "orthographic",
    "Unsupported camera projection.",
  );
  const autoAspect = camera.getValue(Camera, "autoAspect") !== false;
  const aspect = autoAspect
    ? Math.fround(viewport.width / viewport.height)
    : camera.getValue(Camera, "aspect")!;
  const near = camera.getValue(Camera, "near")!;
  const far = camera.getValue(Camera, "far")!;
  const fovYRadians = camera.getValue(Camera, "fovYRadians")!;
  const orthographicHeight = camera.getValue(Camera, "orthographicHeight")!;
  const validation = validateCameraInput({
    projection,
    near,
    far,
    aspect,
    fovYRadians,
    orthographicHeight,
  });
  requireLocal(
    validation.valid,
    `Invalid camera projection: ${validation.diagnostics.map((d) => d.message).join(" ")}`,
  );
  const world = worldMatrix(camera);
  const view = invertMat4(world);
  requireLocal(
    view !== null && view.every(Number.isFinite),
    "Camera world transform must be finite and invertible.",
  );
  const projectionMatrix =
    projection === "perspective"
      ? makePerspective(fovYRadians, aspect, near, far)
      : makeOrthographic(
          (-aspect * orthographicHeight) / 2,
          (aspect * orthographicHeight) / 2,
          -orthographicHeight / 2,
          orthographicHeight / 2,
          near,
          far,
        );
  const viewProjection = multiplyMat4(projectionMatrix, view);
  requireLocal(
    viewProjection.every(Number.isFinite) &&
      invertMat4(viewProjection) !== null,
    "Camera projection is not representable by the engine matrices.",
  );
  return {
    projection: projection as "perspective" | "orthographic",
    aspect,
    autoAspect,
    near,
    far,
    fovYRadians,
    orthographicHeight,
    world,
    view,
    projectionMatrix,
    viewProjection,
    viewport,
  };
}
export type LocalCamera = ReturnType<typeof cameraProjection>;
export function project(
  camera: LocalCamera,
  world: CameraLocalVec3,
): CameraLocalProjection {
  const m = camera.viewProjection;
  const clip = [0, 1, 2, 3].map(
    (r) =>
      m[r]! * world[0] +
      m[r + 4]! * world[1] +
      m[r + 8]! * world[2] +
      m[r + 12]!,
  );
  const clipW = clip[3]!;
  const cameraDepth = -affine(camera.view, world)[2];
  requireLocal(
    clip.every(Number.isFinite) && Number.isFinite(cameraDepth),
    "Projection overflowed.",
  );
  const ndc =
    clipW !== 0
      ? ([clip[0]! / clipW, clip[1]! / clipW, clip[2]! / clipW] as const)
      : null;
  const pixel =
    ndc === null
      ? null
      : ([
          ((ndc[0] + 1) * camera.viewport.width) / 2,
          ((1 - ndc[1]) * camera.viewport.height) / 2,
        ] as const);
  const valid =
    ndc !== null &&
    ndc.every(Number.isFinite) &&
    pixel !== null &&
    pixel.every(Number.isFinite);
  const inFront = cameraDepth > 0;
  const inDepthRange = valid && clipW > 0 && ndc[2] >= 0 && ndc[2] <= 1;
  const inViewport = valid && Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1;
  return {
    world,
    clipW,
    cameraDepth,
    ndc: valid ? ndc : null,
    pixel: valid ? pixel : null,
    inFront,
    inDepthRange,
    inViewport,
    inFrustum: inFront && inDepthRange && inViewport,
  };
}
