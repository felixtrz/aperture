import {
  createPrefabHandle,
  type ApertureSceneDocument,
  type AssetRegistry,
  type PrefabHandle,
} from "@aperture-engine/simulation";

// M7-T5: register an ApertureSceneDocument-shaped prefab blueprint in the asset
// registry under a PrefabHandle so spawn.prefab(handle, ...) can instantiate it.

export interface PrefabRegisterOptions {
  /** Explicit handle id; defaults to a generated unique id. */
  readonly id?: string;
  readonly label?: string;
}

export interface PrefabAccess {
  register(
    document: ApertureSceneDocument,
    options?: PrefabRegisterOptions,
  ): PrefabHandle;
}

export function createPrefabAccess(registry: AssetRegistry): PrefabAccess {
  let counter = 0;

  return {
    register(document, options = {}) {
      counter += 1;
      const id = options.id ?? `aperture.prefab.${counter}`;
      const handle = createPrefabHandle(id);
      if (!registry.has(handle)) {
        registry.register(
          handle,
          options.label === undefined ? {} : { label: options.label },
        );
      }
      registry.markReady(handle, document);
      return handle;
    },
  };
}
