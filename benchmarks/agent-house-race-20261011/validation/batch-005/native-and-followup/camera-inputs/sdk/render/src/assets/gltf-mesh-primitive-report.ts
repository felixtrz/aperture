import type { MeshAsset } from "../mesh/index.js";
import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";
import type {
  GltfMeshAssetJsonSummary,
  GltfMeshPrimitiveMappingDiagnostic,
  GltfMeshPrimitiveMappingReport,
  GltfMeshPrimitiveMappingReportJsonValue,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive-types.js";

export function gltfMeshPrimitiveMappingReportToJsonValue(
  report: GltfMeshPrimitiveMappingReport,
): GltfMeshPrimitiveMappingReportJsonValue {
  return {
    valid: report.valid,
    root: report.root,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : meshAssetToJsonSummary(mesh.mesh),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfMeshPrimitiveMappingReportToJson(
  report: GltfMeshPrimitiveMappingReport,
): string {
  return JSON.stringify(gltfMeshPrimitiveMappingReportToJsonValue(report));
}

export function createGltfMeshPrimitiveMappingReportResult(input: {
  readonly root: GltfRootValidationReportJsonValue;
  readonly diagnostics: readonly GltfMeshPrimitiveMappingDiagnostic[];
  readonly meshes: readonly GltfPlannedMeshPrimitiveAsset[];
}): GltfMeshPrimitiveMappingReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    root: input.root,
    meshes: input.meshes,
    diagnostics: input.diagnostics,
  };
}

function meshAssetToJsonSummary(mesh: MeshAsset): GltfMeshAssetJsonSummary {
  return {
    kind: "mesh",
    label: mesh.label,
    vertexStreams: mesh.vertexStreams.length,
    submeshes: mesh.submeshes.length,
    materialSlots: mesh.materialSlots.length,
    ...(mesh.indexBuffer === undefined
      ? {}
      : {
          indexFormat: mesh.indexBuffer.format,
          indexCount: mesh.indexBuffer.data.length,
        }),
    hasLocalAabb: mesh.localAabb !== undefined,
    hasLocalSphere: mesh.localSphere !== undefined,
  };
}
