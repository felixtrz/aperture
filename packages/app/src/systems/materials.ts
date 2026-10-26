import {
  patchMatcapMaterial,
  patchStandardMaterial,
  patchUnlitMaterial,
  type MaterialAsset,
  type StandardMaterialPatch,
} from "@aperture-engine/render";
import {
  materialAssetDependencies,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import { materialDescriptorToAsset } from "./spawn/assets.js";
import type { MaterialDescriptor } from "./spawn/types.js";

// M7-T6: mutate a material's scalar/color uniform parameters at runtime by
// re-registering a patched asset through the versioned asset registry
// (markReady bumps version+1), which rides the version-gated asset mirror so the
// GPU material is re-prepared — no GPU calls and no new handle on the authoring
// side (ECS/worker invariant).

export interface MaterialSetDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export type MaterialSetResult =
  | { readonly ok: true; readonly version: number; readonly kind: string }
  | { readonly ok: false; readonly diagnostic: MaterialSetDiagnostic };

// The standard patch is the superset; unlit/matcap apply only the fields they
// have (mergeMaterialAsset ignores fields the target asset lacks).
export type MaterialPatch = StandardMaterialPatch;

export interface MaterialAccess {
  /**
   * Register (or replace) a named, shareable material and return its handle —
   * the counterpart of creating one three.js material and assigning it to
   * many meshes. Pass the handle as `spawn.mesh({ material })` for every mesh
   * that should share it; `materials.set(handle, patch)` then retints them
   * all at once. Calling create again with the same id publishes a new
   * version under the same handle.
   */
  create(
    id: string | MaterialHandle,
    descriptor: MaterialDescriptor,
  ): MaterialHandle;
  get(handle: MaterialHandle): MaterialAsset | undefined;
  set(handle: MaterialHandle, patch: MaterialPatch): MaterialSetResult;
}

export function createMaterialAccess(registry: AssetRegistry): MaterialAccess {
  return {
    create(id, descriptor) {
      const handle = typeof id === "string" ? createMaterialHandle(id) : id;
      const asset: SourceMaterialAsset = materialDescriptorToAsset(descriptor);
      if (!registry.has(handle)) {
        registry.register(handle, {
          label: asset.label,
          dependencies: materialAssetDependencies(asset),
        });
      }
      registry.markReady(handle, asset);
      return handle;
    },
    get(handle) {
      return (
        registry.get<"material", MaterialAsset>(handle)?.asset ?? undefined
      );
    },
    set(handle, patch) {
      const entry = registry.get<"material", MaterialAsset>(handle);
      if (entry === undefined || entry.asset === null) {
        return {
          ok: false,
          diagnostic: {
            code: "aperture.materials.notReady",
            message: `Material '${handle.id}' is not registered with a ready asset.`,
            data: { handle: handle.id },
          },
        };
      }

      const asset = entry.asset;
      const next = patchByKind(asset, patch);
      if (next === null) {
        return {
          ok: false,
          diagnostic: {
            code: "aperture.materials.unsupportedKind",
            message: `Material '${handle.id}' of kind '${asset.kind}' does not support runtime parameter mutation.`,
            data: { handle: handle.id, kind: asset.kind },
          },
        };
      }

      const updated = registry.markReady<"material", MaterialAsset>(
        handle,
        next,
      );
      return { ok: true, version: updated.version, kind: asset.kind };
    },
  };
}

function patchByKind(
  asset: MaterialAsset,
  patch: MaterialPatch,
): MaterialAsset | null {
  switch (asset.kind) {
    case "standard":
      return patchStandardMaterial(asset, patch);
    case "unlit":
      return patchUnlitMaterial(asset, patch);
    case "matcap":
      return patchMatcapMaterial(asset, patch);
    default:
      return null;
  }
}
