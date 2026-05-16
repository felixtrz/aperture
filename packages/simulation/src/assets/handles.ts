import { ASSET_KINDS, type AssetHandle, type AssetKind } from "./types.js";
import type {
  AnimationClipHandle,
  EnvironmentMapHandle,
  MaterialHandle,
  MeshHandle,
  MorphTargetSetHandle,
  PrefabHandle,
  RenderTargetHandle,
  SamplerHandle,
  SceneHandle,
  SerializedAssetHandle,
  SkinHandle,
  TextureHandle,
} from "./types.js";

export function createAssetHandle<TKind extends AssetKind>(
  kind: TKind,
  id: string,
): AssetHandle<TKind> {
  if (!isAssetKind(kind)) {
    throw new RangeError(`Unsupported asset kind '${kind}'.`);
  }

  if (id.trim().length === 0) {
    throw new RangeError("Asset handle id must be a non-empty string.");
  }

  return Object.freeze({ kind, id }) as AssetHandle<TKind>;
}

export function createMeshHandle(id: string): MeshHandle {
  return createAssetHandle("mesh", id);
}

export function createMaterialHandle(id: string): MaterialHandle {
  return createAssetHandle("material", id);
}

export function createTextureHandle(id: string): TextureHandle {
  return createAssetHandle("texture", id);
}

export function createSamplerHandle(id: string): SamplerHandle {
  return createAssetHandle("sampler", id);
}

export function createRenderTargetHandle(id: string): RenderTargetHandle {
  return createAssetHandle("render-target", id);
}

export function createSceneHandle(id: string): SceneHandle {
  return createAssetHandle("scene", id);
}

export function createPrefabHandle(id: string): PrefabHandle {
  return createAssetHandle("prefab", id);
}

export function createAnimationClipHandle(id: string): AnimationClipHandle {
  return createAssetHandle("animation-clip", id);
}

export function createSkinHandle(id: string): SkinHandle {
  return createAssetHandle("skin", id);
}

export function createMorphTargetSetHandle(id: string): MorphTargetSetHandle {
  return createAssetHandle("morph-target-set", id);
}

export function createEnvironmentMapHandle(id: string): EnvironmentMapHandle {
  return createAssetHandle("environment-map", id);
}

export function assetHandleKey(handle: AssetHandle): string {
  return `${handle.kind}:${handle.id}`;
}

export function assetHandlesEqual(
  a: AssetHandle | null | undefined,
  b: AssetHandle | null | undefined,
): boolean {
  return a !== undefined && a !== null && b !== undefined && b !== null
    ? a.kind === b.kind && a.id === b.id
    : a === b;
}

export function serializeAssetHandle<TKind extends AssetKind>(
  handle: AssetHandle<TKind>,
): SerializedAssetHandle<TKind> {
  return { kind: handle.kind, id: handle.id };
}

export function deserializeAssetHandle<TKind extends AssetKind>(
  serialized: SerializedAssetHandle<TKind>,
): AssetHandle<TKind> {
  return createAssetHandle(serialized.kind, serialized.id);
}

export function isAssetKind(value: string): value is AssetKind {
  return ASSET_KINDS.includes(value as AssetKind);
}
