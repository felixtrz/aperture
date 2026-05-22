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
  type GltfAccessorDecodingDiagnostic,
  type GltfDecodedPrimitiveAccessors,
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
  type GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";
import {
  createGltfDecodedPrimitiveAccessorsFromDraco,
  type DracoAttributeDecodeRequest,
  type DracoMeshDecoder,
} from "./draco-decoder.js";
import type {
  MeshoptBufferDecoder,
  MeshoptDecodeFilter,
  MeshoptDecodeMode,
} from "./meshopt-decoder.js";
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
  readonly dracoDecoder?: DracoMeshDecoder;
  readonly meshoptDecoder?: MeshoptBufferDecoder;
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

type GltfMeshoptCompressionExtensionName =
  | "EXT_meshopt_compression"
  | "KHR_meshopt_compression";

interface DecodedGltfMeshoptBufferViews {
  readonly root: unknown;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}

interface GltfMeshoptBufferViewExtension {
  readonly extensionName: GltfMeshoptCompressionExtensionName;
  readonly buffer: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number;
  readonly count: number;
  readonly mode: MeshoptDecodeMode;
  readonly filter?: MeshoptDecodeFilter;
}

function decodeGltfMeshoptBufferViews(input: {
  readonly root: unknown;
  readonly decoder: MeshoptBufferDecoder | undefined;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
}): DecodedGltfMeshoptBufferViews {
  const passthrough: DecodedGltfMeshoptBufferViews = {
    root: input.root,
    resolveBufferBytes: input.resolveBufferBytes,
    diagnostics: [],
  };

  if (!isRecord(input.root) || !Array.isArray(input.root.bufferViews)) {
    return passthrough;
  }

  const compressedBufferViewIndexes = input.root.bufferViews
    .map((bufferView, bufferViewIndex) =>
      meshoptExtensionNameForBufferView(bufferView) === null
        ? null
        : bufferViewIndex,
    )
    .filter(
      (bufferViewIndex): bufferViewIndex is number => bufferViewIndex !== null,
    );

  if (compressedBufferViewIndexes.length === 0) {
    return passthrough;
  }

  const diagnostics: GltfAccessorDecodingDiagnostic[] = [];
  if (input.decoder === undefined) {
    for (const bufferViewIndex of compressedBufferViewIndexes) {
      diagnostics.push({
        code: "gltfMeshoptDecode.decoderRequired",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} requires a Meshopt decoder.`,
        bufferViewIndex,
      });
    }

    return {
      ...passthrough,
      diagnostics,
    };
  }

  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const transformedBuffers = buffers.map((buffer) =>
    isRecord(buffer) ? { ...buffer } : buffer,
  );
  const transformedBufferViews = input.root.bufferViews.map((bufferView) =>
    isRecord(bufferView) ? { ...bufferView } : bufferView,
  );
  const decodedBuffers = new Map<number, Uint8Array>();

  for (const bufferViewIndex of compressedBufferViewIndexes) {
    const bufferView = input.root.bufferViews[bufferViewIndex];
    const extension = meshoptExtensionForBufferView(bufferView);

    if (extension === null) {
      diagnostics.push({
        code: "gltfMeshoptDecode.malformedExtension",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} has a malformed compression extension.`,
        bufferViewIndex,
      });
      continue;
    }

    const sourceBytes = bytesView(input.resolveBufferBytes(extension.buffer));
    if (
      sourceBytes === null ||
      extension.byteOffset + extension.byteLength > sourceBytes.byteLength
    ) {
      diagnostics.push({
        code: "gltfMeshoptDecode.missingBufferBytes",
        severity: "error",
        message: `Meshopt-compressed bufferView ${bufferViewIndex} source bytes were not available.`,
        bufferViewIndex,
        bufferIndex: extension.buffer,
        byteOffset: extension.byteOffset,
        byteLength: extension.byteLength,
      });
      continue;
    }

    try {
      const decoded = input.decoder.decodeGltfBuffer(
        sourceBytes.subarray(
          extension.byteOffset,
          extension.byteOffset + extension.byteLength,
        ),
        {
          count: extension.count,
          byteStride: extension.byteStride,
          mode: extension.mode,
          ...(extension.filter === undefined
            ? {}
            : { filter: extension.filter }),
        },
      );
      const decodedBufferIndex = transformedBuffers.length;
      transformedBuffers.push({ byteLength: decoded.byteLength });
      decodedBuffers.set(decodedBufferIndex, decoded);
      transformedBufferViews[bufferViewIndex] = decodedMeshoptBufferView(
        bufferView,
        decodedBufferIndex,
        decoded.byteLength,
      );
    } catch (error) {
      diagnostics.push({
        code: "gltfMeshoptDecode.failed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Meshopt decode failed for bufferView ${bufferViewIndex}.`,
        bufferViewIndex,
        bufferIndex: extension.buffer,
        byteOffset: extension.byteOffset,
        byteLength: extension.byteLength,
      });
    }
  }

  return {
    root: {
      ...input.root,
      buffers: transformedBuffers,
      bufferViews: transformedBufferViews,
    },
    resolveBufferBytes: (bufferIndex) =>
      decodedBuffers.get(bufferIndex) ?? input.resolveBufferBytes(bufferIndex),
    diagnostics,
  };
}

function decodedMeshoptBufferView(
  source: unknown,
  bufferIndex: number,
  byteLength: number,
): Record<string, unknown> {
  const output = isRecord(source) ? { ...source } : {};
  output.buffer = bufferIndex;
  output.byteOffset = 0;
  output.byteLength = byteLength;

  const extensions = isRecord(output.extensions)
    ? { ...output.extensions }
    : null;
  if (extensions !== null) {
    delete extensions.EXT_meshopt_compression;
    delete extensions.KHR_meshopt_compression;
    if (Object.keys(extensions).length === 0) {
      delete output.extensions;
    } else {
      output.extensions = extensions;
    }
  }

  return output;
}

function meshoptExtensionNameForBufferView(
  bufferView: unknown,
): GltfMeshoptCompressionExtensionName | null {
  if (!isRecord(bufferView) || !isRecord(bufferView.extensions)) {
    return null;
  }

  if (bufferView.extensions.EXT_meshopt_compression !== undefined) {
    return "EXT_meshopt_compression";
  }
  if (bufferView.extensions.KHR_meshopt_compression !== undefined) {
    return "KHR_meshopt_compression";
  }

  return null;
}

function meshoptExtensionForBufferView(
  bufferView: unknown,
): GltfMeshoptBufferViewExtension | null {
  const extensionName = meshoptExtensionNameForBufferView(bufferView);
  if (
    !isRecord(bufferView) ||
    !isRecord(bufferView.extensions) ||
    extensionName === null
  ) {
    return null;
  }

  const extension = bufferView.extensions[extensionName];
  if (!isRecord(extension)) {
    return null;
  }

  const buffer = integerField(extension.buffer);
  const byteOffset = integerField(extension.byteOffset ?? 0);
  const byteLength = integerField(extension.byteLength);
  const byteStride = integerField(extension.byteStride);
  const count = integerField(extension.count);
  const mode = meshoptDecodeMode(extension.mode);
  const filter = meshoptDecodeFilter(extension.filter ?? "NONE");

  if (
    buffer === null ||
    buffer < 0 ||
    byteOffset === null ||
    byteOffset < 0 ||
    byteLength === null ||
    byteLength < 0 ||
    byteStride === null ||
    byteStride <= 0 ||
    count === null ||
    count <= 0 ||
    mode === null ||
    filter === null
  ) {
    return null;
  }

  return {
    extensionName,
    buffer,
    byteOffset,
    byteLength,
    byteStride,
    count,
    mode,
    ...(filter === "NONE" ? {} : { filter }),
  };
}

function meshoptDecodeMode(value: unknown): MeshoptDecodeMode | null {
  return value === "ATTRIBUTES" || value === "TRIANGLES" || value === "INDICES"
    ? value
    : null;
}

function meshoptDecodeFilter(value: unknown): MeshoptDecodeFilter | null {
  return value === "NONE" ||
    value === "OCTAHEDRAL" ||
    value === "QUATERNION" ||
    value === "EXPONENTIAL" ||
    value === "COLOR"
    ? value
    : null;
}

function decodeGltfDracoPrimitiveAccessors(input: {
  readonly root: unknown;
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly decoder: DracoMeshDecoder | undefined;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
}): GltfAccessorDecodingReport {
  const diagnostics: GltfAccessorDecodingDiagnostic[] = [];
  const primitives: GltfDecodedPrimitiveAccessors[] = [];

  if (input.decoder === undefined || !isRecord(input.root)) {
    return { valid: true, primitives, diagnostics };
  }

  for (const primitive of input.primitiveReport.meshes) {
    if (primitive.compression?.extensionName !== "KHR_draco_mesh_compression") {
      continue;
    }

    const source = resolveCompressedBufferViewBytes(
      {
        root: input.root,
        resolveBufferBytes: input.resolveBufferBytes,
      },
      primitive,
    );
    if (source === null) {
      diagnostics.push({
        code: "gltfDracoDecode.missingBufferBytes",
        severity: "error",
        message: `Draco bufferView ${primitive.compression.bufferView} bytes were not available for mesh ${primitive.meshIndex} primitive ${primitive.primitiveIndex}.`,
        meshHandleKey: primitive.registeredHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
      });
      continue;
    }

    try {
      const decoded = input.decoder.decode(source.bytes, {
        attributes: primitive.compression.attributes.map(
          dracoAttributeRequestForSemantic,
        ),
      });
      primitives.push(
        createGltfDecodedPrimitiveAccessorsFromDraco({
          meshHandleKey: primitive.registeredHandleKey,
          meshIndex: primitive.meshIndex,
          primitiveIndex: primitive.primitiveIndex,
          decoded,
        }),
      );
    } catch (error) {
      diagnostics.push({
        code: "gltfDracoDecode.failed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Draco decode failed for mesh ${primitive.meshIndex} primitive ${primitive.primitiveIndex}.`,
        meshHandleKey: primitive.registeredHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        bufferIndex: source.bufferIndex,
        byteOffset: source.byteOffset,
        byteLength: source.bytes.byteLength,
      });
    }
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    primitives,
    diagnostics,
  };
}

function resolveCompressedBufferViewBytes(
  input: {
    readonly root: Record<string, unknown>;
    readonly resolveBufferBytes: (
      bufferIndex: number,
    ) => ArrayBuffer | ArrayBufferView | null | undefined;
  },
  primitive: GltfPlannedMeshPrimitiveAsset,
): {
  readonly bytes: Uint8Array;
  readonly bufferIndex: number;
  readonly byteOffset: number;
} | null {
  const bufferViewIndex = primitive.compression?.bufferView;
  const bufferView =
    bufferViewIndex === undefined
      ? undefined
      : Array.isArray(input.root.bufferViews)
        ? input.root.bufferViews[bufferViewIndex]
        : undefined;

  if (!isRecord(bufferView)) {
    return null;
  }

  const bufferIndex = integerField(bufferView.buffer);
  const byteOffset = integerField(bufferView.byteOffset ?? 0);
  const byteLength = integerField(bufferView.byteLength);
  if (
    bufferIndex === null ||
    bufferIndex < 0 ||
    byteOffset === null ||
    byteOffset < 0 ||
    byteLength === null ||
    byteLength < 0
  ) {
    return null;
  }

  const sourceBytes = bytesView(input.resolveBufferBytes(bufferIndex));
  if (
    sourceBytes === null ||
    byteOffset + byteLength > sourceBytes.byteLength
  ) {
    return null;
  }

  return {
    bytes: sourceBytes.subarray(byteOffset, byteOffset + byteLength),
    bufferIndex,
    byteOffset,
  };
}

function dracoAttributeRequestForSemantic(input: {
  readonly semantic: string;
  readonly uniqueId: number;
}): DracoAttributeDecodeRequest {
  return {
    semantic: input.semantic,
    uniqueId: input.uniqueId,
    output: input.semantic === "JOINTS_0" ? "uint16" : "float32",
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

function bytesView(
  source: ArrayBuffer | ArrayBufferView | null | undefined,
): Uint8Array | null {
  if (source === null || source === undefined) {
    return null;
  }

  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function integerField(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" ? value : null;
}

export function gltfReportDrivenImportReportToJson(
  report: GltfReportDrivenImportReport,
): string {
  return JSON.stringify(gltfReportDrivenImportReportToJsonValue(report));
}
