import type { TextureAsset } from "../materials/types.js";
export interface EquirectangularCubeTextureOptions {
    readonly label?: string;
    readonly faceSize?: number;
}
export declare function createEquirectangularCubeTextureAsset(source: TextureAsset, options?: EquirectangularCubeTextureOptions): TextureAsset;
//# sourceMappingURL=equirect-cubemap.d.ts.map