import type {
  ApertureAssetLoader,
  ApertureAssetLoadResult,
  SystemAssetHandle,
  SystemAssetKind,
} from "@aperture-engine/app/systems";

export type NodeAssetLoaderMode = "placeholder";

// In pure Node there is no `globalThis.location` to resolve root-relative asset
// URLs (`/assets/cube.glb` → `aperture.asset.invalidUrl`) and no image decoder
// to turn texture bytes into pixels. The headless loop is about ECS/sim
// structure, not pixels, so this loader fulfils every requested asset with a
// placeholder: its `load()` is a no-op that DECLARES the asset placeholdered, so
// the asset system marks the registry entry with `provenance: "placeholder"`.
// Boot never crashes; the snapshot carries valid asset handles; provenance lets
// downstream tooling tell a stubbed render from a real one.
export function createNodeApertureAssetLoader(
  options: { readonly mode?: NodeAssetLoaderMode } = {},
): ApertureAssetLoader {
  void options.mode;

  return {
    async load(
      _handle: SystemAssetHandle<SystemAssetKind>,
    ): Promise<ApertureAssetLoadResult> {
      return { placeholder: true };
    },
  };
}
