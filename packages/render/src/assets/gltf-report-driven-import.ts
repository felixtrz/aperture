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
  type GltfMeshAssetTangentGenerationRequest,
} from "./gltf-mesh-asset-construction.js";
import {
  parseGlbContainer,
  type GlbContainerParseResult,
  type GlbContainerSource,
} from "./glb-container.js";
import type { GltfImageDataResolver } from "../materials/gltf-texture.js";

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
    ...resolvedExternalBufferByteLengths(options),
  });
  const accessorDecoding = decodeGltfPrimitiveAccessors({
    validationReport: accessorValidation,
    resolveBufferBytes: options.resolveBufferBytes ?? (() => null),
  });
  const meshConstruction = createMeshAssetsFromGltfDecodedAccessors({
    decodedReport: accessorDecoding,
    generateMissingTangentsFor: createMissingTangentGenerationRequests(
      options.root,
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

function resolvedExternalBufferByteLengths(
  options: GltfReportDrivenImportOptions,
): { readonly externalBufferByteLengths?: ReadonlyMap<number, number> } {
  if (!isRecord(options.root) || !Array.isArray(options.root.buffers)) {
    return {};
  }

  const byteLengths = new Map<number, number>();

  for (const [bufferIndex, buffer] of options.root.buffers.entries()) {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      continue;
    }

    const bytes = options.resolveBufferBytes?.(bufferIndex) ?? null;

    if (bytes !== null) {
      byteLengths.set(bufferIndex, byteLengthOf(bytes));
    }
  }

  return byteLengths.size === 0
    ? {}
    : { externalBufferByteLengths: byteLengths };
}

function resolveGlbBufferBytes(
  bufferIndex: number,
  root: Record<string, unknown>,
  binaryChunk: Uint8Array | null,
  resolveExternalBufferBytes:
    | ((
        bufferIndex: number,
      ) => ArrayBuffer | ArrayBufferView | null | undefined)
    | undefined,
  resolvedBuffers: Map<number, ArrayBuffer | ArrayBufferView | null>,
): ArrayBuffer | ArrayBufferView | null {
  if (resolvedBuffers.has(bufferIndex)) {
    return resolvedBuffers.get(bufferIndex) ?? null;
  }

  const buffer = Array.isArray(root.buffers)
    ? root.buffers[bufferIndex]
    : undefined;
  const isExternalBuffer = isRecord(buffer) && typeof buffer.uri === "string";
  const resolved =
    (isExternalBuffer
      ? resolveExternalBufferBytes?.(bufferIndex)
      : bufferIndex === 0
        ? binaryChunk
        : null) ?? null;
  const normalized = resolved ?? null;

  resolvedBuffers.set(bufferIndex, normalized);

  return normalized;
}

function createGlbBufferSourceDiagnostics(
  root: Record<string, unknown>,
  binaryChunk: Uint8Array | null,
  resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null,
): GltfReportDrivenGlbImportDiagnostic[] {
  const buffers = Array.isArray(root.buffers) ? root.buffers : [];
  const diagnostics: GltfReportDrivenGlbImportDiagnostic[] = [];

  buffers.forEach((buffer, bufferIndex) => {
    if (!isRecord(buffer)) {
      return;
    }

    if (resolveBufferBytes(bufferIndex) !== null) {
      return;
    }

    if (typeof buffer.uri === "string") {
      diagnostics.push({
        code: "glbImport.externalBufferUnsupported",
        severity: "error",
        bufferIndex,
        uri: buffer.uri,
        message: `GLB buffer ${bufferIndex} uses external URI '${buffer.uri}', but no caller-provided bytes were resolved.`,
      });
      return;
    }

    if (bufferIndex === 0 && binaryChunk === null) {
      diagnostics.push({
        code: "glbImport.missingBinaryChunk",
        severity: "error",
        bufferIndex,
        message:
          "GLB buffer 0 requires bytes, but the container has no BIN chunk.",
      });
    }
  });

  return diagnostics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

export function gltfReportDrivenImportReportToJson(
  report: GltfReportDrivenImportReport,
): string {
  return JSON.stringify(gltfReportDrivenImportReportToJsonValue(report));
}
