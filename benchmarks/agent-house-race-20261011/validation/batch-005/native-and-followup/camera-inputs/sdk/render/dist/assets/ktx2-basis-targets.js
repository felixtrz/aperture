import { BASIS_TRANSCODER_FORMAT_ASTC_4X4, BASIS_TRANSCODER_FORMAT_BC7_M5, BASIS_TRANSCODER_FORMAT_ETC1, BASIS_TRANSCODER_FORMAT_ETC2, BASIS_TRANSCODER_FORMAT_RGBA32, KHR_DF_TRANSFER_SRGB, } from "./ktx2-constants.js";
export function chooseBasisKtx2TranscodeTarget(input) {
    const support = input.textureCompression ?? {};
    const compressedCandidates = input.encoding === "uastc"
        ? [
            support.astc === true ? astc4x4Target(input.srgb) : null,
            support.bc === true ? bc7Target(input.srgb) : null,
            support.etc2 === true ? etc2Target(input.hasAlpha, input.srgb) : null,
        ]
        : [
            support.etc2 === true ? etc2Target(input.hasAlpha, input.srgb) : null,
            support.bc === true ? bc7Target(input.srgb) : null,
            support.astc === true ? astc4x4Target(input.srgb) : null,
        ];
    for (const candidate of compressedCandidates) {
        if (candidate !== null && textureDimensionsFitTarget(input, candidate)) {
            return candidate;
        }
    }
    return rgba32Target(input.srgb);
}
export function textureLevelBytesPerRow(width, target) {
    return Math.ceil(width / target.blockWidth) * target.blockByteLength;
}
export function textureLevelRowsPerImage(height, target) {
    return Math.ceil(height / target.blockHeight);
}
export function textureFormatFromDfdTransfer(container, bytes) {
    return ktx2DfdTransferFunction(container, bytes) === KHR_DF_TRANSFER_SRGB
        ? "rgba8unorm-srgb"
        : "rgba8unorm";
}
function rgba32Target(srgb) {
    return {
        transcoderFormat: BASIS_TRANSCODER_FORMAT_RGBA32,
        textureFormat: srgb ? "rgba8unorm-srgb" : "rgba8unorm",
        blockWidth: 1,
        blockHeight: 1,
        blockByteLength: 4,
    };
}
function etc2Target(hasAlpha, srgb) {
    return hasAlpha
        ? {
            transcoderFormat: BASIS_TRANSCODER_FORMAT_ETC2,
            textureFormat: srgb ? "etc2-rgba8unorm-srgb" : "etc2-rgba8unorm",
            blockWidth: 4,
            blockHeight: 4,
            blockByteLength: 16,
        }
        : {
            transcoderFormat: BASIS_TRANSCODER_FORMAT_ETC1,
            textureFormat: srgb ? "etc2-rgb8unorm-srgb" : "etc2-rgb8unorm",
            blockWidth: 4,
            blockHeight: 4,
            blockByteLength: 8,
        };
}
function bc7Target(srgb) {
    return {
        transcoderFormat: BASIS_TRANSCODER_FORMAT_BC7_M5,
        textureFormat: srgb ? "bc7-rgba-unorm-srgb" : "bc7-rgba-unorm",
        blockWidth: 4,
        blockHeight: 4,
        blockByteLength: 16,
    };
}
function astc4x4Target(srgb) {
    return {
        transcoderFormat: BASIS_TRANSCODER_FORMAT_ASTC_4X4,
        textureFormat: srgb ? "astc-4x4-unorm-srgb" : "astc-4x4-unorm",
        blockWidth: 4,
        blockHeight: 4,
        blockByteLength: 16,
    };
}
function textureDimensionsFitTarget(input, target) {
    if (target.blockWidth === 1 && target.blockHeight === 1) {
        return true;
    }
    return input.width > 0 && input.height > 0;
}
function ktx2DfdTransferFunction(container, bytes) {
    if (container.dfdByteLength < 15) {
        return null;
    }
    const byteOffset = container.dfdByteOffset + 14;
    if (byteOffset >= bytes.byteLength) {
        return null;
    }
    return bytes[byteOffset] ?? null;
}
//# sourceMappingURL=ktx2-basis-targets.js.map