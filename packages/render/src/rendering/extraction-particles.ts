import {
  assetHandleKey,
  Enabled,
  transformPoint,
  type Aabb,
  type AssetRegistry,
  type BoundingSphere,
  type EcsWorld,
  type Entity,
  type Mat4,
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
  type ParticleEffectAsset,
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
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
import {
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type ParticleEmitterPacket,
  type RenderDiagnostic,
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

    const radius = finitePositive(
      entity.getValue(ParticleEmitter, "boundsRadius"),
      1,
    );
    const center = Array.from(
      entity.getVectorView(ParticleEmitter, "boundsCenter"),
    ) as [number, number, number];
    const worldMatrix = readWorldMatrix(entity);
    const boundsPacket = createParticleBoundsPacket(
      bounds.length,
      entity,
      worldMatrix,
      center,
      radius,
    );

    if (
      !isVisibleInAnyMatchingView(
        boundsPacket.worldAabb,
        layerMask,
        viewCullContexts,
      )
    ) {
      continue;
    }

    const stableId = createStableRenderId(entityRef(entity));
    const effectKey = assetHandleKey(effect);
    const boundsIndex = bounds.length;
    const worldTransformOffset = pushMatrix(transforms, worldMatrix);
    const sortView = firstMatchingSortView(layerMask, viewCullContexts);
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
      order: entity.hasComponent(RenderOrder)
        ? (entity.getValue(RenderOrder, "value") ?? 0)
        : 0,
      depth: sortDepth,
      pipelineKey: "gpu-particles",
      materialKey: effectKey,
      meshKey: "particle-quad",
      stableId,
    });
    const capacity = Math.trunc(
      finitePositive(
        entity.getValue(ParticleEmitter, "capacity"),
        effectEntry.asset.capacity,
      ),
    );

    bounds.push(boundsPacket);
    packets.push({
      emitterId: stableId,
      entity: entityRef(entity),
      effect,
      effectVersion: effectEntry.version,
      capacity,
      seed: finiteInteger(entity.getValue(ParticleEmitter, "seed"), 1),
      resetEpoch: Math.max(
        0,
        finiteInteger(entity.getValue(ParticleEmitter, "resetEpoch"), 0),
      ),
      timeScale: Math.max(
        0,
        finiteNumber(entity.getValue(ParticleEmitter, "timeScale"), 1),
      ),
      simulationSpace:
        entity.getValue(ParticleEmitter, "simulationSpace") ===
        ParticleSimulationSpace.Local
          ? "local"
          : "world",
      worldTransformOffset,
      boundsIndex,
      layerMask,
      sortKey,
    });
  }

  const burstQueue = getParticleBurstQueue(world);
  if (burstQueue !== null) {
    packets.push(
      ...extractParticleBursts({
        assets,
        frame,
        transforms,
        bounds,
        diagnostics,
        cameraLayerMask,
        viewCullContexts,
        bursts: burstQueue.drain({ frame, assets, diagnostics }),
      }),
    );
  }

  return packets;
}

function extractParticleBursts(input: {
  readonly assets: AssetRegistry;
  readonly frame: number;
  readonly transforms: number[];
  readonly bounds: BoundsPacket[];
  readonly diagnostics: RenderDiagnostic[];
  readonly cameraLayerMask: number;
  readonly viewCullContexts: readonly ViewCullContext[];
  readonly bursts: readonly ActiveParticleBurst[];
}): ParticleEmitterPacket[] {
  const packets: ParticleEmitterPacket[] = [];

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
    const radius = finitePositive(
      burst.request.boundsRadius,
      Math.max(1, effect.startSize.max * 2 + effect.lifetime.max),
    );
    const boundsPacket = createParticleBurstBoundsPacket(
      input.bounds.length,
      position,
      radius,
    );

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
    const worldTransformOffset = pushMatrix(
      input.transforms,
      particleBurstWorldMatrix(position),
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
    const positionRange = particleBurstPositionRange(burst.request);
    const velocityRange = particleBurstVelocityRange(burst.request);

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

  return packets;
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

function particleBurstWorldMatrix(
  position: readonly [number, number, number],
): Mat4 {
  return [
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
}

function createParticleBoundsPacket(
  boundsId: number,
  entity: Entity,
  worldMatrix: Mat4,
  center: readonly [number, number, number],
  radius: number,
): BoundsPacket {
  const worldCenter = transformPoint(worldMatrix, center);
  const localAabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
  const worldAabb: Aabb = {
    min: [
      worldCenter[0] - radius,
      worldCenter[1] - radius,
      worldCenter[2] - radius,
    ],
    max: [
      worldCenter[0] + radius,
      worldCenter[1] + radius,
      worldCenter[2] + radius,
    ],
  };
  const localSphere: BoundingSphere = { center, radius };

  return {
    boundsId,
    entity: entityRef(entity),
    localAabb,
    worldAabb,
    localSphere,
    worldSphere: { center: worldCenter, radius },
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
