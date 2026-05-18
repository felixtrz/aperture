import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MeshAsset,
  RenderSnapshot,
} from "@aperture-engine/render";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";

export interface QueuedSourceMeshAsset {
  readonly asset: MeshAsset;
  readonly resourceKey: string;
}

export interface QueuedSourceMaterialAsset {
  readonly asset: MaterialAsset;
  readonly kind: string;
  readonly resourceKey: string;
  readonly sourceVersion: number;
}

export function indexQueuedSourceAssets(
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
  output: {
    readonly meshAssets: Map<string, QueuedSourceMeshAsset>;
    readonly materialAssets: Map<string, QueuedSourceMaterialAsset>;
  },
): void {
  output.meshAssets.clear();
  output.materialAssets.clear();

  for (const draw of snapshot.meshDraws) {
    const meshKey = assetHandleKey(draw.mesh);

    if (!output.meshAssets.has(meshKey)) {
      const meshEntry = assets.get<"mesh", MeshAsset>(draw.mesh);

      if (
        meshEntry !== undefined &&
        meshEntry.status === "ready" &&
        meshEntry.asset !== null
      ) {
        output.meshAssets.set(meshKey, {
          asset: meshEntry.asset,
          resourceKey: sourceAssetCacheKey(draw.mesh, meshEntry.version),
        });
      }
    }

    const materialKey = assetHandleKey(draw.material);

    if (output.materialAssets.has(materialKey)) {
      continue;
    }

    const materialEntry = assets.get<"material", MaterialAsset>(draw.material);
    const material = materialEntry?.asset ?? null;

    if (
      materialEntry === undefined ||
      materialEntry.status !== "ready" ||
      material === null
    ) {
      continue;
    }

    output.materialAssets.set(materialKey, {
      asset: material,
      kind: material.kind,
      resourceKey: sourceAssetCacheKey(draw.material, materialEntry.version),
      sourceVersion: materialEntry.version,
    });
  }
}
