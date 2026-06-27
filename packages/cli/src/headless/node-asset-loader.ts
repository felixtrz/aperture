import type {
  ApertureAssetLoader,
  SystemAssetHandle,
  SystemAssetKind,
} from "@aperture-engine/app/systems";

export interface PlaceholderedAsset {
  readonly id: string;
  readonly kind: SystemAssetKind;
}

export interface NodeApertureAssetLoaderResult {
  readonly loader: ApertureAssetLoader;
  /** Assets fulfilled with a placeholder payload (read after boot for warnings). */
  readonly placeholdered: readonly PlaceholderedAsset[];
}

export type NodeAssetLoaderMode = "placeholder";

// In pure Node there is no `globalThis.location` to resolve root-relative asset
// URLs (`/assets/cube.glb` → `aperture.asset.invalidUrl`) and no image decoder
// to turn texture bytes into pixels. The headless loop is about ECS/sim
// structure, not pixels, so this loader fulfils every requested asset with a
// placeholder: its `load()` is a no-op, and the asset system then marks the
// handle ready with a structural placeholder payload (see
// packages/app/src/systems/assets.ts — the post-load `markReady` fallback).
// Boot never crashes; the snapshot carries valid asset handles; real pixels for
// external/texture assets are deferred to the browser render command (Track 2).
export function createNodeApertureAssetLoader(
  options: { readonly mode?: NodeAssetLoaderMode } = {},
): NodeApertureAssetLoaderResult {
  void options.mode;
  const placeholdered: PlaceholderedAsset[] = [];

  const loader: ApertureAssetLoader = {
    async load(
      handle: SystemAssetHandle<SystemAssetKind>,
    ): Promise<void> {
      placeholdered.push({ id: handle.id, kind: handle.kind });
    },
  };

  return { loader, placeholdered };
}
