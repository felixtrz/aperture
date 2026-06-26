import {
  assetHandleKey,
  composeTrsMatrix,
  Enabled,
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
  type ParticleEmitterPacket,
  type RenderDiagnostic,
  type RenderEntityRef,
} from "./snapshot.js";
import {
  getParticleBurstQueue,
  particleBurstPositionRange,
  particleBurstVelocityRange,
  type ActiveParticleBurst,
} from "./particle-burst-queue.js";

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
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
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
    const timeScale = Math.max(
      0,
      finiteNumber(entity.getValue(ParticleEmitter, "timeScale"), 1),
    );
    const simulationSpace =
      entity.getValue(ParticleEmitter, "simulationSpace") ===
      ParticleSimulationSpace.Local
        ? "local"
        : "world";
    const renderOrder = entity.hasComponent(RenderOrder)
      ? (entity.getValue(RenderOrder, "value") ?? 0)
      : 0;

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
      timeScale,
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
  readonly capacity: number;
  readonly seed: number;
  readonly resetEpoch: number;
  readonly timeScale: number;
  readonly simulationSpace: "local" | "world";
  readonly layerMask: number;
  readonly renderOrder: number;
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
  readonly timeScale: number;
  readonly simulationSpace: "local" | "world";
  readonly layerMask: number;
  readonly renderOrder: number;
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
    request.boundsCenter,
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
    order: request.renderOrder,
    depth: sortDepth,
    pipelineKey: "gpu-particles",
    materialKey: effectKey,
    meshKey: "particle-quad",
    stableId: request.emitterId,
  });

  context.bounds.push(boundsPacket);
  context.packets.push({
    emitterId: request.emitterId,
    entity: entityRef(request.entity),
    effect: request.effect,
    effectVersion: request.effectVersion,
    capacity: request.capacity,
    seed: request.seed,
    resetEpoch: request.resetEpoch,
    timeScale: request.timeScale,
    simulationSpace: request.simulationSpace,
    worldTransformOffset,
    boundsIndex,
    layerMask: request.layerMask,
    sortKey,
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
      capacity: childEntry.asset.runtime.capacity,
      seed: composeParticleChildSeed(request.seed, index),
      resetEpoch: request.resetEpoch,
      timeScale: request.timeScale * child.timeScale,
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

/** Derives a deterministic, distinct RNG seed for a composite child emitter. */
function composeParticleChildSeed(
  parentSeed: number,
  childIndex: number,
): number {
  return (parentSeed + Math.imul(childIndex + 1, 0x9e3779b1)) | 0;
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
      finiteNumber(burst.request.position[0], 0),
      finiteNumber(burst.request.position[1], 0),
      finiteNumber(burst.request.position[2], 0),
    ] as const;
    const positionRange = particleBurstPositionRange(burst.request);
    const velocityRange = particleBurstVelocityRange(burst.request);
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
            positionRange,
            velocityRange,
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
      timeScale: Math.max(0, finiteNumber(burst.request.timeScale, 1)),
      simulationSpace: "world",
      worldTransformOffset,
      boundsIndex,
      layerMask,
      sortKey,
      mode: "burst",
      burst: {
        burstId: burst.seq,
        startFrame: burst.startFrame,
        startTime: burst.startTime,
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
      },
    });
  }
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
  readonly centerOverride?: Vec3Like;
  readonly effect: ParticleEmitterEffectAsset;
  readonly diagnostics: RenderDiagnostic[];
  readonly effectKey: string;
}): BoundsPacket {
  const lifetime = particleLifetimeMax(input.effect);
  const particleRadius = maxParticleBillboardRadius(input.effect);
  const x = particleDisplacementRange(
    input.velocityRange.min[0],
    input.velocityRange.max[0],
    input.effect.runtime.gravity[0],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const y = particleDisplacementRange(
    input.velocityRange.min[1],
    input.velocityRange.max[1],
    input.effect.runtime.gravity[1],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const z = particleDisplacementRange(
    input.velocityRange.min[2],
    input.velocityRange.max[2],
    input.effect.runtime.gravity[2],
    input.effect.runtime.linearDamping,
    lifetime,
  );
  const worldAabb: Aabb = {
    min: [
      input.positionRange.min[0] + x.min - particleRadius,
      input.positionRange.min[1] + y.min - particleRadius,
      input.positionRange.min[2] + z.min - particleRadius,
    ],
    max: [
      input.positionRange.max[0] + x.max + particleRadius,
      input.positionRange.max[1] + y.max + particleRadius,
      input.positionRange.max[2] + z.max + particleRadius,
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
