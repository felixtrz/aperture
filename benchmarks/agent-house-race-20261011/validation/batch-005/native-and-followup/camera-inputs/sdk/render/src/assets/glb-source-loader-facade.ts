import {
  createGltfReportDrivenImportReportFromGlb,
  gltfReportDrivenGlbImportReportToSourceStatusJsonValue,
  type GltfReportDrivenGlbImportOptions,
  type GltfReportDrivenGlbImportReport,
} from "./gltf-report-driven-import.js";
import {
  createGlbSourceLoaderOutputSummaryJsonValue,
  type GlbSourceLoaderOutputSummaryJsonValue,
} from "./glb-source-loader-output-summary.js";
import type { GltfSourceRegistrationOrchestrationReport } from "./gltf-source-registration-orchestration.js";
import type { GltfEcsAuthoringCommandPlan } from "./gltf-ecs-authoring-command-plan.js";
import {
  createGlbSourceLoaderStatusJsonValue,
  type GlbSourceLoaderDiagnostic,
  type GlbSourceLoaderExternalBufferStatus,
  type GlbSourceLoaderStatusJsonValue,
} from "./glb-source-loader-status.js";
import type {
  GlbContainerDiagnostic,
  GlbContainerSource,
} from "./glb-container.js";
import type {
  GltfDecodedImageData,
  GltfImageDataResolver,
  GltfImageDataResolverInput,
} from "../materials/gltf-texture.js";

export interface CreateNoFetchGlbSourceLoaderReportOptions extends Omit<
  GltfReportDrivenGlbImportOptions,
  "source" | "resolveBufferBytes"
> {
  readonly source: GlbContainerSource;
  readonly externalBufferBytes?: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly decodedImageData?: ReadonlyMap<number, GltfDecodedImageData>;
  readonly sourceRegistration?: GltfSourceRegistrationOrchestrationReport | null;
  readonly ecsCommandPlan?: GltfEcsAuthoringCommandPlan | null;
}

export interface NoFetchGlbSourceLoaderReport {
  readonly status: GlbSourceLoaderStatusJsonValue;
  readonly outputSummary: GlbSourceLoaderOutputSummaryJsonValue;
  readonly glbImportReport: GltfReportDrivenGlbImportReport;
}

export function createNoFetchGlbSourceLoaderReport(
  options: CreateNoFetchGlbSourceLoaderReportOptions,
): NoFetchGlbSourceLoaderReport {
  const {
    externalBufferBytes,
    decodedImageData,
    source,
    sourceRegistration,
    ecsCommandPlan,
    ...importOptions
  } = options;
  const glbImportReport = createGltfReportDrivenImportReportFromGlb({
    ...importOptions,
    source,
    resolveImageData:
      importOptions.resolveImageData ??
      decodedImageDataResolver(decodedImageData),
    resolveBufferBytes: (bufferIndex) =>
      externalBufferBytes?.get(bufferIndex) ?? null,
  });
  const diagnostics = [
    ...glbImportReport.container.diagnostics.map(containerDiagnosticToLoader),
    ...glbImportReport.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
    })),
  ];

  return {
    status: createGlbSourceLoaderStatusJsonValue({
      status: loaderStatusForReport(glbImportReport),
      sourceKind: "glb",
      byteLength: sourceByteLength(source),
      externalBuffers: externalBufferStatuses(
        glbImportReport,
        externalBufferBytes,
      ),
      diagnostics,
      glbSourceStatus:
        gltfReportDrivenGlbImportReportToSourceStatusJsonValue(glbImportReport),
    }),
    outputSummary: createGlbSourceLoaderOutputSummaryJsonValue(
      glbImportReport,
      {
        sourceRegistration: sourceRegistration ?? null,
        ecsCommandPlan: ecsCommandPlan ?? null,
      },
    ),
    glbImportReport,
  };
}

function loaderStatusForReport(
  report: GltfReportDrivenGlbImportReport,
): "loaded" | "failed" | "blocked" {
  if (report.valid) {
    return "loaded";
  }
  if (report.diagnostics.length > 0) {
    return "blocked";
  }
  return "failed";
}

function externalBufferStatuses(
  report: GltfReportDrivenGlbImportReport,
  externalBufferBytes:
    | ReadonlyMap<number, ArrayBuffer | ArrayBufferView>
    | undefined,
): GlbSourceLoaderExternalBufferStatus[] {
  const root = report.container.container?.json;
  const buffers = Array.isArray(root?.buffers) ? root.buffers : [];

  return buffers.flatMap((buffer, bufferIndex) => {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      return [];
    }

    const bytes = externalBufferBytes?.get(bufferIndex) ?? null;
    const diagnostic = report.diagnostics.find(
      (candidate) => candidate.bufferIndex === bufferIndex,
    );

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

function containerDiagnosticToLoader(
  diagnostic: GlbContainerDiagnostic,
): GlbSourceLoaderDiagnostic {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
  };
}

function sourceByteLength(source: GlbContainerSource): number {
  return source instanceof Uint8Array ? source.byteLength : source.byteLength;
}

function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

function decodedImageDataResolver(
  decodedImageData: ReadonlyMap<number, GltfDecodedImageData> | undefined,
): GltfImageDataResolver {
  return (input: GltfImageDataResolverInput) => {
    const image = decodedImageData?.get(input.imageIndex);
    if (image === undefined) {
      return null;
    }

    return image;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
