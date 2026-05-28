import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import {
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import { registerRenderAuthoringComponents } from "./index.js";
import {
  compareRenderSortKeys,
  type BoundsPacket,
  type EnvironmentPacket,
  type InstanceAttributePacket,
  type RenderDiagnostic,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewCullStats,
} from "./snapshot.js";
import {
  createViewCullSignature,
  type ViewCullContext,
} from "./extraction-culling.js";
import { extractFogs } from "./extraction-fogs.js";
import { extractLights } from "./extraction-lights.js";
import {
  extractMeshDraws,
  type RenderExtractionCache,
} from "./extraction-meshes.js";
import { extractSkyboxes } from "./extraction-skyboxes.js";
import { extractSpriteDraws } from "./extraction-sprites.js";
import { extractViews } from "./extraction-views.js";

export {
  createRenderExtractionCache,
  type RenderExtractionCache,
} from "./extraction-meshes.js";

export interface RenderExtractionOptions {
  readonly frame?: number;
  readonly cache?: RenderExtractionCache;
}

export function extractRenderSnapshot(
  world: EcsWorld,
  assets: AssetRegistry,
  options: RenderExtractionOptions = {},
): RenderSnapshot {
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);

  const diagnostics: RenderDiagnostic[] = [];
  const transforms: number[] = [];
  const bones: number[] = [];
  const morphTargetWeights: number[] = [];
  const instanceTints: number[] = [];
  const instanceAttributes: number[] = [];
  const instanceAttributePackets: InstanceAttributePacket[] = [];
  const viewMatrices: number[] = [];
  const bounds: BoundsPacket[] = [];
  const viewCullContexts: ViewCullContext[] = [];
  const views = extractViews(
    world,
    viewMatrices,
    diagnostics,
    viewCullContexts,
  );
  const cameraLayerMask = views.reduce(
    (mask, view) => mask | view.layerMask,
    0,
  );
  const viewCullSignature = createViewCullSignature(viewCullContexts);
  const fogs = extractFogs(world, diagnostics, cameraLayerMask);
  const environments: EnvironmentPacket[] = [];
  const shadowRequests: ShadowRequestPacket[] = [];
  const lights = extractLights(
    world,
    assets,
    transforms,
    diagnostics,
    environments,
    shadowRequests,
  );
  const meshDraws = extractMeshDraws(
    world,
    assets,
    transforms,
    bones,
    morphTargetWeights,
    instanceTints,
    instanceAttributes,
    instanceAttributePackets,
    bounds,
    diagnostics,
    cameraLayerMask,
    fogs,
    viewCullContexts,
    viewCullSignature,
    options.cache,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  const spriteDraws = extractSpriteDraws(
    world,
    assets,
    transforms,
    bounds,
    diagnostics,
    cameraLayerMask,
    viewCullContexts,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  const skyboxes = extractSkyboxes(world, assets, diagnostics, cameraLayerMask);

  return {
    frame: options.frame ?? 0,
    views,
    meshDraws,
    spriteDraws,
    skyboxes,
    fogs,
    lights,
    environments,
    shadowRequests,
    bounds,
    transforms: new Float32Array(transforms),
    ...(bones.length === 0 ? {} : { bones: new Float32Array(bones) }),
    ...(morphTargetWeights.length === 0
      ? {}
      : { morphTargetWeights: new Float32Array(morphTargetWeights) }),
    instanceTints: new Float32Array(instanceTints),
    ...(instanceAttributes.length === 0
      ? {}
      : { instanceAttributes: new Float32Array(instanceAttributes) }),
    ...(instanceAttributePackets.length === 0
      ? {}
      : { instanceAttributePackets }),
    viewMatrices: new Float32Array(viewMatrices),
    diagnostics,
    report: {
      views: views.length,
      meshDraws: meshDraws.length,
      spriteDraws: spriteDraws.length,
      skyboxes: skyboxes.length,
      fogs: fogs.length,
      lights: lights.length,
      environments: environments.length,
      shadowRequests: shadowRequests.length,
      bounds: bounds.length,
      diagnostics: diagnostics.length,
      cullStats: viewCullContexts.map(
        (context): ViewCullStats => ({ ...context.stats }),
      ),
    },
  };
}
