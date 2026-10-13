import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import {
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import { registerRenderAuthoringComponents } from "./index.js";
import { ParticleEmitter, UiScreen } from "./authoring.js";
import {
  compareRenderSortKeys,
  createQuadSnapshotBuffers,
  QUAD_INSTANCE_FLOAT_STRIDE,
  type BoundsPacket,
  type EnvironmentPacket,
  type InstanceAttributePacket,
  type QuadBatchPacket,
  type RenderDiagnostic,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewCullStats,
} from "./snapshot.js";
import {
  extractAudioEmitters,
  extractAudioListener,
} from "./extraction-audio.js";
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
import { extractParticleEmitters } from "./extraction-particles.js";
import { extractProceduralSkies } from "./extraction-procedural-skies.js";
import { extractRuntimeUniforms } from "./extraction-runtime-uniforms.js";
import { extractSkyboxes } from "./extraction-skyboxes.js";
import { extractSpriteDraws } from "./extraction-sprites.js";
import { extractUiLayout } from "./extraction-ui.js";
import { extractViews } from "./extraction-views.js";

export {
  createRenderExtractionCache,
  type RenderExtractionCache,
} from "./extraction-meshes.js";

export interface RenderExtractionOptions {
  readonly frame?: number;
  readonly time?: number;
  readonly cache?: RenderExtractionCache;
  readonly features?: RenderExtractionFeatureOptions;
}

export interface RenderExtractionFeatureOptions {
  readonly particles?: boolean;
  readonly ui?: boolean;
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
  // Numeric accumulators come from the persistent cache scratch when one is
  // provided (AI-30) — reset per frame, copied into fresh typed arrays below,
  // so the returned snapshot never aliases the next frame's scratch. Object
  // accumulators (bounds, packets, batches) are returned by reference and
  // must stay per-frame allocations.
  const scratch = options.cache?.scratch;
  const transforms = resetScratch(scratch?.transforms);
  const bones = resetScratch(scratch?.bones);
  const morphTargetWeights = resetScratch(scratch?.morphTargetWeights);
  const morphTargetDeltas = resetScratch(scratch?.morphTargetDeltas);
  const morphInstanceDescriptors = resetScratch(
    scratch?.morphInstanceDescriptors,
  );
  const instanceTints = resetScratch(scratch?.instanceTints);
  const instanceAttributes = resetScratch(scratch?.instanceAttributes);
  const instanceAttributePackets: InstanceAttributePacket[] = [];
  const quadInstanceFloats = resetScratch(scratch?.quadInstanceFloats);
  const quadInstanceWords = resetScratch(scratch?.quadInstanceWords);
  const quadBatches: QuadBatchPacket[] = [];
  const viewMatrices = resetScratch(scratch?.viewMatrices);
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
    morphTargetDeltas,
    morphInstanceDescriptors,
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
  const shadowCasterLayerMask = shadowRequests.reduce(
    (mask, request) => mask | request.casterLayerMask,
    0,
  );
  const shadowDiagnostics: RenderDiagnostic[] = [];
  const shadowCasterDraws =
    shadowRequests.length === 0
      ? []
      : extractMeshDraws(
          world,
          assets,
          transforms,
          bones,
          morphTargetWeights,
          morphTargetDeltas,
          morphInstanceDescriptors,
          instanceTints,
          instanceAttributes,
          instanceAttributePackets,
          bounds,
          shadowDiagnostics,
          shadowCasterLayerMask,
          fogs,
          viewCullContexts,
          viewCullSignature,
          options.cache,
          {
            frustumCull: false,
            requireShadowCaster: true,
            diagnoseLayerMismatch: false,
          },
        ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  appendUniqueDiagnostics(diagnostics, shadowDiagnostics);
  const spriteDraws = extractSpriteDraws(
    world,
    assets,
    transforms,
    bounds,
    diagnostics,
    cameraLayerMask,
    viewCullContexts,
    quadInstanceFloats,
    quadInstanceWords,
    quadBatches,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  const particleEmitters =
    options.features?.particles === false
      ? extractGatedFeatureFamilyPlaceholder({
          world,
          cache: options.cache,
          family: "particles",
          component: ParticleEmitter,
          diagnostics,
          placeholder: [],
        })
      : extractParticleEmitters(
          world,
          assets,
          options.frame ?? 0,
          options.time ?? 0,
          transforms,
          bounds,
          diagnostics,
          cameraLayerMask,
          viewCullContexts,
        ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  // Audio is a derived view too: emitter/listener WORLD matrices ride the same
  // `transforms` array. Not frustum-culled — audibility virtualization is a
  // main-side concern (AU-9).
  const audioEmitters = extractAudioEmitters(
    world,
    assets,
    transforms,
    diagnostics,
  );
  const audioListener = extractAudioListener(
    world,
    transforms,
    diagnostics,
    audioEmitters.length > 0,
  );
  const uiLayout =
    options.features?.ui === false
      ? extractGatedFeatureFamilyPlaceholder({
          world,
          cache: options.cache,
          family: "ui",
          component: UiScreen,
          diagnostics,
          placeholder: { nodes: [], hitRegions: [] },
        })
      : extractUiLayout(world, diagnostics, cameraLayerMask);
  const skyboxes = extractSkyboxes(world, assets, diagnostics, cameraLayerMask);
  const proceduralSkies = extractProceduralSkies(
    world,
    diagnostics,
    cameraLayerMask,
  );
  const runtimeUniforms = extractRuntimeUniforms(world, diagnostics);

  quadBatches.sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));

  return {
    frame: options.frame ?? 0,
    time: options.time ?? 0,
    views,
    meshDraws,
    ...(shadowCasterDraws.length === 0 ? {} : { shadowCasterDraws }),
    spriteDraws,
    ...(particleEmitters.length === 0 ? {} : { particleEmitters }),
    ...(audioEmitters.length === 0 ? {} : { audioEmitters }),
    ...(audioListener === undefined ? {} : { audioListener }),
    ...(quadInstanceFloats.length === 0
      ? {}
      : {
          quads: createQuadSnapshotBuffers({
            instanceFloats: new Float32Array(quadInstanceFloats),
            instanceWords: new Uint32Array(quadInstanceWords),
          }),
        }),
    ...(quadBatches.length === 0 ? {} : { quadBatches }),
    ...(uiLayout.nodes.length === 0 ? {} : { uiNodes: uiLayout.nodes }),
    ...(uiLayout.hitRegions.length === 0
      ? {}
      : { uiHitRegions: uiLayout.hitRegions }),
    skyboxes,
    ...(proceduralSkies.length === 0 ? {} : { proceduralSkies }),
    ...(runtimeUniforms.length === 0 ? {} : { runtimeUniforms }),
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
    ...(morphTargetDeltas.length === 0
      ? {}
      : { morphTargetDeltas: new Float32Array(morphTargetDeltas) }),
    ...(morphInstanceDescriptors.length === 0
      ? {}
      : {
          morphInstanceDescriptors: new Uint32Array(morphInstanceDescriptors),
        }),
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
      ...(shadowCasterDraws.length === 0
        ? {}
        : { shadowCasterDraws: shadowCasterDraws.length }),
      spriteDraws: spriteDraws.length,
      particleEmitters: particleEmitters.length,
      audioEmitters: audioEmitters.length,
      quadInstances: quadInstanceFloats.length / QUAD_INSTANCE_FLOAT_STRIDE,
      quadBatches: quadBatches.length,
      uiNodes: uiLayout.nodes.length,
      uiHitRegions: uiLayout.hitRegions.length,
      skyboxes: skyboxes.length,
      proceduralSkies: proceduralSkies.length,
      runtimeUniforms: runtimeUniforms.length,
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

function resetScratch(scratch: number[] | undefined): number[] {
  if (scratch === undefined) {
    return [];
  }

  scratch.length = 0;
  return scratch;
}

function appendUniqueDiagnostics(
  target: RenderDiagnostic[],
  source: readonly RenderDiagnostic[],
): void {
  if (source.length === 0) {
    return;
  }

  const existing = new Set(target.map(diagnosticKey));

  for (const diagnostic of source) {
    const key = diagnosticKey(diagnostic);

    if (existing.has(key)) {
      continue;
    }

    existing.add(key);
    target.push(diagnostic);
  }
}

function diagnosticKey(diagnostic: RenderDiagnostic): string {
  const entity = diagnostic.entity;

  return [
    diagnostic.code,
    diagnostic.severity,
    entity === undefined ? "" : `${entity.index}:${entity.generation}`,
    diagnostic.assetKey ?? "",
    diagnostic.materialKey ?? "",
    diagnostic.meshKey ?? "",
    diagnostic.textureKey ?? "",
    diagnostic.samplerKey ?? "",
    diagnostic.field ?? "",
  ].join("|");
}

type RenderExtractionQueryComponent = Parameters<
  EcsWorld["queryManager"]["registerQuery"]
>[0]["required"][number];

/**
 * A gated-off feature family extracts nothing — but if the world still holds
 * live entities of that family, silence would read as a rendering bug. Warn
 * once per family per extraction-cache lifetime.
 */
function extractGatedFeatureFamilyPlaceholder<TPlaceholder>(input: {
  readonly world: EcsWorld;
  readonly cache: RenderExtractionCache | undefined;
  readonly family: "particles" | "ui";
  readonly component: RenderExtractionQueryComponent;
  readonly diagnostics: RenderDiagnostic[];
  readonly placeholder: TPlaceholder;
}): TPlaceholder {
  if (input.cache?.gatedFeatureFamiliesReported.has(input.family) === true) {
    return input.placeholder;
  }

  const query = input.world.queryManager.registerQuery({
    required: [input.component],
  });

  if (hasAnyEntity(query.entities)) {
    input.cache?.gatedFeatureFamiliesReported.add(input.family);
    input.diagnostics.push({
      code: "render.extraction.featureGatedWithLiveEntities",
      severity: "warning",
      message: `Render feature '${input.family}' is disabled by the app feature configuration, but the world contains live ${input.family} entities; their packets are not extracted. Add the '${input.family}' feature to the app config (or despawn the entities) to resolve.`,
    });
  }

  return input.placeholder;
}

function hasAnyEntity(entities: Iterable<unknown>): boolean {
  for (const entity of entities) {
    void entity;
    return true;
  }

  return false;
}
