export function createDefaultDiffuseIblUpload(size, format) {
    const bytesPerPixel = format === "rgba16float" ? 8 : 4;
    const bytesPerRow = size * bytesPerPixel;
    const data = new Uint8Array(bytesPerRow * size * 6);
    if (bytesPerPixel === 8) {
        for (let index = 0; index < data.length; index += 8) {
            data[index] = 0x00;
            data[index + 1] = 0x38;
            data[index + 2] = 0x00;
            data[index + 3] = 0x38;
            data[index + 4] = 0x00;
            data[index + 5] = 0x38;
            data[index + 6] = 0x00;
            data[index + 7] = 0x3c;
        }
    }
    else {
        for (let index = 0; index < data.length; index += 4) {
            data[index] = 128;
            data[index + 1] = 144;
            data[index + 2] = 168;
            data[index + 3] = 255;
        }
    }
    return {
        data,
        bytesPerRow,
        rowsPerImage: size,
    };
}
export function createDefaultSpecularIblUpload(size, format) {
    const upload = createDefaultDiffuseIblUpload(size, format);
    if (format === "rgba16float") {
        for (let index = 0; index < upload.data.length; index += 8) {
            upload.data[index] = 0x00;
            upload.data[index + 1] = 0x34;
            upload.data[index + 2] = 0x00;
            upload.data[index + 3] = 0x34;
            upload.data[index + 4] = 0x00;
            upload.data[index + 5] = 0x34;
            upload.data[index + 6] = 0x00;
            upload.data[index + 7] = 0x3c;
        }
    }
    return upload;
}
export function createPaddedCubeFaceUpload(face, faceSize, format) {
    const bytesPerPixel = bytesPerPixelForPmremFormat(format) ?? 4;
    const sourceBytesPerRow = faceSize * bytesPerPixel;
    const bytesPerRow = alignTo(sourceBytesPerRow, 256);
    const data = new Uint8Array(bytesPerRow * faceSize);
    for (let y = 0; y < faceSize; y += 1) {
        data.set(face.subarray(y * sourceBytesPerRow, (y + 1) * sourceBytesPerRow), y * bytesPerRow);
    }
    return { data, bytesPerRow };
}
export function createCubeFacesUpload(faces, faceSize, format) {
    const bytesPerPixel = bytesPerPixelForPmremFormat(format) ?? 4;
    const sourceBytesPerRow = faceSize * bytesPerPixel;
    const bytesPerRow = alignTo(sourceBytesPerRow, 256);
    const data = new Uint8Array(bytesPerRow * faceSize * faces.length);
    for (let layer = 0; layer < faces.length; layer += 1) {
        const face = faces[layer];
        if (face === undefined) {
            continue;
        }
        for (let y = 0; y < faceSize; y += 1) {
            data.set(face.subarray(y * sourceBytesPerRow, (y + 1) * sourceBytesPerRow), layer * bytesPerRow * faceSize + y * bytesPerRow);
        }
    }
    return { data, bytesPerRow, rowsPerImage: faceSize };
}
export function bytesPerPixelForPmremFormat(format) {
    switch (format) {
        case "rgba8unorm":
            return 4;
        case "rgba16float":
            return 8;
        default:
            return null;
    }
}
function alignTo(value, alignment) {
    return Math.ceil(value / alignment) * alignment;
}
export function missingTextureResult() {
    return {
        valid: false,
        resource: null,
        diagnostics: [],
    };
}
export function mipLevelCountForSize(size) {
    return Math.max(1, 1 + Math.floor(Math.log2(Math.max(1, size))));
}
//# sourceMappingURL=ibl-texture-resource-utils.js.map