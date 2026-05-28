import {
  createGltfLoaderOrchestrationReport,
  type GltfLoaderOrchestrationReport,
  type GltfLoaderOrchestrationReportJsonValue,
  type GltfLoaderOrchestrationReportOptions,
} from "./gltf-loader-orchestration.js";
import {
  createGltfAssetMappingReport,
  type GltfAssetMappingReport,
  type GltfAssetMappingReportJsonValue,
} from "./gltf-asset-mapping.js";
import {
  decodeGltfPrimitiveAccessors,
  type GltfAccessorDecodingReport,
  type GltfAccessorDecodingReportJsonValue,
  type GltfAccessorStorageMode,
} from "./gltf-accessor-decoding.js";
import {
  validateGltfPrimitiveAccessorReferences,
  type GltfAccessorValidationReport,
  type GltfAccessorValidationReportJsonValue,
} from "./gltf-accessor-validation.js";
import {
  validateGltfRootForAssetMapping,
  type GltfRootValidationReport,
  type GltfRootValidationReportJsonValue,
} from "./gltf-root.js";
import {
  createGltfSceneTraversalReport,
  type GltfSceneTraversalReport,
  type GltfSceneTraversalReportJsonValue,
} from "./gltf-scene-traversal.js";
import {
  createGltfMeshPrimitiveMappingReport,
  type GltfMeshPrimitiveMappingReport,
  type GltfMeshPrimitiveMappingReportJsonValue,
} from "./gltf-mesh-primitive.js";
import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
import {
  createMeshAssetsFromGltfDecodedAccessors,
  type GltfMeshAssetConstructionReport,
  type GltfMeshAssetConstructionReportJsonValue,
  type GltfMeshAssetTangentGenerationRequest,
} from "./gltf-mesh-asset-construction.js";
import {
  parseGlbContainer,
  type GlbContainerParseResult,
  type GlbContainerSource,
} from "./glb-container.js";
import {
  createGlbBufferSourceDiagnostics,
  resolvedExternalBufferByteLengths,
  resolveGlbBufferBytes,
} from "./gltf-report-driven-import-buffers.js";
import { decodeGltfDracoPrimitiveAccessors } from "./gltf-report-driven-import-draco.js";
import { decodeGltfMeshoptBufferViews } from "./gltf-report-driven-import-meshopt.js";
import type { GltfImageDataResolver } from "../materials/gltf-texture.js";

export {
  gltfReportDrivenGlbImportReportToJsonValue,
  gltfReportDrivenGlbImportReportToSourceStatusJsonValue,
  gltfReportDrivenImportReportToJson,
  gltfReportDrivenImportReportToJsonValue,
} from "./gltf-report-driven-import-json.js";

export type GltfReportDrivenImportDiagnosticCode =
  | "gltfImport.providedRootReport"
  | "gltfImport.providedSceneTraversalReport"
  | "gltfImport.assetMappingConflict"
  | "gltfImport.meshConstructionConflict";

export type GltfReportDrivenGlbImportDiagnosticCode =
  | "glbImport.missingBinaryChunk"
  | "glbImport.externalBufferUnsupported";

export interface GltfReportDrivenImportDiagnostic {
  readonly code: GltfReportDrivenImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
}

export interface GltfReportDrivenGlbImportDiagnostic {
  readonly code: GltfReportDrivenGlbImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly bufferIndex?: number;
  readonly uri?: string;
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
  readonly dracoDecoder?: DracoMeshDecoder;
  readonly meshoptDecoder?: MeshoptBufferDecoder;
  readonly accessorStorageMode?: GltfAccessorStorageMode;
  readonly provided?: Partial<GltfLoaderOrchestrationReportOptions>;
}

export interface GltfReportDrivenGlbImportOptions extends Omit<
  GltfReportDrivenImportOptions,
  "root" | "resolveBufferBytes"
> {
  readonly source: GlbContainerSource;
  readonly resolveBufferBytes?: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
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

export interface GltfReportDrivenGlbImportReport {
  readonly valid: boolean;
  readonly container: GlbContainerParseResult;
  readonly importReport: GltfReportDrivenImportReport | null;
  readonly diagnostics: readonly GltfReportDrivenGlbImportDiagnostic[];
}

export interface GltfReportDrivenGlbImportReportJsonValue {
  readonly valid: boolean;
  readonly container: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly chunks: readonly {
      readonly type: string;
      readonly typeCode: number;
      readonly byteOffset: number;
      readonly byteLength: number;
    }[];
    readonly diagnostics: readonly GlbContainerParseResult["diagnostics"][number][];
  };
  readonly importReport: GltfReportDrivenImportReportJsonValue | null;
  readonly diagnostics: readonly GltfReportDrivenGlbImportDiagnostic[];
}

export interface GltfReportDrivenGlbSourceStatusJsonValue {
  readonly valid: boolean;
  readonly byteLength: number | null;
  readonly chunks: readonly {
    readonly type: string;
    readonly byteLength: number;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
  readonly importStages: readonly {
    readonly stage: string;
    readonly status: string;
  }[];
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

function createMeshReports(options: GltfReportDrivenImportOptions): {
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport;
  readonly accessorValidation: GltfAccessorValidationReport;
  readonly accessorDecoding: GltfAccessorDecodingReport;
  readonly meshConstruction: GltfMeshAssetConstructionReport;
} {
  const meshoptBuffers = decodeGltfMeshoptBufferViews({
    root: options.root,
    decoder: options.meshoptDecoder,
    resolveBufferBytes: options.resolveBufferBytes ?? (() => null),
  });
  const meshRoot = meshoptBuffers.root;
  const resolveMeshBufferBytes = meshoptBuffers.resolveBufferBytes;
  const meshPrimitive = createGltfMeshPrimitiveMappingReport({
    root: meshRoot,
    ...(options.keyPrefix === undefined
      ? {}
      : { keyPrefix: options.keyPrefix }),
    ...(options.dracoDecoder === undefined
      ? {}
      : {
          supportedCompressedPrimitiveExtensions: [
            "KHR_draco_mesh_compression",
          ] as const,
        }),
  });
  const accessorValidation = validateGltfPrimitiveAccessorReferences({
    root: meshRoot,
    primitiveReport: meshPrimitive,
    ...resolvedExternalBufferByteLengths({
      ...options,
      root: meshRoot,
      resolveBufferBytes: resolveMeshBufferBytes,
    }),
  });
  const uncompressedAccessorDecoding = decodeGltfPrimitiveAccessors({
    validationReport: accessorValidation,
    resolveBufferBytes: resolveMeshBufferBytes,
    storageMode: options.accessorStorageMode ?? "source-view",
  });
  const dracoAccessorDecoding = decodeGltfDracoPrimitiveAccessors({
    root: meshRoot,
    primitiveReport: meshPrimitive,
    decoder: options.dracoDecoder,
    resolveBufferBytes: resolveMeshBufferBytes,
  });
  const accessorDecoding = mergeAccessorDecodingReports(
    mergeAccessorDecodingReports(
      uncompressedAccessorDecoding,
      dracoAccessorDecoding,
    ),
    {
      valid: meshoptBuffers.diagnostics.every(
        (diagnostic) => diagnostic.severity !== "error",
      ),
      primitives: [],
      diagnostics: meshoptBuffers.diagnostics,
    },
  );
  const meshConstruction = createMeshAssetsFromGltfDecodedAccessors({
    decodedReport: accessorDecoding,
    generateMissingTangentsFor: createMissingTangentGenerationRequests(
      meshRoot,
      meshPrimitive,
    ),
  });

  return {
    meshPrimitive,
    accessorValidation,
    accessorDecoding,
    meshConstruction,
  };
}

function mergeAccessorDecodingReports(
  first: GltfAccessorDecodingReport,
  second: GltfAccessorDecodingReport,
): GltfAccessorDecodingReport {
  return {
    valid: first.valid && second.valid,
    primitives: [...first.primitives, ...second.primitives],
    diagnostics: [...first.diagnostics, ...second.diagnostics],
  };
}

function createMissingTangentGenerationRequests(
  root: unknown,
  meshPrimitive: GltfMeshPrimitiveMappingReport,
): readonly GltfMeshAssetTangentGenerationRequest[] {
  if (!isRecord(root) || !Array.isArray(root.materials)) {
    return [];
  }

  const requests: GltfMeshAssetTangentGenerationRequest[] = [];

  for (const mesh of meshPrimitive.meshes) {
    if (
      mesh.materialIndex === null ||
      !gltfMaterialNeedsTangents(root.materials, mesh.materialIndex)
    ) {
      continue;
    }

    requests.push({
      meshIndex: mesh.meshIndex,
      primitiveIndex: mesh.primitiveIndex,
      reason: "normalTexture",
    });
  }

  return requests;
}

function gltfMaterialNeedsTangents(
  materials: readonly unknown[],
  materialIndex: number,
): boolean {
  const material = materials[materialIndex];

  return isRecord(material) && isRecord(material.normalTexture);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
