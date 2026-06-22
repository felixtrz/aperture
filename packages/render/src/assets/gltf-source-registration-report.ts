import type {
  GltfRegisteredSourceAsset,
  GltfSkippedSourceAsset,
  GltfSourceAssetRegistrationDiagnostic,
  GltfSourceAssetRegistrationReport,
  GltfSourceAssetRegistrationReportJsonValue,
} from "./gltf-source-registration-types.js";

export function gltfSourceAssetRegistrationReportToJsonValue(
  report: GltfSourceAssetRegistrationReport,
): GltfSourceAssetRegistrationReportJsonValue {
  return {
    valid: report.valid,
    written: report.written.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
      ...(entry.dependencyHandleKeys === undefined
        ? {}
        : { dependencyHandleKeys: [...entry.dependencyHandleKeys] }),
    })),
    skipped: report.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfSourceAssetRegistrationReportToJson(
  report: GltfSourceAssetRegistrationReport,
): string {
  return JSON.stringify(gltfSourceAssetRegistrationReportToJsonValue(report));
}

export function createGltfSourceAssetRegistrationReport(input: {
  readonly diagnostics: readonly GltfSourceAssetRegistrationDiagnostic[];
  readonly written: readonly GltfRegisteredSourceAsset[];
  readonly skipped: readonly GltfSkippedSourceAsset[];
}): GltfSourceAssetRegistrationReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    written: input.written,
    skipped: input.skipped,
    diagnostics: input.diagnostics,
  };
}
