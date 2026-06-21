import { arrayTypeForExpectedFormat } from "./gltf-accessor-decoding-shape.js";
export function gltfAccessorDecodingReportToJsonValue(report) {
    return {
        valid: report.valid,
        primitives: report.primitives.map((primitive) => ({
            ...primitive,
            attributes: primitive.attributes.map(decodedAccessorToJsonValue),
            indices: primitive.indices === null
                ? null
                : decodedAccessorToJsonValue(primitive.indices),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfAccessorDecodingReportToJson(report) {
    return JSON.stringify(gltfAccessorDecodingReportToJsonValue(report));
}
export function accessorDecodingDiagnostic(primitive, accessor, input) {
    return {
        code: input.code,
        severity: "error",
        message: input.message,
        meshHandleKey: primitive.meshHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        semantic: accessor.semantic,
        accessorIndex: accessor.accessorIndex,
        bufferIndex: accessor.bufferIndex,
        byteOffset: accessor.byteOffset,
        byteLength: accessor.byteLength,
        expectedFormat: accessor.expectedFormat,
        arrayType: arrayTypeForExpectedFormat(accessor.expectedFormat),
    };
}
function decodedAccessorToJsonValue(accessor) {
    const { array, sourceView, ...metadata } = accessor;
    return {
        ...metadata,
        array: {
            type: array.constructor.name,
            length: array.length,
        },
        ...(sourceView === undefined
            ? {}
            : {
                sourceView: {
                    type: "Uint8Array",
                    length: sourceView.length,
                },
            }),
    };
}
//# sourceMappingURL=gltf-accessor-decoding-report.js.map