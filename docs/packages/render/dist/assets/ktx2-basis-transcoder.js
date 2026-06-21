import { KTX2_SUPERCOMPRESSION_BASIS_LZ, KTX2_VK_FORMAT_UNDEFINED, } from "./ktx2-constants.js";
import { parseKtx2Container } from "./ktx2-container.js";
import { loadBasisUniversalKtx2Module } from "./ktx2-basis-module.js";
import { chooseBasisKtx2TranscodeTarget, textureFormatFromDfdTransfer, textureLevelBytesPerRow, textureLevelRowsPerImage, } from "./ktx2-basis-targets.js";
import { bytesView } from "./ktx2-utils.js";
export async function createBasisUniversalKtx2Transcoder(source) {
    const basisModule = await loadBasisUniversalKtx2Module(source);
    return {
        decode(sourceBytes, options = {}) {
            return transcodeBasisKtx2TextureData(sourceBytes, basisModule, options);
        },
    };
}
function transcodeBasisKtx2TextureData(source, basisModule, options) {
    const bytes = bytesView(source);
    const container = parseKtx2Container(bytes);
    if (container.supercompressionScheme !== KTX2_SUPERCOMPRESSION_BASIS_LZ ||
        container.vkFormat !== KTX2_VK_FORMAT_UNDEFINED) {
        throw new Error("KTX2 payload is not BasisU supercompressed texture data.");
    }
    const ktx2File = new basisModule.KTX2File(new Uint8Array(bytes));
    try {
        if (!ktx2File.isValid()) {
            throw new Error("BasisU KTX2 texture is invalid or unsupported.");
        }
        if (ktx2File.isHDR?.() === true) {
            throw new Error("BasisU HDR KTX2 textures are not supported by the built-in transcoder.");
        }
        const encoding = basisKtx2Encoding(ktx2File);
        const width = ktx2File.getWidth();
        const height = ktx2File.getHeight();
        const levels = ktx2File.getLevels();
        const faces = ktx2File.getFaces();
        const layers = ktx2File.getLayers() || 1;
        const hasAlpha = ktx2File.getHasAlpha() !== 0;
        const target = chooseBasisKtx2TranscodeTarget({
            encoding,
            width,
            height,
            hasAlpha,
            srgb: textureFormatFromDfdTransfer(container, bytes).endsWith("-srgb"),
            ...(options.textureCompression === undefined
                ? {}
                : { textureCompression: options.textureCompression }),
        });
        if (width <= 0 || height <= 0 || levels <= 0) {
            throw new Error("BasisU KTX2 texture dimensions are invalid.");
        }
        if (faces !== 1 || layers !== 1) {
            throw new Error("Only single-layer 2D BasisU KTX2 textures are supported.");
        }
        if (ktx2File.startTranscoding() !== 1) {
            throw new Error("BasisU KTX2 transcoder failed to start.");
        }
        const mipLevels = Array.from({ length: levels }, (_, level) => {
            const levelWidth = mipDimension(width, level);
            const levelHeight = mipDimension(height, level);
            const byteLength = ktx2File.getImageTranscodedSizeInBytes(level, 0, 0, target.transcoderFormat);
            const bytes = new Uint8Array(byteLength);
            const ok = ktx2File.transcodeImage(bytes, level, 0, 0, target.transcoderFormat, 0, -1, -1);
            if (ok !== 1) {
                throw new Error(`BasisU KTX2 level ${level} transcode failed.`);
            }
            return {
                bytes,
                bytesPerRow: textureLevelBytesPerRow(levelWidth, target),
                rowsPerImage: textureLevelRowsPerImage(levelHeight, target),
                width: levelWidth,
                height: levelHeight,
            };
        });
        const level0 = mipLevels[0];
        if (level0 === undefined) {
            throw new Error("BasisU KTX2 texture did not transcode any levels.");
        }
        return {
            width,
            height,
            format: target.textureFormat,
            sourceData: {
                bytes: level0.bytes,
                bytesPerRow: level0.bytesPerRow,
                rowsPerImage: level0.rowsPerImage,
                ...(mipLevels.length <= 1 ? {} : { mipLevels }),
            },
        };
    }
    finally {
        ktx2File.close();
        ktx2File.delete();
    }
}
function mipDimension(base, level) {
    return Math.max(1, base >> level);
}
function basisKtx2Encoding(ktx2File) {
    if (ktx2File.isETC1S?.() === true) {
        return "etc1s";
    }
    if (ktx2File.isUASTC?.() === true) {
        return "uastc";
    }
    throw new Error("BasisU KTX2 texture uses an unknown Basis encoding.");
}
//# sourceMappingURL=ktx2-basis-transcoder.js.map