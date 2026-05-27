import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MeshAsset,
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
  RenderSnapshot,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  createMultiMaterialUnlitFrameGpuResources,
  type CreateMultiMaterialUnlitFrameGpuResourcesResult,
} from "../materials/unlit/unlit-frame-resources.js";
import type { WebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import type { WebGpuAppDrawResourceSetPlan } from "./draw-resource-set.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";

interface WebGpuAppMultiUnlitContext {
  readonly initialization: {
    readonly device: unknown;
  };
}

export interface MultiUnlitAppResourceSet {
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly materialKeys: readonly string[];
}

export function createMultiUnlitAppFrameResources(options: {
  readonly app: WebGpuAppMultiUnlitContext;
  readonly mesh: MeshAsset | null;
  readonly materials: readonly UnlitMaterialAsset[];
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
  readonly layouts: WebGpuAppPipelineLayouts;
  readonly reuse: WebGpuAppResourceReuseReport;
}): CreateMultiMaterialUnlitFrameGpuResourcesResult {
  const result = createMultiMaterialUnlitFrameGpuResources({
    device: options.app.initialization.device as Parameters<
      typeof createMultiMaterialUnlitFrameGpuResources
    >[0]["device"],
    mesh: options.mesh,
    materials: options.materials,
    viewUniforms: options.viewUniforms,
    worldTransforms: options.worldTransforms,
    layouts: options.layouts.sharedLayouts,
  });

  if (result.valid && result.resources !== null) {
    options.reuse.meshBuffersCreated += 1;
    options.reuse.materialBuffersCreated += result.resources.materials.length;
    options.reuse.bindGroupsCreated += result.resources.bindGroups.length;
  }

  return result;
}

export function collectMultiUnlitAppResourceSet(options: {
  readonly assets: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly plan: WebGpuAppDrawResourceSetPlan;
  readonly firstDraw: RenderSnapshot["meshDraws"][number];
}): MultiUnlitAppResourceSet | null {
  if (options.plan.sets.length <= 1) {
    return null;
  }

  const meshKey = options.plan.sets[0]?.meshKey;
  const pipelineKey = options.firstDraw.batchKey.pipelineKey;
  const materials: UnlitMaterialAsset[] = [];
  const materialKeys: string[] = [];

  if (meshKey === undefined) {
    return null;
  }

  for (const set of options.plan.sets) {
    if (set.meshKey !== meshKey) {
      return null;
    }

    const firstDrawIndex = set.drawIndices[0];
    const draw =
      firstDrawIndex === undefined
        ? undefined
        : options.snapshot.meshDraws[firstDrawIndex];

    if (draw === undefined || draw.batchKey.pipelineKey !== pipelineKey) {
      return null;
    }

    const entry = options.assets.get<"material", MaterialAsset>(draw.material);

    if (
      entry === undefined ||
      entry.status !== "ready" ||
      entry.asset === null ||
      entry.asset.kind !== "unlit" ||
      entry.asset.baseColorTexture !== null
    ) {
      return null;
    }

    materials.push(entry.asset);
    materialKeys.push(assetHandleKey(draw.material));
  }

  const meshEntry = options.assets.get<"mesh", MeshAsset>(
    options.firstDraw.mesh,
  );

  if (
    meshEntry === undefined ||
    meshEntry.status !== "ready" ||
    meshEntry.asset === null
  ) {
    return null;
  }

  return {
    mesh: meshEntry.asset,
    meshKey: sourceAssetCacheKey(options.firstDraw.mesh, meshEntry.version),
    materials,
    materialKeys,
  };
}
