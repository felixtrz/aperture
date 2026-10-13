import { pushAccessorValidationDiagnostic } from "./gltf-accessor-validation-diagnostics.js";
import { arrayField, integerField, isRecord, toDiagnosticValue, } from "./gltf-accessor-validation-utils.js";
export function validateBufferView(context, primitive, input, bufferViewIndex) {
    const bufferViews = arrayField(context.root, "bufferViews");
    const bufferView = bufferViews?.[bufferViewIndex];
    if (!isRecord(bufferView)) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.invalidBufferView",
            bufferViewIndex,
            field: `bufferViews[${bufferViewIndex}]`,
            value: toDiagnosticValue(bufferView),
            message: `bufferView ${bufferViewIndex} is missing or malformed.`,
        });
        return null;
    }
    const bufferIndex = integerField(bufferView.buffer);
    const byteOffset = integerField(bufferView.byteOffset ?? 0);
    const byteLength = integerField(bufferView.byteLength);
    const byteStride = bufferView.byteStride === undefined
        ? null
        : integerField(bufferView.byteStride);
    if (bufferIndex === null ||
        byteOffset === null ||
        byteLength === null ||
        byteOffset < 0 ||
        byteLength < 0 ||
        (byteStride !== null && byteStride <= 0)) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.invalidBufferView",
            bufferViewIndex,
            field: `bufferViews[${bufferViewIndex}]`,
            message: `bufferView ${bufferViewIndex} has invalid buffer, byteOffset, byteLength, or byteStride fields.`,
        });
        return null;
    }
    const bufferByteLength = validateBuffer(context, primitive, input, bufferIndex);
    if (bufferByteLength === null) {
        return null;
    }
    if (byteOffset + byteLength > bufferByteLength) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.bufferRangeOutOfBounds",
            bufferViewIndex,
            bufferIndex,
            byteOffset,
            byteLength,
            requiredByteLength: byteOffset + byteLength,
            field: `bufferViews[${bufferViewIndex}]`,
            message: `bufferView ${bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
        });
        return null;
    }
    return { bufferIndex, byteOffset, byteLength, byteStride };
}
function validateBuffer(context, primitive, input, bufferIndex) {
    const buffers = arrayField(context.root, "buffers");
    const buffer = buffers?.[bufferIndex];
    if (!isRecord(buffer)) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.invalidBuffer",
            bufferIndex,
            field: `buffers[${bufferIndex}]`,
            value: toDiagnosticValue(buffer),
            message: `buffer ${bufferIndex} is missing or malformed.`,
        });
        return null;
    }
    const declaredByteLength = integerField(buffer.byteLength);
    if (declaredByteLength === null || declaredByteLength < 0) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.invalidBuffer",
            bufferIndex,
            field: `buffers[${bufferIndex}].byteLength`,
            value: toDiagnosticValue(buffer.byteLength),
            message: `buffer ${bufferIndex} has an invalid byteLength.`,
        });
        return null;
    }
    if (typeof buffer.uri === "string" &&
        !context.options.externalBufferByteLengths?.has(bufferIndex)) {
        pushAccessorValidationDiagnostic(context, primitive, input, {
            code: "gltfAccessor.externalBufferUnresolved",
            severity: "warning",
            bufferIndex,
            field: `buffers[${bufferIndex}].uri`,
            message: `buffer ${bufferIndex} is external and has no caller-provided resolved byte length.`,
        });
    }
    const externalLength = context.options.externalBufferByteLengths?.get(bufferIndex);
    const binaryLength = typeof buffer.uri === "string"
        ? undefined
        : context.options.binaryChunkByteLength;
    return Math.min(declaredByteLength, externalLength ?? binaryLength ?? declaredByteLength);
}
//# sourceMappingURL=gltf-accessor-validation-buffers.js.map