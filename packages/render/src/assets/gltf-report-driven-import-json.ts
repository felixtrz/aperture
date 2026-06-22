import { gltfLoaderOrchestrationReportToJsonValue } from "./gltf-loader-orchestration.js";
import { gltfAssetMappingReportToJsonValue } from "./gltf-asset-mapping.js";
import { gltfAccessorDecodingReportToJsonValue } from "./gltf-accessor-decoding.js";
import { gltfAccessorValidationReportToJsonValue } from "./gltf-accessor-validation.js";
import { gltfRootValidationReportToJsonValue } from "./gltf-root.js";
import { gltfSceneTraversalReportToJsonValue } from "./gltf-scene-traversal.js";
import { gltfMeshPrimitiveMappingReportToJsonValue } from "./gltf-mesh-primitive.js";
import { gltfMeshAssetConstructionReportToJsonValue } from "./gltf-mesh-asset-construction.js";
import type {
  GltfReportDrivenGlbImportReport,
  GltfReportDrivenGlbImportReportJsonValue,
  GltfReportDrivenGlbSourceStatusJsonValue,
  GltfReportDrivenImportReport,
  GltfReportDrivenImportReportJsonValue,
} from "./gltf-report-driven-import-types.js";

export function gltfReportDrivenImportReportToJsonValue(
  report: GltfReportDrivenImportReport,
): GltfReportDrivenImportReportJsonValue {
  return {
    valid: report.valid,
    root: gltfRootValidationReportToJsonValue(report.root),
    assetMapping:
      report.assetMapping === null
        ? null
        : gltfAssetMappingReportToJsonValue(report.assetMapping),
    meshPrimitive:
      report.meshPrimitive === null
        ? null
        : gltfMeshPrimitiveMappingReportToJsonValue(report.meshPrimitive),
    accessorValidation:
      report.accessorValidation === null
        ? null
        : gltfAccessorValidationReportToJsonValue(report.accessorValidation),
    accessorDecoding:
      report.accessorDecoding === null
        ? null
        : gltfAccessorDecodingReportToJsonValue(report.accessorDecoding),
    meshConstruction:
      report.meshConstruction === null
        ? null
        : gltfMeshAssetConstructionReportToJsonValue(report.meshConstruction),
    sceneTraversal: gltfSceneTraversalReportToJsonValue(report.sceneTraversal),
    orchestration: gltfLoaderOrchestrationReportToJsonValue(
      report.orchestration,
    ),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfReportDrivenGlbImportReportToJsonValue(
  report: GltfReportDrivenGlbImportReport,
): GltfReportDrivenGlbImportReportJsonValue {
  return {
    valid: report.valid,
    container: {
      ok: report.container.ok,
      byteLength: report.container.container?.byteLength ?? null,
      chunks:
        report.container.container?.chunks.map((chunk) => ({ ...chunk })) ?? [],
      diagnostics: report.container.diagnostics.map((diagnostic) => ({
        ...diagnostic,
      })),
    },
    importReport:
      report.importReport === null
        ? null
        : gltfReportDrivenImportReportToJsonValue(report.importReport),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfReportDrivenGlbImportReportToSourceStatusJsonValue(
  report: GltfReportDrivenGlbImportReport,
): GltfReportDrivenGlbSourceStatusJsonValue {
  return {
    valid: report.valid,
    byteLength: report.container.container?.byteLength ?? null,
    chunks:
      report.container.container?.chunks.map((chunk) => ({
        type: chunk.type,
        byteLength: chunk.byteLength,
      })) ?? [],
    diagnostics: [
      ...report.container.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
      })),
      ...report.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
      })),
    ],
    importStages:
      report.importReport?.orchestration.stages.map((stage) => ({
        stage: stage.stage,
        status: stage.status,
      })) ?? [],
  };
}

export function gltfReportDrivenImportReportToJson(
  report: GltfReportDrivenImportReport,
): string {
  return JSON.stringify(gltfReportDrivenImportReportToJsonValue(report));
}
