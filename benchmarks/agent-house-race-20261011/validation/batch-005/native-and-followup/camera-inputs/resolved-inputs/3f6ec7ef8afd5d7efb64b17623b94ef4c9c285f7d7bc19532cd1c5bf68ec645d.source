export function findTransformPackedOffset(transforms, renderId) {
    for (const offset of transforms.offsets) {
        if (offset.renderId === renderId) {
            return offset.packedOffset;
        }
    }
    return undefined;
}
export function hasTransform(transforms, offset) {
    return (Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length);
}
export function hasTransformRange(floatCount, offset) {
    return Number.isInteger(offset) && offset >= 0 && offset + 16 <= floatCount;
}
export function hasVec4(values, offset) {
    return Number.isInteger(offset) && offset >= 0 && offset + 4 <= values.length;
}
export function findInstanceAttributeField(packet, name) {
    return packet.fields.find((field) => field.name === name);
}
export function hasInstanceAttributeValues(values, field) {
    return (Number.isInteger(field.offset) &&
        field.offset >= 0 &&
        field.offset + field.components <= values.length);
}
export function missingTransformDiagnostic(draw, transforms) {
    return {
        code: "renderTransformPack.missingTransform",
        message: `Render id ${draw.renderId} references transform offset ${draw.worldTransformOffset}, but transform buffer length is ${transforms.length}.`,
        severity: "warning",
        entity: draw.entity,
    };
}
//# sourceMappingURL=transform-pack-guards.js.map