import { createTextureAsset } from "../materials/factories.js";
export function createEquirectangularCubeTextureAsset(source, options = {}) {
    if (source.dimension !== "2d") {
        throw new TypeError("Equirectangular cube source must be a 2D texture.");
    }
    if (source.sourceData === undefined) {
        throw new TypeError("Equirectangular cube source requires texture bytes.");
    }
    if (!isRgba8Format(source.format)) {
        throw new TypeError(`Equirectangular cube source format '${source.format}' is not supported; expected rgba8unorm or rgba8unorm-srgb.`);
    }
    const faceSize = normalizeFaceSize(options.faceSize ?? Math.max(1, Math.floor(source.height / 2)));
    const bytes = new Uint8Array(faceSize * faceSize * 4 * 6);
    for (let face = 0; face < 6; face += 1) {
        for (let y = 0; y < faceSize; y += 1) {
            for (let x = 0; x < faceSize; x += 1) {
                const uv = [(x + 0.5) / faceSize, (y + 0.5) / faceSize];
                const direction = cubeDirection(face, uv);
                const [u, v] = equirectUv(direction);
                const pixel = sampleNearestRgba(source, u, v);
                const dst = face * faceSize * faceSize * 4 + (y * faceSize + x) * 4;
                bytes[dst] = pixel[0];
                bytes[dst + 1] = pixel[1];
                bytes[dst + 2] = pixel[2];
                bytes[dst + 3] = pixel[3];
            }
        }
    }
    return createTextureAsset({
        label: options.label ?? `${source.label} Cubemap`,
        dimension: "cube",
        width: faceSize,
        height: faceSize,
        depthOrLayers: 6,
        format: source.format,
        colorSpace: source.colorSpace,
        semantic: source.semantic,
        usage: ["sampled", "copy-dst"],
        sourceData: {
            bytes,
            bytesPerRow: faceSize * 4,
            rowsPerImage: faceSize,
        },
    });
}
function normalizeFaceSize(value) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError("Equirectangular cube faceSize must be a positive integer.");
    }
    return value;
}
function isRgba8Format(format) {
    return format === "rgba8unorm" || format === "rgba8unorm-srgb";
}
function cubeDirection(face, uv) {
    const x = uv[0] * 2 - 1;
    const y = uv[1] * 2 - 1;
    switch (face) {
        case 0:
            return normalize3([1, -y, -x]);
        case 1:
            return normalize3([-1, -y, x]);
        case 2:
            return normalize3([x, 1, y]);
        case 3:
            return normalize3([x, -1, -y]);
        case 4:
            return normalize3([x, -y, 1]);
        default:
            return normalize3([-x, -y, -1]);
    }
}
function equirectUv(direction) {
    const u = Math.atan2(direction[0], direction[2]) / (Math.PI * 2) + 0.5;
    const v = Math.asin(clamp(direction[1], -1, 1)) / Math.PI + 0.5;
    return [u, v];
}
function sampleNearestRgba(source, u, v) {
    const sourceData = source.sourceData;
    if (sourceData === undefined) {
        return [0, 0, 0, 255];
    }
    const x = clampInt(Math.round(u * (source.width - 1)), 0, source.width - 1);
    const y = clampInt(Math.round(v * (source.height - 1)), 0, source.height - 1);
    const offset = y * sourceData.bytesPerRow + x * 4;
    return [
        sourceData.bytes[offset] ?? 0,
        sourceData.bytes[offset + 1] ?? 0,
        sourceData.bytes[offset + 2] ?? 0,
        sourceData.bytes[offset + 3] ?? 255,
    ];
}
function normalize3(value) {
    const length = Math.hypot(value[0], value[1], value[2]) || 1;
    return [value[0] / length, value[1] / length, value[2] / length];
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function clampInt(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
//# sourceMappingURL=equirect-cubemap.js.map