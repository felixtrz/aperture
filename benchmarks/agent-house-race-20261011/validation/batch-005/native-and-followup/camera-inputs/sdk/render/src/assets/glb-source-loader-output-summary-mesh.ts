import type { GltfReportDrivenImportReport } from "./gltf-report-driven-import.js";
import type { GlbSourceLoaderMeshConstructionSummaryJsonValue } from "./glb-source-loader-output-summary-types.js";

export function createGlbSourceLoaderMeshConstructionSummaryJsonValue(
  importReport: GltfReportDrivenImportReport | null,
): GlbSourceLoaderMeshConstructionSummaryJsonValue {
  const meshConstruction = importReport?.meshConstruction ?? null;

  if (meshConstruction === null) {
    return {
      status: "absent",
      valid: null,
      meshCount: 0,
      submeshCount: 0,
      vertexCount: 0,
      indexCount: 0,
      diagnosticsCount: 0,
    };
  }

  const dependencyDiagnosticsCount =
    (importReport?.accessorValidation?.diagnostics.length ?? 0) +
    (importReport?.accessorDecoding?.diagnostics.length ?? 0);
  const valid =
    meshConstruction.valid &&
    (importReport?.accessorValidation?.valid ?? true) &&
    (importReport?.accessorDecoding?.valid ?? true);

  return {
    status: valid ? "ready" : "invalid",
    valid,
    meshCount: meshConstruction.meshes.length,
    submeshCount: meshConstruction.meshes.reduce(
      (total, mesh) => total + (mesh.mesh?.submeshes.length ?? 0),
      0,
    ),
    vertexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.vertexCount,
          0,
        ) ?? 0),
      0,
    ),
    indexCount: meshConstruction.meshes.reduce(
      (total, mesh) =>
        total +
        (mesh.mesh?.submeshes.reduce(
          (submeshTotal, submesh) => submeshTotal + submesh.indexCount,
          0,
        ) ?? 0),
      0,
    ),
    diagnosticsCount:
      meshConstruction.diagnostics.length + dependencyDiagnosticsCount,
  };
}
