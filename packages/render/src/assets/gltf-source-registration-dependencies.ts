import {
  assetHandleKey,
  type AssetDiagnostic,
  type AssetHandle,
} from "@aperture-engine/simulation";

import { materialTextureBindings } from "../materials/bindings.js";
import type { MaterialAsset } from "../materials/index.js";
import type {
  GltfAssetMappingReport,
  GltfPlannedSamplerAsset,
  GltfPlannedTextureAsset,
} from "./gltf-asset-mapping.js";

export function gltfMaterialDependencyHandles(
  material: MaterialAsset,
): readonly AssetHandle[] {
  const dependencies: AssetHandle[] = [];
  const seen = new Set<string>();

  for (const [, binding] of materialTextureBindings(material)) {
    appendDependency(dependencies, seen, binding.texture);
    appendDependency(dependencies, seen, binding.sampler);
  }

  return dependencies;
}

export function findGltfPlannedTextureForSampler(
  report: GltfAssetMappingReport,
  sampler: GltfPlannedSamplerAsset,
): GltfPlannedTextureAsset | undefined {
  return report.textures.find(
    (texture) =>
      texture.textureIndex === sampler.textureIndex &&
      texture.slot === sampler.slot,
  );
}

export function assetDiagnosticsFromGltfMappingDiagnostics(
  diagnostics: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: "error" | "warning";
  }[],
): readonly AssetDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
  }));
}

export function materialIdFromGltfPlannedHandleKey(handleKey: string): string {
  const prefix = "material:";
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

function appendDependency(
  dependencies: AssetHandle[],
  seen: Set<string>,
  handle: AssetHandle | null,
): void {
  if (handle === null) {
    return;
  }

  const key = assetHandleKey(handle);
  if (!seen.has(key)) {
    seen.add(key);
    dependencies.push(handle);
  }
}
