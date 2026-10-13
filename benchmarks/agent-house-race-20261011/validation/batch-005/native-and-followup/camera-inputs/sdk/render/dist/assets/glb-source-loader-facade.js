import { createGltfReportDrivenImportReportFromGlb, gltfReportDrivenGlbImportReportToSourceStatusJsonValue, } from "./gltf-report-driven-import.js";
import { createGlbSourceLoaderOutputSummaryJsonValue, } from "./glb-source-loader-output-summary.js";
import { createGlbSourceLoaderStatusJsonValue, } from "./glb-source-loader-status.js";
export function createNoFetchGlbSourceLoaderReport(options) {
    const { externalBufferBytes, decodedImageData, source, sourceRegistration, ecsCommandPlan, ...importOptions } = options;
    const glbImportReport = createGltfReportDrivenImportReportFromGlb({
        ...importOptions,
        source,
        resolveImageData: importOptions.resolveImageData ??
            decodedImageDataResolver(decodedImageData),
        resolveBufferBytes: (bufferIndex) => externalBufferBytes?.get(bufferIndex) ?? null,
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
            externalBuffers: externalBufferStatuses(glbImportReport, externalBufferBytes),
            diagnostics,
            glbSourceStatus: gltfReportDrivenGlbImportReportToSourceStatusJsonValue(glbImportReport),
        }),
        outputSummary: createGlbSourceLoaderOutputSummaryJsonValue(glbImportReport, {
            sourceRegistration: sourceRegistration ?? null,
            ecsCommandPlan: ecsCommandPlan ?? null,
        }),
        glbImportReport,
    };
}
function loaderStatusForReport(report) {
    if (report.valid) {
        return "loaded";
    }
    if (report.diagnostics.length > 0) {
        return "blocked";
    }
    return "failed";
}
function externalBufferStatuses(report, externalBufferBytes) {
    const root = report.container.container?.json;
    const buffers = Array.isArray(root?.buffers) ? root.buffers : [];
    return buffers.flatMap((buffer, bufferIndex) => {
        if (!isRecord(buffer) || typeof buffer.uri !== "string") {
            return [];
        }
        const bytes = externalBufferBytes?.get(bufferIndex) ?? null;
        const diagnostic = report.diagnostics.find((candidate) => candidate.bufferIndex === bufferIndex);
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
function containerDiagnosticToLoader(diagnostic) {
    return {
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
    };
}
function sourceByteLength(source) {
    return source instanceof Uint8Array ? source.byteLength : source.byteLength;
}
function byteLengthOf(bytes) {
    return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}
function decodedImageDataResolver(decodedImageData) {
    return (input) => {
        const image = decodedImageData?.get(input.imageIndex);
        if (image === undefined) {
            return null;
        }
        return image;
    };
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=glb-source-loader-facade.js.map