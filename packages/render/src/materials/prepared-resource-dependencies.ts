import { assetHandleKey, type AssetHandle } from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
import type { MaterialAsset } from "./types.js";
import type { PreparedMaterialTextureBindingResource } from "./prepared-resource-types.js";

export function collectMaterialDependencyKeys(
  material: MaterialAsset,
): readonly string[] {
  const dependencyKeys: string[] = [];
  const seen = new Set<string>();

  for (const [, binding] of materialTextureBindings(material)) {
    appendDependencyKey(binding.texture, dependencyKeys, seen);
    appendDependencyKey(binding.sampler, dependencyKeys, seen);
  }

  return dependencyKeys;
}

export function collectTextureBindingResources(
  material: MaterialAsset,
): readonly PreparedMaterialTextureBindingResource[] {
  const resources: PreparedMaterialTextureBindingResource[] = [];

  for (const [field, binding] of materialTextureBindings(material)) {
    if (binding.texture === null || binding.sampler === null) {
      continue;
    }

    resources.push({
      field,
      textureKey: assetHandleKey(binding.texture),
      samplerKey: assetHandleKey(binding.sampler),
      ...(binding.texCoord === undefined ? {} : { texCoord: binding.texCoord }),
    });
  }

  return resources;
}

function appendDependencyKey(
  handle: AssetHandle | null,
  dependencyKeys: string[],
  seen: Set<string>,
): void {
  if (handle === null) {
    return;
  }

  const key = assetHandleKey(handle);

  if (!seen.has(key)) {
    seen.add(key);
    dependencyKeys.push(key);
  }
}
