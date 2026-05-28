import { createGltfLoaderOrchestrationReport } from "./gltf-loader-orchestration.js";
import { createGltfAssetMappingReport } from "./gltf-asset-mapping.js";
import { validateGltfRootForAssetMapping } from "./gltf-root.js";
import { createGltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import { parseGlbContainer } from "./glb-container.js";
import {
  createGlbBufferSourceDiagnostics,
  resolveGlbBufferBytes,
} from "./gltf-report-driven-import-buffers.js";
import { createGltfReportDrivenMeshReports } from "./gltf-report-driven-import-meshes.js";
import type {
  GltfReportDrivenGlbImportOptions,
  GltfReportDrivenGlbImportReport,
  GltfReportDrivenImportDiagnostic,
  GltfReportDrivenImportOptions,
  GltfReportDrivenImportReport,
} from "./gltf-report-driven-import-types.js";

export {
  gltfReportDrivenGlbImportReportToJsonValue,
  gltfReportDrivenGlbImportReportToSourceStatusJsonValue,
  gltfReportDrivenImportReportToJson,
  gltfReportDrivenImportReportToJsonValue,
} from "./gltf-report-driven-import-json.js";
export type {
  GltfReportDrivenGlbImportDiagnostic,
  GltfReportDrivenGlbImportDiagnosticCode,
  GltfReportDrivenGlbImportOptions,
  GltfReportDrivenGlbImportReport,
  GltfReportDrivenGlbImportReportJsonValue,
  GltfReportDrivenGlbSourceStatusJsonValue,
  GltfReportDrivenImportDiagnostic,
  GltfReportDrivenImportDiagnosticCode,
  GltfReportDrivenImportOptions,
  GltfReportDrivenImportReport,
  GltfReportDrivenImportReportJsonValue,
} from "./gltf-report-driven-import-types.js";

export function createGltfReportDrivenImportReport(
  options: GltfReportDrivenImportOptions,
): GltfReportDrivenImportReport {
  const diagnostics: GltfReportDrivenImportDiagnostic[] = [];
  const root = validateGltfRootForAssetMapping(options.root);
  const assetMapping =
    options.createAssetMapping === true
      ? createGltfAssetMappingReport({
          root: options.root,
          resolveImageData: options.resolveImageData ?? (() => null),
          ...(options.keyPrefix === undefined
            ? {}
            : { keyPrefix: options.keyPrefix }),
        })
      : (options.provided?.assetMapping ?? null);
  const meshReports =
    options.createMeshAssets === true
      ? createGltfReportDrivenMeshReports(options)
      : {
          meshPrimitive: null,
          accessorValidation: null,
          accessorDecoding: null,
          meshConstruction: options.provided?.meshConstruction ?? null,
        };
  const sceneTraversal = createGltfSceneTraversalReport({
    root: options.root,
    ...(options.sceneIndex === undefined
      ? {}
      : { sceneIndex: options.sceneIndex }),
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
  });

  if (options.provided?.root !== undefined) {
    diagnostics.push({
      code: "gltfImport.providedRootReport",
      severity: "error",
      message:
        "Report-driven import creates its own root validation report; provided.root is not accepted.",
    });
  }

  if (options.provided?.sceneTraversal !== undefined) {
    diagnostics.push({
      code: "gltfImport.providedSceneTraversalReport",
      severity: "error",
      message:
        "Report-driven import creates its own scene traversal report; provided.sceneTraversal is not accepted.",
    });
  }

  if (
    options.createAssetMapping === true &&
    options.provided?.assetMapping !== undefined
  ) {
    diagnostics.push({
      code: "gltfImport.assetMappingConflict",
      severity: "error",
      message:
        "Report-driven import cannot accept provided.assetMapping when createAssetMapping is true.",
    });
  }

  if (
    options.createMeshAssets === true &&
    options.provided?.meshConstruction !== undefined
  ) {
    diagnostics.push({
      code: "gltfImport.meshConstructionConflict",
      severity: "error",
      message:
        "Report-driven import cannot accept provided.meshConstruction when createMeshAssets is true.",
    });
  }

  const orchestration = createGltfLoaderOrchestrationReport({
    ...options.provided,
    root,
    ...(assetMapping === null ? {} : { assetMapping }),
    ...(meshReports.meshConstruction === null
      ? {}
      : { meshConstruction: meshReports.meshConstruction }),
    sceneTraversal,
  });

  return {
    valid:
      diagnostics.length === 0 &&
      root.valid &&
      (assetMapping?.valid ?? true) &&
      (meshReports.meshPrimitive?.valid ?? true) &&
      (meshReports.accessorValidation?.valid ?? true) &&
      (meshReports.accessorDecoding?.valid ?? true) &&
      (meshReports.meshConstruction?.valid ?? true) &&
      sceneTraversal.valid &&
      orchestration.valid,
    root,
    assetMapping,
    meshPrimitive: meshReports.meshPrimitive,
    accessorValidation: meshReports.accessorValidation,
    accessorDecoding: meshReports.accessorDecoding,
    meshConstruction: meshReports.meshConstruction,
    sceneTraversal,
    orchestration,
    diagnostics,
  };
}

export function createGltfReportDrivenImportReportFromGlb(
  options: GltfReportDrivenGlbImportOptions,
): GltfReportDrivenGlbImportReport {
  const {
    source,
    resolveBufferBytes: resolveExternalBufferBytes,
    ...importOptions
  } = options;
  const container = parseGlbContainer(source);

  if (container.container === null) {
    return {
      valid: false,
      container,
      importReport: null,
      diagnostics: [],
    };
  }

  const resolvedBuffers = new Map<
    number,
    ArrayBuffer | ArrayBufferView | null
  >();
  const resolveBufferBytes = (bufferIndex: number) =>
    resolveGlbBufferBytes(
      bufferIndex,
      container.container?.json ?? {},
      container.container?.binaryChunk ?? null,
      resolveExternalBufferBytes,
      resolvedBuffers,
    );
  const diagnostics = createGlbBufferSourceDiagnostics(
    container.container.json,
    container.container.binaryChunk,
    resolveBufferBytes,
  );
  const importReport = createGltfReportDrivenImportReport({
    ...importOptions,
    root: container.container.json,
    resolveBufferBytes,
  });

  return {
    valid: container.ok && importReport.valid && diagnostics.length === 0,
    container,
    importReport,
    diagnostics,
  };
}
