import type { MaterialTextureTransform, TextureAsset } from "./types.js";
import type { StandardMaterialTextureField } from "./standard-texture-readiness-types.js";
export declare function isIdentityTextureTransform(transform: MaterialTextureTransform): boolean;
export declare function isSupportedStandardTextureTransform(input: {
    readonly field: StandardMaterialTextureField;
    readonly texCoord: number;
    readonly transform: MaterialTextureTransform;
}): boolean;
export declare function textureFormatMatchesColorSpace(texture: TextureAsset): boolean;
export declare function cloneTextureTransform(transform: MaterialTextureTransform): MaterialTextureTransform;
//# sourceMappingURL=standard-texture-readiness-utils.d.ts.map