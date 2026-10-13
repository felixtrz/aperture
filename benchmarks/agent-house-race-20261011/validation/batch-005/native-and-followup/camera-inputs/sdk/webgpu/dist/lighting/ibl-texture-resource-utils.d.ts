import type { PmremComputeStorageFormat } from "./pmrem-compute-pipeline.js";
import type { CreateTextureGpuResourceResult } from "../resources/textures/texture-resources.js";
export declare function createDefaultDiffuseIblUpload(size: number, format: string): {
    data: Uint8Array<ArrayBuffer>;
    bytesPerRow: number;
    rowsPerImage: number;
};
export declare function createDefaultSpecularIblUpload(size: number, format: string): {
    data: Uint8Array<ArrayBuffer>;
    bytesPerRow: number;
    rowsPerImage: number;
};
export declare function createPaddedCubeFaceUpload(face: Uint8Array, faceSize: number, format: PmremComputeStorageFormat): {
    readonly data: Uint8Array;
    readonly bytesPerRow: number;
};
export declare function createCubeFacesUpload(faces: readonly Uint8Array[], faceSize: number, format: PmremComputeStorageFormat): {
    readonly data: Uint8Array;
    readonly bytesPerRow: number;
    readonly rowsPerImage: number;
};
export declare function bytesPerPixelForPmremFormat(format: PmremComputeStorageFormat): number | null;
export declare function missingTextureResult(): CreateTextureGpuResourceResult;
export declare function mipLevelCountForSize(size: number): number;
//# sourceMappingURL=ibl-texture-resource-utils.d.ts.map