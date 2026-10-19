import {
  Mesh,
  MorphTargetWeights,
  Skin,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createMeshHandle,
  type AssetRegistry,
  type Entity,
} from "@aperture-engine/simulation";
import type {
  CameraLocalBoundsReport,
  CameraLocalDiagnostic,
  CameraLocalVec3,
} from "./types.js";
import {
  affine,
  project,
  worldMatrix,
  type LocalCamera,
} from "./projection.js";

export function inspectSourceBounds(
  assets: AssetRegistry | undefined,
  entities: readonly Entity[],
  includeDescendants: boolean,
  camera: LocalCamera,
): CameraLocalBoundsReport {
  const meshes: CameraLocalBoundsReport["meshes"][number][] = [];
  const diagnostics: CameraLocalDiagnostic[] = [];
  for (const entity of entities.filter((e) => e.hasComponent(Mesh))) {
    const meshId = entity.getValue(Mesh, "meshId") ?? "";
    const ref = { index: entity.index, generation: entity.generation };
    const entry =
      meshId.startsWith("mesh:") && meshId.length > 5
        ? assets?.get<"mesh", MeshAsset>(createMeshHandle(meshId.slice(5)))
        : undefined;
    const source = entry?.asset?.localAabb;
    if (
      entry?.status !== "ready" ||
      source === undefined ||
      source === null ||
      source.min === undefined ||
      source.max === undefined ||
      source.min === null ||
      source.max === null ||
      ![0, 1, 2].every(
        (i) =>
          Number.isFinite(source.min[i]) &&
          Number.isFinite(source.max[i]) &&
          source.min[i]! <= source.max[i]!,
      )
    ) {
      diagnostics.push({
        code: "aperture.camera.local.boundsUnavailable",
        severity: "error",
        message:
          "Mesh source bounds are missing, invalid, or not ready. No partial aggregate is reported.",
        data: { entity: ref, meshId },
      });
      continue;
    }
    if (
      entity.hasComponent(Skin) ||
      entity.hasComponent(MorphTargetWeights) ||
      entry.asset?.skinning !== undefined ||
      (entry.asset?.morphTargets?.length ?? 0) > 0 ||
      entry.asset?.morphTargetData !== undefined
    ) {
      diagnostics.push({
        code: "aperture.camera.local.renderedDeformationUnsupported",
        severity: "warning",
        message:
          "These are undeformed source bounds; skinning and morph deformation are not evaluated.",
        data: { entity: ref, meshId },
      });
    }
    const matrix = worldMatrix(entity);
    const corners = Array.from({ length: 8 }, (_, bits) =>
      project(
        camera,
        affine(
          matrix,
          [0, 1, 2].map((axis) =>
            (bits & (1 << axis)) === 0 ? source.min[axis]! : source.max[axis]!,
          ) as unknown as CameraLocalVec3,
        ),
      ),
    );
    meshes.push({ entity: ref, meshId, corners });
  }
  const status = diagnostics.some((d) => d.severity === "error")
    ? "incomplete"
    : meshes.length === 0
      ? "empty"
      : "complete";
  const corners = meshes.flatMap((m) => m.corners);
  const safe =
    corners.length > 0 &&
    corners.every(
      (p) =>
        p.pixel !== null &&
        p.clipW > 0 &&
        p.cameraDepth >= camera.near &&
        p.ndc !== null &&
        p.ndc[2] >= 0,
    );
  if (corners.length > 0 && !safe)
    diagnostics.push({
      code: "aperture.camera.local.boundsCrossNearPlane",
      severity: "warning",
      message:
        "Source bounds cross or precede the near/eye plane. Corner projections are evidence only; no screen envelope is reported.",
    });
  if (status === "empty")
    diagnostics.push({
      code: "aperture.camera.local.emptyBounds",
      severity: "warning",
      message:
        "No Mesh components were selected. Non-mesh rendered objects have no supported source bounds.",
    });
  const screenBounds =
    status === "complete" && safe
      ? {
          min: [
            Math.min(...corners.map((p) => p.pixel![0])),
            Math.min(...corners.map((p) => p.pixel![1])),
          ] as const,
          max: [
            Math.max(...corners.map((p) => p.pixel![0])),
            Math.max(...corners.map((p) => p.pixel![1])),
          ] as const,
        }
      : null;
  return {
    source: "mesh-local-aabb",
    includeDescendants,
    status,
    meshes,
    screenBounds,
    diagnostics,
  };
}
