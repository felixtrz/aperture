import { type AssetRegistry, type AssetStatus } from "@aperture-engine/simulation";
import type { StandardMaterialAsset } from "@aperture-engine/render";
export type StandardTextureDependencyField = "baseColorTexture" | "metallicRoughnessTexture" | "clearcoatTexture" | "clearcoatRoughnessTexture" | "transmissionTexture" | "sheenColorTexture" | "sheenRoughnessTexture" | "iridescenceTexture" | "iridescenceThicknessTexture" | "normalTexture" | "occlusionTexture" | "emissiveTexture";
export type StandardMaterialTextureBinding = NonNullable<StandardMaterialAsset[StandardTextureDependencyField]>;
export interface PreparedStandardTextureDependencyVersionKey {
    readonly field: StandardTextureDependencyField;
    readonly kind: "texture" | "sampler";
    readonly handleKey: string;
    readonly version: number;
    readonly versionKey: string;
}
export interface PreparedStandardTextureBindingDependencyKeys {
    readonly field: StandardTextureDependencyField;
    readonly texture: PreparedStandardTextureDependencyVersionKey;
    readonly sampler: PreparedStandardTextureDependencyVersionKey;
    readonly cacheKeySegments: readonly string[];
}
export interface PreparedStandardTextureDependencyKeys {
    readonly bindings: readonly PreparedStandardTextureBindingDependencyKeys[];
    readonly cacheKeySegments: readonly string[];
}
export type PreparedStandardTextureDependencyDiagnostic = {
    readonly code: "preparedStandardTextureDependency.missingTextureHandle" | "preparedStandardTextureDependency.missingSamplerHandle";
    readonly message: string;
    readonly field: `${StandardTextureDependencyField}.texture` | `${StandardTextureDependencyField}.sampler`;
} | {
    readonly code: "preparedStandardTextureDependency.textureSourceNotReady" | "preparedStandardTextureDependency.samplerSourceNotReady";
    readonly message: string;
    readonly field: StandardTextureDependencyField;
    readonly resourceKey: string;
    readonly status: AssetStatus | "missing";
};
export interface CreatePreparedStandardBaseColorTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardBaseColorTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardNormalTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardNormalTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardClearcoatTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardClearcoatTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardTransmissionTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardTransmissionTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardSheenColorTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardSheenColorTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardIridescenceTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardIridescenceTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureBindingDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export interface CreatePreparedStandardTextureDependencyKeysOptions {
    readonly registry: AssetRegistry;
    readonly material: StandardMaterialAsset;
}
export interface CreatePreparedStandardTextureDependencyKeysResult {
    readonly valid: boolean;
    readonly dependencies: PreparedStandardTextureDependencyKeys | null;
    readonly diagnostics: readonly PreparedStandardTextureDependencyDiagnostic[];
}
export declare function createPreparedStandardTextureDependencyKeys(options: CreatePreparedStandardTextureDependencyKeysOptions): CreatePreparedStandardTextureDependencyKeysResult;
export declare function createPreparedStandardBaseColorTextureDependencyKeys(options: CreatePreparedStandardBaseColorTextureDependencyKeysOptions): CreatePreparedStandardBaseColorTextureDependencyKeysResult;
export declare function createPreparedStandardMetallicRoughnessTextureDependencyKeys(options: CreatePreparedStandardMetallicRoughnessTextureDependencyKeysOptions): CreatePreparedStandardMetallicRoughnessTextureDependencyKeysResult;
export declare function createPreparedStandardNormalTextureDependencyKeys(options: CreatePreparedStandardNormalTextureDependencyKeysOptions): CreatePreparedStandardNormalTextureDependencyKeysResult;
export declare function createPreparedStandardClearcoatTextureDependencyKeys(options: CreatePreparedStandardClearcoatTextureDependencyKeysOptions): CreatePreparedStandardClearcoatTextureDependencyKeysResult;
export declare function createPreparedStandardClearcoatRoughnessTextureDependencyKeys(options: CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysOptions): CreatePreparedStandardClearcoatRoughnessTextureDependencyKeysResult;
export declare function createPreparedStandardTransmissionTextureDependencyKeys(options: CreatePreparedStandardTransmissionTextureDependencyKeysOptions): CreatePreparedStandardTransmissionTextureDependencyKeysResult;
export declare function createPreparedStandardSheenColorTextureDependencyKeys(options: CreatePreparedStandardSheenColorTextureDependencyKeysOptions): CreatePreparedStandardSheenColorTextureDependencyKeysResult;
export declare function createPreparedStandardSheenRoughnessTextureDependencyKeys(options: CreatePreparedStandardSheenRoughnessTextureDependencyKeysOptions): CreatePreparedStandardSheenRoughnessTextureDependencyKeysResult;
export declare function createPreparedStandardIridescenceTextureDependencyKeys(options: CreatePreparedStandardIridescenceTextureDependencyKeysOptions): CreatePreparedStandardIridescenceTextureDependencyKeysResult;
export declare function createPreparedStandardIridescenceThicknessTextureDependencyKeys(options: CreatePreparedStandardIridescenceThicknessTextureDependencyKeysOptions): CreatePreparedStandardIridescenceThicknessTextureDependencyKeysResult;
export declare function createPreparedStandardTextureBindingDependencyKeys(options: {
    readonly registry: AssetRegistry;
    readonly field: StandardTextureDependencyField;
    readonly binding: StandardMaterialTextureBinding;
}): CreatePreparedStandardBaseColorTextureDependencyKeysResult;
export declare function standardTextureBinding(material: StandardMaterialAsset, field: StandardTextureDependencyField): StandardMaterialTextureBinding | null;
//# sourceMappingURL=prepared-standard-material-dependencies.d.ts.map