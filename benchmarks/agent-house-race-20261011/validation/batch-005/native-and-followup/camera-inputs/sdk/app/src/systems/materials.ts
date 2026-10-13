import {
  patchMatcapMaterial,
  patchStandardMaterial,
  patchUnlitMaterial,
  type MaterialAsset,
  type StandardMaterialPatch,
} from "@aperture-engine/render";
import type {
  AssetRegistry,
  MaterialHandle,
} from "@aperture-engine/simulation";

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
  get(handle: MaterialHandle): MaterialAsset | undefined;
  set(handle: MaterialHandle, patch: MaterialPatch): MaterialSetResult;
}

export function createMaterialAccess(registry: AssetRegistry): MaterialAccess {
  return {
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
