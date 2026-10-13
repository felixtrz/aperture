import {
  createGltfReportDrivenImportReport,
  type GltfReportDrivenImportOptions,
  type GltfReportDrivenImportReport,
} from "./gltf-report-driven-import.js";
import {
  createGltfSourceLoaderOutputSummaryJsonValue,
  type GlbSourceLoaderOutputSummaryJsonValue,
} from "./glb-source-loader-output-summary.js";
import {
  createGlbSourceLoaderStatusJsonValue,
  type GlbSourceLoaderDiagnostic,
  type GlbSourceLoaderExternalBufferStatus,
  type GlbSourceLoaderStatusJsonValue,
} from "./glb-source-loader-status.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import type {
  GltfDecodedImageData,
  GltfImageDataResolver,
} from "../materials/gltf-texture.js";

export interface CreateNoFetchGltfSourceLoaderReportOptions extends Omit<
  GltfReportDrivenImportOptions,
  "resolveBufferBytes"
> {
  readonly sourceByteLength?: number | null;
  readonly externalBufferBytes?: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly externalImageBytes?: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly decodedImageData?: ReadonlyMap<number, GltfDecodedImageData>;
  readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}

export interface NoFetchGltfSourceLoaderReport {
  readonly status: GlbSourceLoaderStatusJsonValue;
  readonly outputSummary: GlbSourceLoaderOutputSummaryJsonValue;
  readonly root: unknown;
  readonly gltfImportReport: GltfReportDrivenImportReport;
}

export function createNoFetchGltfSourceLoaderReport(
  options: CreateNoFetchGltfSourceLoaderReportOptions,
): NoFetchGltfSourceLoaderReport {
  const {
    externalBufferBytes,
    externalImageBytes: _externalImageBytes,
    decodedImageData,
    sourceByteLength,
    sourceRegistration,
    ecsCommandPlan,
    ...importOptions
  } = options;
  const gltfImportReport = createGltfReportDrivenImportReport({
    ...importOptions,
    resolveImageData:
      importOptions.resolveImageData ??
      decodedImageDataResolver(decodedImageData),
    resolveBufferBytes: (bufferIndex) =>
      externalBufferBytes?.get(bufferIndex) ?? null,
  });
  const diagnostics = importDiagnosticsToLoaderDiagnostics(gltfImportReport);

  return {
    status: createGlbSourceLoaderStatusJsonValue({
      status: gltfImportReport.valid ? "loaded" : "blocked",
      sourceKind: "gltf",
      byteLength: sourceByteLength ?? null,
      externalBuffers: externalBufferStatuses(
        options.root,
        gltfImportReport,
        externalBufferBytes,
      ),
      diagnostics,
      glbSourceStatus: null,
    }),
    outputSummary: createGltfSourceLoaderOutputSummaryJsonValue(
      gltfImportReport,
      {
        sourceRegistration: sourceRegistration ?? null,
        ecsCommandPlan: ecsCommandPlan ?? null,
      },
    ),
    root: options.root,
    gltfImportReport,
  };
}

function importDiagnosticsToLoaderDiagnostics(
  report: GltfReportDrivenImportReport,
): GlbSourceLoaderDiagnostic[] {
  return [
    ...diagnosticsFrom(report.root.diagnostics),
    ...diagnosticsFrom(report.assetMapping?.diagnostics ?? []),
    ...diagnosticsFrom(report.meshPrimitive?.diagnostics ?? []),
    ...diagnosticsFrom(report.accessorValidation?.diagnostics ?? []),
    ...diagnosticsFrom(report.accessorDecoding?.diagnostics ?? []),
    ...diagnosticsFrom(report.meshConstruction?.diagnostics ?? []),
    ...diagnosticsFrom(report.sceneTraversal.diagnostics),
    ...diagnosticsFrom(report.orchestration.diagnostics),
    ...diagnosticsFrom(report.diagnostics),
  ];
}

function diagnosticsFrom(
  diagnostics: readonly {
    readonly code: string;
    readonly severity: "error" | "warning" | "info";
    readonly message: string;
    readonly uri?: string;
  }[],
): GlbSourceLoaderDiagnostic[] {
  return diagnostics.flatMap((diagnostic) =>
    diagnostic.severity === "error"
      ? [
          {
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
          },
        ]
      : [],
  );
}

function externalBufferStatuses(
  root: unknown,
  report: GltfReportDrivenImportReport,
  externalBufferBytes:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined,
): GlbSourceLoaderExternalBufferStatus[] {
  if (!isRecord(root) || !Array.isArray(root.buffers)) {
    return [];
  }

  return root.buffers.flatMap((buffer, bufferIndex) => {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      return [];
    }

    const bytes = externalBufferBytes?.get(bufferIndex) ?? null;
    const diagnostic = diagnosticForBufferIndex(report, bufferIndex);

    return [
      {
        uri: buffer.uri,
        status: bytes === null ? "blocked" : "loaded",
        byteLength: bytes === null ? null : byteLengthOf(bytes),
        ...(diagnostic === undefined
          ? {}
          : { diagnosticCode: diagnostic.code }),
      },
    ];
  });
}

function diagnosticForBufferIndex(
  report: GltfReportDrivenImportReport,
  bufferIndex: number,
): { readonly code: string } | undefined {
  return report.accessorDecoding?.diagnostics.find(
    (diagnostic) => diagnostic.bufferIndex === bufferIndex,
  );
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

function decodedImageDataResolver(
  decodedImageData: ReadonlyMap<number, GltfDecodedImageData> | undefined,
): GltfImageDataResolver {
  return (input) => {
    const image = decodedImageData?.get(input.imageIndex);
    return image === undefined ? null : image;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
