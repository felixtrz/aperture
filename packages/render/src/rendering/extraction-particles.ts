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

export function extractParticleEmitters(
  world: EcsWorld,
  assets: AssetRegistry,
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

  return packets;
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
