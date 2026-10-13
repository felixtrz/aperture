import type { TextureAsset } from "./types.js";
import type { StandardMaterialTextureExpectation, StandardMaterialTextureField, StandardMaterialTextureReadinessDiagnostic, StandardMaterialTextureReadinessSlot } from "./standard-texture-readiness-types.js";
export declare function inspectReadyStandardTexture(input: {
    readonly materialKey: string;
    readonly textureKey: string;
    readonly texture: TextureAsset;
    readonly expectation: StandardMaterialTextureExpectation;
    readonly texCoord: number;
    readonly slots: StandardMaterialTextureReadinessSlot[];
    readonly diagnostics: StandardMaterialTextureReadinessDiagnostic[];
}): void;
export declare function pushUnsupportedStandardTexCoordDiagnostic(input: {
    readonly materialKey: string;
    readonly textureKey?: string;
    readonly field: StandardMaterialTextureField;
    readonly expectation: StandardMaterialTextureExpectation;
    readonly texCoord: number;
    readonly diagnostics: StandardMaterialTextureReadinessDiagnostic[];
}): void;
//# sourceMappingURL=standard-texture-readiness-texture.d.ts.map