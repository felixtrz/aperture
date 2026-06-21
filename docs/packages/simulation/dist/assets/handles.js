import { ASSET_KINDS } from "./types.js";
export function createAssetHandle(kind, id) {
    if (!isAssetKind(kind)) {
        throw new RangeError(`Unsupported asset kind '${kind}'.`);
    }
    if (id.trim().length === 0) {
        throw new RangeError("Asset handle id must be a non-empty string.");
    }
    return Object.freeze({ kind, id });
}
export function createMeshHandle(id) {
    return createAssetHandle("mesh", id);
}
export function createMaterialHandle(id) {
    return createAssetHandle("material", id);
}
export function createTextureHandle(id) {
    return createAssetHandle("texture", id);
}
export function createSamplerHandle(id) {
    return createAssetHandle("sampler", id);
}
export function createRenderTargetHandle(id) {
    return createAssetHandle("render-target", id);
}
export function createSceneHandle(id) {
    return createAssetHandle("scene", id);
}
export function createPrefabHandle(id) {
    return createAssetHandle("prefab", id);
}
export function createAnimationClipHandle(id) {
    return createAssetHandle("animation-clip", id);
}
export function createSkinHandle(id) {
    return createAssetHandle("skin", id);
}
export function createMorphTargetSetHandle(id) {
    return createAssetHandle("morph-target-set", id);
}
export function createEnvironmentMapHandle(id) {
    return createAssetHandle("environment-map", id);
}
export function createShaderHandle(id) {
    return createAssetHandle("shader", id);
}
export function createFontAtlasHandle(id) {
    return createAssetHandle("font-atlas", id);
}
export function createParticleEffectHandle(id) {
    return createAssetHandle("particle-effect", id);
}
export function createAudioClipHandle(id) {
    return createAssetHandle("audio-clip", id);
}
export function assetHandleKey(handle) {
    return `${handle.kind}:${handle.id}`;
}
export function assetHandlesEqual(a, b) {
    return a !== undefined && a !== null && b !== undefined && b !== null
        ? a.kind === b.kind && a.id === b.id
        : a === b;
}
export function serializeAssetHandle(handle) {
    return { kind: handle.kind, id: handle.id };
}
export function deserializeAssetHandle(serialized) {
    return createAssetHandle(serialized.kind, serialized.id);
}
export function isAssetKind(value) {
    return ASSET_KINDS.includes(value);
}
//# sourceMappingURL=handles.js.map