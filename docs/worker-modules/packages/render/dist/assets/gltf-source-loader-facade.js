import { createGltfReportDrivenImportReport, } from "./gltf-report-driven-import.js";
import { createGltfSourceLoaderOutputSummaryJsonValue, } from "./glb-source-loader-output-summary.js";
import { createGlbSourceLoaderStatusJsonValue, } from "./glb-source-loader-status.js";
export function createNoFetchGltfSourceLoaderReport(options) {
    const { externalBufferBytes, externalImageBytes: _externalImageBytes, decodedImageData, sourceByteLength, sourceRegistration, ecsCommandPlan, ...importOptions } = options;
    const gltfImportReport = createGltfReportDrivenImportReport({
        ...importOptions,
        resolveImageData: importOptions.resolveImageData ??
            decodedImageDataResolver(decodedImageData),
        resolveBufferBytes: (bufferIndex) => externalBufferBytes?.get(bufferIndex) ?? null,
    });
    const diagnostics = importDiagnosticsToLoaderDiagnostics(gltfImportReport);
    return {
        status: createGlbSourceLoaderStatusJsonValue({
            status: gltfImportReport.valid ? "loaded" : "blocked",
            sourceKind: "gltf",
            byteLength: sourceByteLength ?? null,
            externalBuffers: externalBufferStatuses(options.root, gltfImportReport, externalBufferBytes),
            diagnostics,
            glbSourceStatus: null,
        }),
        outputSummary: createGltfSourceLoaderOutputSummaryJsonValue(gltfImportReport, {
            sourceRegistration: sourceRegistration ?? null,
            ecsCommandPlan: ecsCommandPlan ?? null,
        }),
        root: options.root,
        gltfImportReport,
    };
}
function importDiagnosticsToLoaderDiagnostics(report) {
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
function diagnosticsFrom(diagnostics) {
    return diagnostics.flatMap((diagnostic) => diagnostic.severity === "error"
        ? [
            {
                code: diagnostic.code,
                severity: diagnostic.severity,
                message: diagnostic.message,
                ...(diagnostic.uri === undefined ? {} : { uri: diagnostic.uri }),
            },
        ]
        : []);
}
function externalBufferStatuses(root, report, externalBufferBytes) {
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
function diagnosticForBufferIndex(report, bufferIndex) {
    return report.accessorDecoding?.diagnostics.find((diagnostic) => diagnostic.bufferIndex === bufferIndex);
}
function byteLengthOf(bytes) {
    return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}
function decodedImageDataResolver(decodedImageData) {
    return (input) => {
        const image = decodedImageData?.get(input.imageIndex);
        return image === undefined ? null : image;
    };
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=gltf-source-loader-facade.js.map