import { decodeShape } from "./gltf-accessor-decoding-shape.js";
import { accessorDecodingDiagnostic, gltfAccessorDecodingReportToJson, gltfAccessorDecodingReportToJsonValue, } from "./gltf-accessor-decoding-report.js";
import { createDirectSourceBinding, decodeStridedAccessor, decodeTightlyPackedAccessor, sourceBytesView, } from "./gltf-accessor-decoding-source.js";
export { gltfAccessorDecodingReportToJson, gltfAccessorDecodingReportToJsonValue, };
export function decodeGltfPrimitiveAccessors(options) {
    const diagnostics = [];
    const primitives = [];
    for (const primitive of options.validationReport.primitives) {
        const decoded = decodePrimitive(options, primitive, diagnostics);
        if (decoded !== null) {
            primitives.push(decoded);
        }
    }
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        primitives,
        diagnostics,
    };
}
function decodePrimitive(options, primitive, diagnostics) {
    const diagnosticsBefore = diagnostics.length;
    const attributes = [];
    for (const attribute of primitive.attributes) {
        const decoded = decodeAccessor(options, primitive, attribute, diagnostics);
        if (decoded !== null) {
            attributes.push(decoded);
        }
    }
    const indices = primitive.indices === null
        ? null
        : decodeAccessor(options, primitive, primitive.indices, diagnostics);
    const hasError = diagnostics
        .slice(diagnosticsBefore)
        .some((diagnostic) => diagnostic.severity === "error");
    if (hasError || attributes.length === 0 || primitive.vertexCount === null) {
        return null;
    }
    return {
        meshHandleKey: primitive.meshHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        vertexCount: primitive.vertexCount,
        attributes,
        indices,
    };
}
function decodeAccessor(options, primitive, accessor, diagnostics) {
    const source = options.resolveBufferBytes(accessor.bufferIndex);
    const sourceBytes = sourceBytesView(source);
    if (sourceBytes === null) {
        diagnostics.push(accessorDecodingDiagnostic(primitive, accessor, {
            code: "gltfDecode.missingBufferBytes",
            message: `Buffer ${accessor.bufferIndex} bytes were not provided for ${accessor.semantic}.`,
        }));
        return null;
    }
    if (accessor.byteOffset + accessor.byteLength > sourceBytes.byteLength) {
        diagnostics.push(accessorDecodingDiagnostic(primitive, accessor, {
            code: "gltfDecode.sourceRangeOutOfBounds",
            message: `Accessor ${accessor.accessorIndex} source range exceeds resolved buffer ${accessor.bufferIndex}.`,
        }));
        return null;
    }
    const shape = decodeShape(accessor);
    if (shape === null) {
        diagnostics.push(accessorDecodingDiagnostic(primitive, accessor, {
            code: "gltfDecode.unsupportedOutputFormat",
            message: `Accessor ${accessor.accessorIndex} has unsupported output format '${accessor.expectedFormat}'.`,
        }));
        return null;
    }
    const storageMode = options.storageMode ?? "compact-copy";
    const elementByteSize = shape.sourceItemSize * shape.sourceComponentBytes;
    const output = decodeTightlyPackedAccessor({
        accessor,
        elementByteSize,
        shape,
        sourceBytes,
        storageMode,
    }) ?? decodeStridedAccessor(sourceBytes, accessor, shape);
    const sourceBinding = createDirectSourceBinding({
        accessor,
        elementByteSize,
        shape,
        sourceBytes,
        storageMode,
    });
    return {
        semantic: accessor.semantic,
        accessorIndex: accessor.accessorIndex,
        bufferIndex: accessor.bufferIndex,
        sourceByteOffset: accessor.byteOffset,
        sourceByteLength: accessor.count === 0
            ? 0
            : (accessor.count - 1) * accessor.byteStride + elementByteSize,
        ...(sourceBinding === null ? {} : sourceBinding),
        expectedFormat: accessor.expectedFormat,
        itemSize: shape.outputItemSize,
        array: output,
    };
}
//# sourceMappingURL=gltf-accessor-decoding.js.map