export function meshLayoutStreamToken(stream) {
    if (isPackedMeshLayoutStream(stream)) {
        return stream.attributes.map(meshLayoutAttributeToken).join(",");
    }
    return [
        `stride=${stream.arrayStride}`,
        ...stream.attributes.map((attribute) => `${meshLayoutAttributeToken(attribute)}@${attribute.offset}`),
    ].join(",");
}
function meshLayoutAttributeToken(attribute) {
    if ((attribute.semantic === "COLOR_0" || attribute.semantic === "WEIGHTS_0") &&
        attribute.format !== "float32x4") {
        return `${attribute.semantic}:${attribute.format}`;
    }
    if (attribute.semantic === "JOINTS_0" && attribute.format !== "uint16x4") {
        return `${attribute.semantic}:${attribute.format}`;
    }
    return attribute.semantic;
}
function isPackedMeshLayoutStream(stream) {
    let offset = 0;
    for (const attribute of stream.attributes) {
        if (attribute.offset !== offset) {
            return false;
        }
        offset += meshVertexFormatByteSize(attribute.format);
    }
    return offset === stream.arrayStride;
}
function meshVertexFormatByteSize(format) {
    switch (format) {
        case "uint8x4":
        case "unorm8x4":
            return 4;
        case "uint16x4":
        case "unorm16x4":
        case "float32x2":
            return 8;
        case "float32x3":
            return 12;
        case "float32x4":
            return 16;
    }
}
//# sourceMappingURL=extraction-mesh-layout.js.map