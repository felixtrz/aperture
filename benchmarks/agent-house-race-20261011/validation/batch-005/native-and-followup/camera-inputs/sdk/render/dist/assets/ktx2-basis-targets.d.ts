import type { TextureFormat } from "../materials/index.js";
import type { BasisKtx2Encoding, BasisKtx2TranscodeTarget, Ktx2ContainerInfo, Ktx2TextureCompressionSupport } from "./ktx2-types.js";
export declare function chooseBasisKtx2TranscodeTarget(input: {
    readonly encoding: BasisKtx2Encoding;
    readonly width: number;
    readonly height: number;
    readonly hasAlpha: boolean;
    readonly srgb: boolean;
    readonly textureCompression?: Ktx2TextureCompressionSupport;
}): BasisKtx2TranscodeTarget;
export declare function textureLevelBytesPerRow(width: number, target: BasisKtx2TranscodeTarget): number;
export declare function textureLevelRowsPerImage(height: number, target: BasisKtx2TranscodeTarget): number;
export declare function textureFormatFromDfdTransfer(container: Ktx2ContainerInfo, bytes: Uint8Array): TextureFormat;
//# sourceMappingURL=ktx2-basis-targets.d.ts.map