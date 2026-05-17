import {
  createGltfLoaderOrchestrationReport,
  gltfLoaderOrchestrationReportToJsonValue,
  type GltfLoaderOrchestrationReport,
  type GltfLoaderOrchestrationReportJsonValue,
  type GltfLoaderOrchestrationReportOptions,
} from "./gltf-loader-orchestration.js";
import {
  createGltfAssetMappingReport,
  gltfAssetMappingReportToJsonValue,
  type GltfAssetMappingReport,
  type GltfAssetMappingReportJsonValue,
} from "./gltf-asset-mapping.js";
import {
  decodeGltfPrimitiveAccessors,
  gltfAccessorDecodingReportToJsonValue,
  type GltfAccessorDecodingReport,
  type GltfAccessorDecodingReportJsonValue,
} from "./gltf-accessor-decoding.js";
import {
  gltfAccessorValidationReportToJsonValue,
  validateGltfPrimitiveAccessorReferences,
  type GltfAccessorValidationReport,
  type GltfAccessorValidationReportJsonValue,
} from "./gltf-accessor-validation.js";
import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
  type GltfRootValidationReport,
  type GltfRootValidationReportJsonValue,
} from "./gltf-root.js";
import {
  createGltfSceneTraversalReport,
  gltfSceneTraversalReportToJsonValue,
  type GltfSceneTraversalReport,
  type GltfSceneTraversalReportJsonValue,
} from "./gltf-scene-traversal.js";
import {
  createGltfMeshPrimitiveMappingReport,
  gltfMeshPrimitiveMappingReportToJsonValue,
  type GltfMeshPrimitiveMappingReport,
  type GltfMeshPrimitiveMappingReportJsonValue,
} from "./gltf-mesh-primitive.js";
import {
  createMeshAssetsFromGltfDecodedAccessors,
  gltfMeshAssetConstructionReportToJsonValue,
  type GltfMeshAssetConstructionReport,
  type GltfMeshAssetConstructionReportJsonValue,
} from "./gltf-mesh-asset-construction.js";
import type { GltfImageDataResolver } from "../materials/gltf-texture.js";

export type GltfReportDrivenImportDiagnosticCode =
  | "gltfImport.providedRootReport"
  | "gltfImport.providedSceneTraversalReport"
  | "gltfImport.assetMappingConflict"
  | "gltfImport.meshConstructionConflict";

export interface GltfReportDrivenImportDiagnostic {
  readonly code: GltfReportDrivenImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
}

export interface GltfReportDrivenImportOptions {
  readonly root: unknown;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
  readonly createAssetMapping?: boolean;
  readonly resolveImageData?: GltfImageDataResolver;
  readonly createMeshAssets?: boolean;
  readonly resolveBufferBytes?: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly provided?: Partial<GltfLoaderOrchestrationReportOptions>;
}

export interface GltfReportDrivenImportReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReport;
  readonly assetMapping: GltfAssetMappingReport | null;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport | null;
  readonly accessorValidation: GltfAccessorValidationReport | null;
  readonly accessorDecoding: GltfAccessorDecodingReport | null;
  readonly meshConstruction: GltfMeshAssetConstructionReport | null;
  readonly sceneTraversal: GltfSceneTraversalReport;
  readonly orchestration: GltfLoaderOrchestrationReport;
  readonly diagnostics: readonly GltfReportDrivenImportDiagnostic[];
}

export interface GltfReportDrivenImportReportJsonValue extends Omit<
  GltfReportDrivenImportReport,
  | "root"
  | "assetMapping"
  | "meshPrimitive"
  | "accessorValidation"
  | "accessorDecoding"
  | "meshConstruction"
  | "sceneTraversal"
  | "orchestration"
> {
  readonly root: GltfRootValidationReportJsonValue;
  readonly assetMapping: GltfAssetMappingReportJsonValue | null;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReportJsonValue | null;
  readonly accessorValidation: GltfAccessorValidationReportJsonValue | null;
  readonly accessorDecoding: GltfAccessorDecodingReportJsonValue | null;
  readonly meshConstruction: GltfMeshAssetConstructionReportJsonValue | null;
  readonly sceneTraversal: GltfSceneTraversalReportJsonValue;
  readonly orchestration: GltfLoaderOrchestrationReportJsonValue;
}

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
      ? createMeshReports(options)
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

function createMeshReports(options: GltfReportDrivenImportOptions): {
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
  readonly accessorValidation: GltfAccessorValidationReport;
  readonly accessorDecoding: GltfAccessorDecodingReport;
  readonly meshConstruction: GltfMeshAssetConstructionReport;
} {
  const meshPrimitive = createGltfMeshPrimitiveMappingReport({
    root: options.root,
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
  });
  const accessorValidation = validateGltfPrimitiveAccessorReferences({
    root: options.root,
    primitiveReport: meshPrimitive,
  });
  const accessorDecoding = decodeGltfPrimitiveAccessors({
    validationReport: accessorValidation,
    resolveBufferBytes: options.resolveBufferBytes ?? (() => null),
  });
  const meshConstruction = createMeshAssetsFromGltfDecodedAccessors({
    decodedReport: accessorDecoding,
  });

  return {
    meshPrimitive,
    accessorValidation,
    accessorDecoding,
    meshConstruction,
  };
}

export function gltfReportDrivenImportReportToJson(
  report: GltfReportDrivenImportReport,
): string {
  return JSON.stringify(gltfReportDrivenImportReportToJsonValue(report));
}
