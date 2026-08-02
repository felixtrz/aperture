import {
  assetHandleKey,
  composeTrsMatrix,
  isHierarchyEnabled,
  multiplyMat4,
  transformPoint,
  type Aabb,
  type AssetRegistry,
  type BoundingSphere,
  type EcsWorld,
  type Entity,
  type Mat4,
  type ParticleEffectHandle,
  type Vec3Like,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  ParticleEmitter,
  ParticleSimulationSpace,
  RenderLayer,
  RenderOrder,
  Visibility,
} from "./authoring.js";
import {
  validateParticleEffectAsset,
  type ParticleCompositeEffectAsset,
  type ParticleEffectAsset,
  type ParticleEmitterEffectAsset,
} from "../assets/particles.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseParticleEffectHandle } from "./extraction-inputs.js";
import {
  pushMatrix,
  pushTranslationMatrix,
  readWorldMatrix,
} from "./extraction-matrices.js";
import {
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type ParticleBurstPacket,
  type ParticleEmitterPacket,
  type RenderDiagnostic,
  type RenderEntityRef,
} from "./snapshot.js";
import {
  getParticleBurstQueue,
  particleBurstPositionRange,
  particleBurstVelocityRange,
  type ActiveParticleBurst,
  type ParticleBurstRequest,
} from "./particle-burst-queue.js";

const PARTICLE_FIXED_RANDOM_SEED = -0x8000_0000;

export function extractParticleEmitters(
  world: EcsWorld,
  assets: AssetRegistry,
  frame: number,
  time: number,
  transforms: number[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): ParticleEmitterPacket[] {
  const query = world.queryManager.registerQuery({
    required: [ParticleEmitter],
  });
  const packets: ParticleEmitterPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    if (!isHierarchyEnabled(entity)) {
      continue;
    }
    if (
      entity.hasComponent(Visibility) &&
      entity.getValue(Visibility, "visible") === false
    ) {
      diagnostics.push(diagnostic("render.invisible", entity));
      continue;
    }
    if (entity.getValue(ParticleEmitter, "visible") === false) {
      diagnostics.push(diagnostic("render.particle.invisible", entity));
      continue;
    }
    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const effect = parseParticleEffectHandle(
      entity.getValue(ParticleEmitter, "effectId") ?? "",
    );

    if (effect === null) {
      diagnostics.push(diagnostic("render.particle.invalidEffect", entity));
      continue;
    }

    const effectEntry = assets.get<"particle-effect", ParticleEffectAsset>(
      effect,
    );

    if (effectEntry === undefined) {
      diagnostics.push(
        diagnostic("render.particle.effectMissing", entity, effect),
      );
      continue;
    }
    if (effectEntry.status !== "ready" || effectEntry.asset === null) {
      diagnostics.push(
        diagnostic(
          `render.particle.effect.${effectEntry.status}`,
          entity,
          effect,
        ),
      );
      continue;
    }

    const validation = validateParticleEffectAsset(effectEntry.asset);

    if (!validation.valid) {
      for (const particleDiagnostic of validation.diagnostics) {
        diagnostics.push(
          diagnostic(`render.${particleDiagnostic.code}`, entity, effect),
        );
      }
      continue;
    }

    const layerMask = entity.hasComponent(RenderLayer)
      ? (entity.getValue(RenderLayer, "mask") ?? 1)
      : 1;

    if (layerMask === 0) {
      diagnostics.push(diagnostic("render.zeroLayerMask", entity));
      continue;
    }
    if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
      diagnostics.push(diagnostic("render.layerMismatch", entity));
      continue;
    }

    const authoredRadius = finiteNumber(
      entity.getValue(ParticleEmitter, "boundsRadius"),
      0,
    );
    const boundsCenter = Array.from(
      entity.getVectorView(ParticleEmitter, "boundsCenter"),
    ) as [number, number, number];
    const worldMatrix = readWorldMatrix(entity);
    const parentEmitterId = createStableRenderId(entityRef(entity));
    const seed = finiteInteger(entity.getValue(ParticleEmitter, "seed"), 1);
    const resetEpoch = Math.max(
      0,
      finiteInteger(entity.getValue(ParticleEmitter, "resetEpoch"), 0),
    );
    const authoredLifecycleStartTime = finiteNumber(
      entity.getValue(ParticleEmitter, "lifecycleStartTime"),
      -1,
    );
    const lifecycleStartTime =
      authoredLifecycleStartTime >= 0 ? authoredLifecycleStartTime : undefined;
    const authoredPlaybackTime = finiteNumber(
      entity.getValue(ParticleEmitter, "playbackTime"),
      -1,
    );
    const playbackTime =
      authoredPlaybackTime >= 0 ? authoredPlaybackTime : undefined;
    const timeScale = Math.max(
      0,
      finiteNumber(entity.getValue(ParticleEmitter, "timeScale"), 1),
    );
    const burst = readAuthoredParticleBurst(
      entity,
      parentEmitterId,
      resetEpoch,
      lifecycleStartTime,
    );
    const simulationSpace =
      entity.getValue(ParticleEmitter, "simulationSpace") ===
      ParticleSimulationSpace.Local
        ? "local"
        : "world";
    const renderOrder = entity.hasComponent(RenderOrder)
      ? (entity.getValue(RenderOrder, "value") ?? 0)
      : null;

    const context: LeafEmitterExtractionContext = {
      assets,
      transforms,
      bounds,
      diagnostics,
      viewCullContexts,
      packets,
    };

    if (effectEntry.asset.type === "composite") {
      expandCompositeParticleEmitter(context, {
        entity,
        composite: effectEntry.asset,
        parentWorldMatrix: worldMatrix,
        parentEmitterId,
        seed,
        resetEpoch,
        ...(lifecycleStartTime === undefined ? {} : { lifecycleStartTime }),
        ...(playbackTime === undefined ? {} : { playbackTime }),
        ...(burst === undefined ? {} : { burst }),
        timeScale,
        simulationSpace,
        layerMask,
        renderOrder,
        boundsCenter,
        authoredRadius,
      });
      continue;
    }

    const capacity = Math.trunc(
      finitePositive(
        entity.getValue(ParticleEmitter, "capacity"),
        effectEntry.asset.runtime.capacity,
      ),
    );

    appendLeafEmitterPacket(context, {
      entity,
      effect,
      asset: effectEntry.asset,
      effectVersion: effectEntry.version,
      worldMatrix,
      emitterId: parentEmitterId,
      capacity,
      seed,
      resetEpoch,
      ...(lifecycleStartTime === undefined ? {} : { lifecycleStartTime }),
      ...(playbackTime === undefined ? {} : { playbackTime }),
      ...(burst === undefined ? {} : { burst }),
      timeScale,
      delay: 0,
      duration: null,
      simulationSpace,
      layerMask,
      renderOrder,
      boundsCenter,
      authoredRadius,
    });
  }

  const burstQueue = getParticleBurstQueue(world);
  if (burstQueue !== null) {
    extractParticleBursts(
      {
        assets,
        frame,
        time,
        transforms,
        bounds,
        diagnostics,
        cameraLayerMask,
        viewCullContexts,
        bursts: burstQueue.drain({ frame, time, assets, diagnostics }),
      },
      packets,
    );
  }

  return packets;
}

interface LeafEmitterExtractionContext {
  readonly assets: AssetRegistry;
  readonly transforms: number[];
  readonly bounds: BoundsPacket[];
  readonly diagnostics: RenderDiagnostic[];
  readonly viewCullContexts: readonly ViewCullContext[];
  readonly packets: ParticleEmitterPacket[];
}

interface LeafEmitterRequest {
  readonly entity: Entity;
  readonly effect: ParticleEffectHandle;
  readonly asset: ParticleEmitterEffectAsset;
  readonly effectVersion: number;
  readonly worldMatrix: Mat4;
  readonly emitterId: number;
  /** Transparent-sort tie breaker; state identity remains `emitterId`. */
  readonly sortStableId?: number;
  readonly capacity: number;
  readonly seed: number;
  readonly resetEpoch: number;
  readonly lifecycleStartTime?: number;
  readonly playbackTime?: number;
  readonly burst?: ParticleBurstPacket;
  readonly timeScale: number;
  readonly delay: number;
  readonly duration: number | null;
  readonly simulationSpace: "local" | "world";
  readonly layerMask: number;
  readonly renderOrder: number | null;
  readonly boundsCenter: readonly [number, number, number];
  readonly authoredRadius: number;
}

interface CompositeEmitterRequest {
  readonly entity: Entity;
  readonly composite: ParticleCompositeEffectAsset;
  readonly parentWorldMatrix: Mat4;
  readonly parentEmitterId: number;
  readonly seed: number;
  readonly resetEpoch: number;
  readonly lifecycleStartTime?: number;
  readonly playbackTime?: number;
  readonly burst?: ParticleBurstPacket;
  readonly timeScale: number;
  readonly simulationSpace: "local" | "world";
  readonly layerMask: number;
  readonly renderOrder: number | null;
  readonly boundsCenter: readonly [number, number, number];
  readonly authoredRadius: number;
}

/**
 * Builds one leaf particle emitter packet (bounds, sort key, transform) and
 * appends it to the snapshot. Shared by the direct leaf path and by composite
 * expansion so both produce identical packet shapes; the renderer only ever
 * sees leaf packets.
 */
function appendLeafEmitterPacket(
  context: LeafEmitterExtractionContext,
  request: LeafEmitterRequest,
): void {
  const effectKey = assetHandleKey(request.effect);
  const burstBoundsCenter =
    request.burst === undefined
      ? request.boundsCenter
      : ([
          request.boundsCenter[0] + request.burst.position[0],
          request.boundsCenter[1] + request.burst.position[1],
          request.boundsCenter[2] + request.burst.position[2],
        ] as const);
  const radius =
    request.authoredRadius > 0
      ? request.authoredRadius
      : deriveContinuousParticleBoundsRadius({
          effect: request.asset,
          diagnostics: context.diagnostics,
          entity: entityRef(request.entity),
          effectKey,
        });
  const boundsPacket = createParticleBoundsPacket(
    context.bounds.length,
    request.entity,
    request.worldMatrix,
    burstBoundsCenter,
    radius,
  );
  const boundsIndex = context.bounds.length;
  const worldTransformOffset = pushMatrix(
    context.transforms,
    request.worldMatrix,
  );
  const sortView = firstMatchingSortView(
    request.layerMask,
    context.viewCullContexts,
  );
  const sortViewId = sortView?.viewId ?? 0;
  const sortDepth =
    sortView === undefined
      ? 0
      : computeViewDepth(sortView.viewMatrix, boundsPacket.worldSphere.center);
  const sortKey = createRenderSortKey({
    queue: "transparent",
    viewId: sortViewId,
    layer: request.layerMask,
    order: request.renderOrder ?? request.asset.renderer.renderOrder,
    depth: sortDepth,
    pipelineKey: "gpu-particles",
    materialKey: effectKey,
    meshKey: "particle-quad",
    stableId: request.sortStableId ?? request.emitterId,
  });

  context.bounds.push(boundsPacket);
  context.packets.push({
    emitterId: request.emitterId,
    entity: entityRef(request.entity),
    effect: request.effect,
    effectVersion: request.effectVersion,
    capacity: request.burst?.count ?? request.capacity,
    seed: request.seed,
    resetEpoch: request.resetEpoch,
    ...(request.lifecycleStartTime === undefined
      ? {}
      : { lifecycleStartTime: request.lifecycleStartTime }),
    ...(request.playbackTime === undefined
      ? {}
      : { playbackTime: request.playbackTime }),
    timeScale: request.timeScale,
    ...(request.delay !== 0 ? { delay: request.delay } : {}),
    ...(request.duration !== null ? { duration: request.duration } : {}),
    simulationSpace: request.simulationSpace,
    worldTransformOffset,
    boundsIndex,
    layerMask: request.layerMask,
    sortKey,
    ...(request.burst === undefined
      ? {}
      : {
          mode: "burst" as const,
          burst: request.burst,
        }),
  });
}

/**
 * Expands a composite particle effect into one leaf emitter packet per child.
 * Each child's local transform is composed onto the parent world matrix, the
 * child time scale multiplies the parent's, and a stable, deterministic emitter
 * id is derived from the parent id and child index so GPU state stays attached
 * across frames. Nested composites are rejected for now.
 */
function expandCompositeParticleEmitter(
  context: LeafEmitterExtractionContext,
  request: CompositeEmitterRequest,
): void {
  const { composite } = request;

  for (let index = 0; index < composite.emitters.length; index += 1) {
    const child = composite.emitters[index];
    if (child === undefined) {
      continue;
    }

    const childEntry = context.assets.get<
      "particle-effect",
      ParticleEffectAsset
    >(child.effect);

    if (childEntry === undefined) {
      context.diagnostics.push(
        diagnostic(
          "render.particle.effectMissing",
          request.entity,
          child.effect,
        ),
      );
      continue;
    }
    if (childEntry.status !== "ready" || childEntry.asset === null) {
      context.diagnostics.push(
        diagnostic(
          `render.particle.effect.${childEntry.status}`,
          request.entity,
          child.effect,
        ),
      );
      continue;
    }
    if (childEntry.asset.type === "composite") {
      context.diagnostics.push(
        diagnostic(
          "render.particle.nestedComposite",
          request.entity,
          child.effect,
        ),
      );
      continue;
    }

    const childValidation = validateParticleEffectAsset(childEntry.asset);
    if (!childValidation.valid) {
      for (const childDiagnostic of childValidation.diagnostics) {
        context.diagnostics.push(
          diagnostic(
            `render.${childDiagnostic.code}`,
            request.entity,
            child.effect,
          ),
        );
      }
      continue;
    }

    const childLocalMatrix = composeTrsMatrix(
      child.transform.translation,
      child.transform.rotation,
      child.transform.scale,
    );
    const childWorldMatrix = multiplyMat4(
      request.parentWorldMatrix,
      childLocalMatrix,
    );

    appendLeafEmitterPacket(context, {
      entity: request.entity,
      effect: child.effect,
      asset: childEntry.asset,
      effectVersion: childEntry.version,
      worldMatrix: childWorldMatrix,
      emitterId: composeParticleChildEmitterId(request.parentEmitterId, index),
      sortStableId: composeParticleChildSortId(request.parentEmitterId, index),
      capacity: childEntry.asset.runtime.capacity,
      seed: composeParticleChildSeed(request.seed, index),
      resetEpoch: request.resetEpoch,
      ...(request.lifecycleStartTime === undefined
        ? {}
        : { lifecycleStartTime: request.lifecycleStartTime }),
      ...(request.playbackTime === undefined
        ? {}
        : { playbackTime: request.playbackTime * child.timeScale }),
      ...(request.burst === undefined
        ? {}
        : {
            burst: {
              ...request.burst,
              burstId: composeParticleChildEmitterId(
                request.parentEmitterId,
                index,
              ),
            },
          }),
      timeScale: request.timeScale * child.timeScale,
      delay: child.delay,
      duration: child.duration,
      simulationSpace: request.simulationSpace,
      layerMask: request.layerMask,
      renderOrder: request.renderOrder,
      boundsCenter: request.boundsCenter,
      authoredRadius: request.authoredRadius,
    });
  }
}

/**
 * Derives a stable, well-distributed 32-bit emitter id for a composite child
 * from the parent emitter id and child index. Like {@link createStableRenderId}
 * this accepts the small, well-understood risk of hash collisions in exchange
 * for an id that is stable across frames without per-emitter state.
 */
function composeParticleChildEmitterId(
  parentEmitterId: number,
  childIndex: number,
): number {
  let hash = (parentEmitterId ^ Math.imul(childIndex + 1, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * Keeps equal-depth/equal-order composite children in authored list order.
 *
 * GPU state still uses the well-distributed child emitter id above. Sorting
 * only needs uniqueness among the simultaneously live children of an entity,
 * so reserving the low byte for the child index is deterministic and mirrors
 * Three.js's stable transparent-object insertion-order tie break.
 */
function composeParticleChildSortId(
  parentEmitterId: number,
  childIndex: number,
): number {
  return (
    Math.imul(parentEmitterId & 0x00ff_ffff, 256) + Math.max(0, childIndex)
  );
}

/** Derives a deterministic, distinct RNG seed for a composite child emitter. */
function composeParticleChildSeed(
  parentSeed: number,
  childIndex: number,
): number {
  // The minimum int32 seed is reserved for deterministic visual fixtures.
  // Preserve it through a composite instead of hashing each child back into
  // the normal random stream.
  if ((parentSeed | 0) === PARTICLE_FIXED_RANDOM_SEED) {
    return PARTICLE_FIXED_RANDOM_SEED;
  }
  return (parentSeed + Math.imul(childIndex + 1, 0x9e3779b1)) | 0;
}

/**
 * Reads an explicit ECS-owned one-shot from the emitter authoring component.
 *
 * A positive count switches the packet to the same analytic burst renderer
 * used by the convenience queue, but identity, transform, clock, and reset
 * intent remain on the ECS entity.
 */
function readAuthoredParticleBurst(
  entity: Entity,
  emitterId: number,
  resetEpoch: number,
  lifecycleStartTime: number | undefined,
): ParticleBurstPacket | undefined {
  const count = Math.max(
    0,
    finiteInteger(entity.getValue(ParticleEmitter, "burstCount"), 0),
  );
  if (count <= 0) {
    return undefined;
  }

  const tuple3 = (
    field:
      | "burstPosition"
      | "burstPositionJitterMin"
      | "burstPositionJitterMax"
      | "burstVelocityMin"
      | "burstVelocityMax",
  ): readonly [number, number, number] => {
    const value = entity.getVectorView(ParticleEmitter, field);
    return [
      finiteNumber(value[0], 0),
      finiteNumber(value[1], 0),
      finiteNumber(value[2], 0),
    ];
  };
  const color = entity.getVectorView(ParticleEmitter, "burstColor");

  return {
    burstId: emitterId,
    startFrame: resetEpoch,
    ...(lifecycleStartTime === undefined
      ? {}
      : { startTime: lifecycleStartTime }),
    count,
    position: tuple3("burstPosition"),
    positionJitterMin: tuple3("burstPositionJitterMin"),
    positionJitterMax: tuple3("burstPositionJitterMax"),
    velocityMin: tuple3("burstVelocityMin"),
    velocityMax: tuple3("burstVelocityMax"),
    sizeScale: Math.max(
      0,
      finiteNumber(entity.getValue(ParticleEmitter, "burstSizeScale"), 1),
    ),
    speedScale: Math.max(
      0,
      finiteNumber(entity.getValue(ParticleEmitter, "burstSpeedScale"), 1),
    ),
    lifetimeScale: Math.max(
      0,
      finiteNumber(entity.getValue(ParticleEmitter, "burstLifetimeScale"), 1),
    ),
    colorTint: [
      finiteNumber(color[0], 1),
      finiteNumber(color[1], 1),
      finiteNumber(color[2], 1),
      finiteNumber(color[3], 1),
    ],
  };
}

function extractParticleBursts(
  input: {
    readonly assets: AssetRegistry;
    readonly frame: number;
    readonly time: number;
    readonly transforms: number[];
    readonly bounds: BoundsPacket[];
    readonly diagnostics: RenderDiagnostic[];
    readonly cameraLayerMask: number;
    readonly viewCullContexts: readonly ViewCullContext[];
    readonly bursts: readonly ActiveParticleBurst[];
  },
  packets: ParticleEmitterPacket[],
): void {
  for (const burst of input.bursts) {
    if (burst.request.count <= 0) {
      continue;
    }

    const effectEntry = input.assets.get<
      "particle-effect",
      ParticleEffectAsset
    >(burst.effect);
    const effect = effectEntry?.asset;

    if (
      effectEntry?.status !== "ready" ||
      effect === undefined ||
      effect === null
    ) {
      continue;
    }
    // Composite effects are rejected when promoted in the burst queue, so this
    // only narrows the union for the bounds derivation below.
    if (effect.type !== "emitter") {
      continue;
    }

    const layerMask = finiteInteger(burst.request.layerMask, 1);
    if (layerMask === 0) {
      continue;
    }
    if (
      input.cameraLayerMask !== 0 &&
      (layerMask & input.cameraLayerMask) === 0
    ) {
      continue;
    }

    const position = [
      finiteNumber(burst.request.position[0], 0) + burst.origin[0],
      finiteNumber(burst.request.position[1], 0) + burst.origin[1],
      finiteNumber(burst.request.position[2], 0) + burst.origin[2],
    ] as const;
    const requestPositionRange = particleBurstPositionRange(burst.request);
    const positionRange = {
      min: [
        requestPositionRange.min[0] + burst.origin[0],
        requestPositionRange.min[1] + burst.origin[1],
        requestPositionRange.min[2] + burst.origin[2],
      ] as const,
      max: [
        requestPositionRange.max[0] + burst.origin[0],
        requestPositionRange.max[1] + burst.origin[1],
        requestPositionRange.max[2] + burst.origin[2],
      ] as const,
    };
    const velocityRange = particleBurstVelocityRange(burst.request);
    const rotation = particleBurstRotation(burst.request);
    const boundsPositionRange = rotateParticleBurstRange(
      positionRange,
      rotation,
      position,
    );
    const boundsVelocityRange = rotateParticleBurstRange(
      velocityRange,
      rotation,
      [0, 0, 0],
    );
    const authoredRadius = finiteNumber(burst.request.boundsRadius, 0);
    const boundsPacket =
      authoredRadius > 0
        ? createParticleBurstBoundsPacket(
            input.bounds.length,
            particleBurstBoundsCenter(position, burst.request.boundsCenter),
            authoredRadius,
          )
        : createAutomaticParticleBurstBoundsPacket({
            boundsId: input.bounds.length,
            position,
            positionRange: boundsPositionRange,
            velocityRange: boundsVelocityRange,
            sizeScale: particleBurstSizeScale(burst.request),
            speedScale: particleBurstSpeedScale(burst.request),
            lifetimeScale: particleBurstLifetimeScale(burst.request),
            ...(burst.request.boundsCenter === undefined
              ? {}
              : { centerOverride: burst.request.boundsCenter }),
            effect,
            diagnostics: input.diagnostics,
            effectKey: assetHandleKey(burst.effect),
          });

    if (
      !isVisibleInAnyMatchingView(
        boundsPacket.worldAabb,
        layerMask,
        input.viewCullContexts,
      )
    ) {
      continue;
    }

    const stableId = 0x4000_0000 + (burst.seq & 0x0fff_ffff);
    const effectKey = assetHandleKey(burst.effect);
    const boundsIndex = input.bounds.length;
    const worldTransformOffset = pushTranslationMatrix(
      input.transforms,
      position,
    );
    const sortView = firstMatchingSortView(layerMask, input.viewCullContexts);
    const sortViewId = sortView?.viewId ?? 0;
    const sortDepth =
      sortView === undefined
        ? 0
        : computeViewDepth(
            sortView.viewMatrix,
            boundsPacket.worldSphere.center,
          );
    const sortKey = createRenderSortKey({
      queue: "transparent",
      viewId: sortViewId,
      layer: layerMask,
      order: effect.renderer.renderOrder,
      depth: sortDepth,
      pipelineKey: "gpu-particles",
      materialKey: effectKey,
      meshKey: "particle-quad",
      stableId,
    });
    input.bounds.push(boundsPacket);
    packets.push({
      emitterId: stableId,
      entity: { index: -1, generation: 0 },
      effect: burst.effect,
      effectVersion: burst.effectVersion,
      capacity: Math.max(1, Math.trunc(burst.request.count)),
      seed: finiteInteger(burst.request.seed, burst.seq),
      resetEpoch: burst.startFrame,
      // The mutable burst queue is the authoritative playback clock. Publish
      // its accumulated age explicitly so a renderer keeps the exact particle
      // state when the shared clock freezes. Deriving from renderer wall time
      // would continue aging world-space batched bursts after timeScale hit 0.
      playbackTime: burst.ageSeconds,
      // ageSeconds already includes both the shared clock and request rate.
      // Keep the packet rate neutral so a legacy renderer cannot double-scale
      // the authored clock.
      timeScale: 1,
      simulationSpace: "world",
      worldTransformOffset,
      boundsIndex,
      layerMask,
      sortKey,
      mode: "burst",
      burst: {
        burstId: burst.seq,
        startFrame: burst.startFrame,
        // Retain the rebased origin for backwards-compatible renderers.
        startTime: input.time - burst.ageSeconds,
        count: Math.max(1, Math.trunc(burst.request.count)),
        position,
        positionJitterMin: [
          positionRange.min[0] - position[0],
          positionRange.min[1] - position[1],
          positionRange.min[2] - position[2],
        ],
        positionJitterMax: [
          positionRange.max[0] - position[0],
          positionRange.max[1] - position[1],
          positionRange.max[2] - position[2],
        ],
        velocityMin: velocityRange.min,
        velocityMax: velocityRange.max,
        sizeScale: particleBurstSizeScale(burst.request),
        speedScale: particleBurstSpeedScale(burst.request),
        lifetimeScale: particleBurstLifetimeScale(burst.request),
        colorTint: particleBurstColorTint(burst.request),
        ...(isIdentityParticleRotation(rotation) ? {} : { rotation }),
      },
    });
  }
}

/** Authored particle size is the identity when no per-burst scale is supplied. */
function particleBurstSizeScale(request: ParticleBurstRequest): number {
  return Math.max(0, finiteNumber(request.sizeScale, 1));
}

/** Authored launch speed is the identity when no per-burst scale is supplied. */
function particleBurstSpeedScale(request: ParticleBurstRequest): number {
  return Math.max(0, finiteNumber(request.speedScale, 1));
}

/** Authored lifetime is the identity when no per-burst scale is supplied. */
function particleBurstLifetimeScale(request: ParticleBurstRequest): number {
  return Math.max(0, finiteNumber(request.lifetimeScale, 1));
}

/**
 * Per-burst RGBA tint. Defaults to opaque white, which is the identity for the
 * multiply the GPU applies — an untinted burst renders exactly as authored.
 */
function particleBurstColorTint(
  request: ParticleBurstRequest,
): readonly [number, number, number, number] {
  const color = request.color;
  if (color === undefined) {
    return [1, 1, 1, 1];
  }

  return [
    finiteNumber(color[0], 1),
    finiteNumber(color[1], 1),
    finiteNumber(color[2], 1),
    finiteNumber(color[3], 1),
  ];
}

function particleBurstRotation(
  request: ParticleBurstRequest,
): readonly [number, number, number, number] {
  const rotation = request.rotation;
  if (rotation === undefined) {
    return [0, 0, 0, 1];
  }
  return [
    finiteNumber(rotation[0], 0),
    finiteNumber(rotation[1], 0),
    finiteNumber(rotation[2], 0),
    finiteNumber(rotation[3], 1),
  ];
}

function isIdentityParticleRotation(
  rotation: readonly [number, number, number, number],
): boolean {
  return (
    rotation[0] === 0 &&
    rotation[1] === 0 &&
    rotation[2] === 0 &&
    rotation[3] === 1
  );
}

/**
 * Rotates all eight corners of an axis-aligned range and encloses the result.
 *
 * Burst birth jitter and explicit velocity are rotated by the renderer. Bounds
 * must use that same transform or a directional effect can be culled against
 * the unrotated axis and flicker at a frustum edge.
 */
function rotateParticleBurstRange(
  range: ReturnType<typeof particleBurstPositionRange>,
  rotation: readonly [number, number, number, number],
  pivot: readonly [number, number, number],
): ReturnType<typeof particleBurstPositionRange> {
  if (isIdentityParticleRotation(rotation)) {
    return range;
  }

  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  for (const x of [range.min[0], range.max[0]]) {
    for (const y of [range.min[1], range.max[1]]) {
      for (const z of [range.min[2], range.max[2]]) {
        const rotated = rotateParticleBurstVector(
          [x - pivot[0], y - pivot[1], z - pivot[2]],
          rotation,
        );
        const rx = rotated[0] + pivot[0];
        const ry = rotated[1] + pivot[1];
        const rz = rotated[2] + pivot[2];
        min[0] = Math.min(min[0], rx);
        min[1] = Math.min(min[1], ry);
        min[2] = Math.min(min[2], rz);
        max[0] = Math.max(max[0], rx);
        max[1] = Math.max(max[1], ry);
        max[2] = Math.max(max[2], rz);
      }
    }
  }

  return { min, max };
}

function rotateParticleBurstVector(
  vector: readonly [number, number, number],
  rotation: readonly [number, number, number, number],
): readonly [number, number, number] {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = rotation;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

function createParticleBurstBoundsPacket(
  boundsId: number,
  center: readonly [number, number, number],
  radius: number,
): BoundsPacket {
  const aabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
  const sphere: BoundingSphere = { center, radius };

  return {
    boundsId,
    entity: { index: -1, generation: 0 },
    localAabb: aabb,
    worldAabb: aabb,
    localSphere: sphere,
    worldSphere: sphere,
  };
}

function createAutomaticParticleBurstBoundsPacket(input: {
  readonly boundsId: number;
  readonly position: readonly [number, number, number];
  readonly positionRange: ReturnType<typeof particleBurstPositionRange>;
  readonly velocityRange: ReturnType<typeof particleBurstVelocityRange>;
  readonly sizeScale: number;
  readonly speedScale: number;
  readonly lifetimeScale: number;
  readonly centerOverride?: Vec3Like;
  readonly effect: ParticleEmitterEffectAsset;
  readonly diagnostics: RenderDiagnostic[];
  readonly effectKey: string;
}): BoundsPacket {
  const lifetime = particleLifetimeMax(input.effect) * input.lifetimeScale;
  const particleRadius =
    maxParticleBillboardRadius(input.effect) * input.sizeScale;
  const shapeRadius = particleShapeBoundsRadius(input.effect);
  const authoredSpeed =
    Math.max(
      Math.abs(input.effect.runtime.startSpeed.min),
      Math.abs(input.effect.runtime.startSpeed.max),
    ) * input.speedScale;
  const x = particleDisplacementRange(
    input.velocityRange.min[0] - authoredSpeed,
    input.velocityRange.max[0] + authoredSpeed,
    input.effect.runtime.gravity[0],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const y = particleDisplacementRange(
    input.velocityRange.min[1] - authoredSpeed,
    input.velocityRange.max[1] + authoredSpeed,
    input.effect.runtime.gravity[1],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const z = particleDisplacementRange(
    input.velocityRange.min[2] - authoredSpeed,
    input.velocityRange.max[2] + authoredSpeed,
    input.effect.runtime.gravity[2],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const worldAabb: Aabb = {
    min: [
      input.positionRange.min[0] + x.min - particleRadius - shapeRadius,
      input.positionRange.min[1] + y.min - particleRadius - shapeRadius,
      input.positionRange.min[2] + z.min - particleRadius - shapeRadius,
    ],
    max: [
      input.positionRange.max[0] + x.max + particleRadius + shapeRadius,
      input.positionRange.max[1] + y.max + particleRadius + shapeRadius,
      input.positionRange.max[2] + z.max + particleRadius + shapeRadius,
    ],
  };
  const center =
    input.centerOverride === undefined
      ? aabbCenter(worldAabb)
      : particleBurstBoundsCenter(input.position, input.centerOverride);
  const radius = checkedAutoParticleBoundsRadius(
    farthestAabbCornerDistance(center, worldAabb),
    input.diagnostics,
    {
      effectKey: input.effectKey,
      mode: "burst",
    },
  );
  const sphere: BoundingSphere = { center, radius };

  return {
    boundsId: input.boundsId,
    entity: { index: -1, generation: 0 },
    localAabb: worldAabb,
    worldAabb: sphereAabb(center, radius),
    localSphere: sphere,
    worldSphere: sphere,
  };
}

function createParticleBoundsPacket(
  boundsId: number,
  entity: Entity,
  worldMatrix: Mat4,
  center: readonly [number, number, number],
  radius: number,
): BoundsPacket {
  const worldCenter = transformPoint(worldMatrix, center);
  const worldRadius = radius * matrixMaxScale(worldMatrix);
  const localAabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
  const worldAabb: Aabb = {
    min: [
      worldCenter[0] - worldRadius,
      worldCenter[1] - worldRadius,
      worldCenter[2] - worldRadius,
    ],
    max: [
      worldCenter[0] + worldRadius,
      worldCenter[1] + worldRadius,
      worldCenter[2] + worldRadius,
    ],
  };
  const localSphere: BoundingSphere = { center, radius };

  return {
    boundsId,
    entity: entityRef(entity),
    localAabb,
    worldAabb,
    localSphere,
    worldSphere: { center: worldCenter, radius: worldRadius },
  };
}

function matrixMaxScale(matrix: Mat4): number {
  const sx = Math.hypot(matrix[0] ?? 1, matrix[1] ?? 0, matrix[2] ?? 0);
  const sy = Math.hypot(matrix[4] ?? 0, matrix[5] ?? 1, matrix[6] ?? 0);
  const sz = Math.hypot(matrix[8] ?? 0, matrix[9] ?? 0, matrix[10] ?? 1);
  const scale = Math.max(sx, sy, sz);

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const MIN_AUTO_PARTICLE_BOUNDS_RADIUS = 0.001;
const LARGE_AUTO_PARTICLE_BOUNDS_RADIUS = 256;
// Matches the continuous GPU particle drift term in PARTICLE_COMPUTE_WGSL.
const CONTINUOUS_PARTICLE_DRIFT_AMPLITUDE = 0.18;

function deriveContinuousParticleBoundsRadius(input: {
  readonly effect: ParticleEmitterEffectAsset;
  readonly diagnostics: RenderDiagnostic[];
  readonly entity: RenderEntityRef;
  readonly effectKey: string;
}): number {
  const spawnRadius = Math.max(0.01, input.effect.runtime.startSpeed.max);
  const radius =
    maxParticleBillboardRadius(input.effect) +
    spawnRadius +
    CONTINUOUS_PARTICLE_DRIFT_AMPLITUDE;

  return checkedAutoParticleBoundsRadius(radius, input.diagnostics, {
    entity: input.entity,
    effectKey: input.effectKey,
    mode: "continuous",
  });
}

function checkedAutoParticleBoundsRadius(
  radius: number,
  diagnostics: RenderDiagnostic[],
  context: {
    readonly entity?: RenderEntityRef;
    readonly effectKey: string;
    readonly mode: "burst" | "continuous";
  },
): number {
  if (!Number.isFinite(radius) || radius <= 0) {
    diagnostics.push({
      code: "render.particle.boundsUnavailable",
      severity: "warning",
      ...(context.entity === undefined ? {} : { entity: context.entity }),
      assetKey: context.effectKey,
      field: "boundsRadius",
      message: `Could not derive conservative ${context.mode} particle bounds; using a 1 unit fallback radius.`,
    });
    return 1;
  }

  const result = Math.max(radius, MIN_AUTO_PARTICLE_BOUNDS_RADIUS);

  if (result > LARGE_AUTO_PARTICLE_BOUNDS_RADIUS) {
    diagnostics.push({
      code: "render.particle.boundsLarge",
      severity: "warning",
      ...(context.entity === undefined ? {} : { entity: context.entity }),
      assetKey: context.effectKey,
      field: "boundsRadius",
      message: `Derived ${context.mode} particle bounds radius ${result.toFixed(
        2,
      )} is unusually large; set boundsRadius/boundsCenter explicitly if this is intentional.`,
    });
  }

  return result;
}

function particleLifetimeMax(effect: ParticleEmitterEffectAsset): number {
  return Math.max(0, effect.runtime.lifetime.min, effect.runtime.lifetime.max);
}

function particleShapeBoundsRadius(effect: ParticleEmitterEffectAsset): number {
  if (!effect.shape.enabled || effect.shape.type === "point") {
    return 0;
  }

  const box = effect.shape.box;
  const boxRadius =
    Math.hypot(
      Math.max(0, box[0] ?? 0),
      Math.max(0, box[1] ?? 0),
      Math.max(0, box[2] ?? 0),
    ) * 0.5;

  return Math.max(0, effect.shape.radius, boxRadius);
}

function maxParticleBillboardRadius(
  effect: ParticleEmitterEffectAsset,
): number {
  let maxCurve = 0;
  for (const value of effect.curves.sizeOverLifetime) {
    if (Number.isFinite(value)) {
      maxCurve = Math.max(maxCurve, value);
    }
  }

  return Math.max(
    MIN_AUTO_PARTICLE_BOUNDS_RADIUS,
    Math.max(0, effect.runtime.startSize.min, effect.runtime.startSize.max) *
      Math.max(0, maxCurve) *
      Math.SQRT1_2,
  );
}

function particleDisplacementRange(
  velocityMin: number,
  velocityMax: number,
  gravity: number,
  damping: number,
  lifetime: number,
): { readonly min: number; readonly max: number } {
  const candidates = [
    0,
    particleDisplacement(velocityMin, gravity, damping, lifetime),
    particleDisplacement(velocityMax, gravity, damping, lifetime),
  ];

  if (damping <= 0 && gravity !== 0) {
    const turningMin = -velocityMin / gravity;
    const turningMax = -velocityMax / gravity;
    if (turningMin > 0 && turningMin < lifetime) {
      candidates.push(
        particleDisplacement(velocityMin, gravity, damping, turningMin),
      );
    }
    if (turningMax > 0 && turningMax < lifetime) {
      candidates.push(
        particleDisplacement(velocityMax, gravity, damping, turningMax),
      );
    }
  } else if (damping > 0) {
    const turningMin = particleDampedTurningTime(velocityMin, gravity, damping);
    const turningMax = particleDampedTurningTime(velocityMax, gravity, damping);
    if (turningMin > 0 && turningMin < lifetime) {
      candidates.push(
        particleDisplacement(velocityMin, gravity, damping, turningMin),
      );
    }
    if (turningMax > 0 && turningMax < lifetime) {
      candidates.push(
        particleDisplacement(velocityMax, gravity, damping, turningMax),
      );
    }
  }

  return {
    min: Math.min(...candidates),
    max: Math.max(...candidates),
  };
}

function particleDisplacement(
  velocity: number,
  gravity: number,
  damping: number,
  time: number,
): number {
  if (damping <= 0) {
    return velocity * time + 0.5 * gravity * time * time;
  }

  const decay = Math.exp(-damping * time);
  const invDamping = 1 / damping;
  return (
    velocity * (1 - decay) * invDamping +
    gravity * (time * invDamping - (1 - decay) * invDamping * invDamping)
  );
}

function particleDampedTurningTime(
  velocity: number,
  gravity: number,
  damping: number,
): number {
  if (damping <= 0 || gravity === 0) {
    return Number.NaN;
  }

  const denominator = gravity - damping * velocity;
  if (denominator === 0) {
    return Number.NaN;
  }

  const ratio = gravity / denominator;
  if (ratio <= 0 || ratio >= 1) {
    return Number.NaN;
  }

  return -Math.log(ratio) / damping;
}

function particleBurstBoundsCenter(
  position: readonly [number, number, number],
  centerOverride: Vec3Like | undefined,
): [number, number, number] {
  if (centerOverride === undefined) {
    return [...position];
  }

  return [
    position[0] + finiteNumber(centerOverride[0], 0),
    position[1] + finiteNumber(centerOverride[1], 0),
    position[2] + finiteNumber(centerOverride[2], 0),
  ];
}

function aabbCenter(aabb: Aabb): [number, number, number] {
  return [
    (aabb.min[0] + aabb.max[0]) * 0.5,
    (aabb.min[1] + aabb.max[1]) * 0.5,
    (aabb.min[2] + aabb.max[2]) * 0.5,
  ];
}

function farthestAabbCornerDistance(
  center: readonly [number, number, number],
  aabb: Aabb,
): number {
  const dx = Math.max(
    Math.abs(aabb.min[0] - center[0]),
    Math.abs(aabb.max[0] - center[0]),
  );
  const dy = Math.max(
    Math.abs(aabb.min[1] - center[1]),
    Math.abs(aabb.max[1] - center[1]),
  );
  const dz = Math.max(
    Math.abs(aabb.min[2] - center[2]),
    Math.abs(aabb.max[2] - center[2]),
  );

  return Math.hypot(dx, dy, dz);
}

function sphereAabb(
  center: readonly [number, number, number],
  radius: number,
): Aabb {
  return {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback);

  return number > 0 ? number : fallback;
}
