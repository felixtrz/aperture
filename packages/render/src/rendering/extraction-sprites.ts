import {
  assetHandleKey,
  Enabled,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  transformPoint,
  type Aabb,
  type BoundingSphere,
  type Mat4,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  RenderLayer,
  RenderOrder,
  Sprite,
  Visibility,
  validateSpriteInput,
} from "./index.js";
import {
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type RenderDiagnostic,
  type SpriteDrawPacket,
} from "./snapshot.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import {
  validateSamplerAssetState,
  validateTextureAssetState,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { spriteInput } from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";

export function extractSpriteDraws(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): SpriteDrawPacket[] {
  const query = world.queryManager.registerQuery({ required: [Sprite] });
  const draws: SpriteDrawPacket[] = [];

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

    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const input = spriteInput(entity);
    const validation = validateSpriteInput(input);

    if (!validation.valid) {
      for (const spriteDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${spriteDiagnostic.code}`, entity));
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

    if (
      !validateTextureAssetState(input.texture, assets, entity, diagnostics)
    ) {
      continue;
    }

    if (
      input.sampler !== undefined &&
      input.sampler !== null &&
      !validateSamplerAssetState(input.sampler, assets, entity, diagnostics)
    ) {
      continue;
    }

    const worldMatrix = readWorldMatrix(entity);
    const width = entity.getValue(Sprite, "width") ?? 1;
    const height = entity.getValue(Sprite, "height") ?? 1;
    const boundsPacket = createSpriteBoundsPacket(
      bounds.length,
      entity,
      worldMatrix,
      width,
      height,
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
    const textureKey = assetHandleKey(input.texture);
    const boundsIndex = bounds.length;
    const sortView = firstMatchingSortView(layerMask, viewCullContexts);
    const sortViewId = sortView?.viewId ?? 0;
    const sortDepth =
      sortView === undefined
        ? 0
        : computeViewDepth(
            sortView.viewMatrix,
            boundsPacket.worldSphere.center,
          );

    bounds.push(boundsPacket);
    draws.push({
      renderId: stableId,
      entity: entityRef(entity),
      texture: input.texture,
      ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
      color: Array.from(entity.getVectorView(Sprite, "color")) as [
        number,
        number,
        number,
        number,
      ],
      width,
      height,
      worldTransformOffset: pushMatrix(transforms, worldMatrix),
      boundsIndex,
      layerMask,
      sortKey: createRenderSortKey({
        queue: "transparent",
        viewId: sortViewId,
        layer: layerMask,
        order: entity.hasComponent(RenderOrder)
          ? (entity.getValue(RenderOrder, "value") ?? 0)
          : 0,
        depth: sortDepth,
        pipelineKey: "sprite-billboard",
        materialKey: textureKey,
        meshKey: "sprite-quad",
        stableId,
      }),
    });
  }

  return draws;
}

function createSpriteBoundsPacket(
  boundsId: number,
  entity: Entity,
  worldMatrix: Mat4,
  width: number,
  height: number,
): BoundsPacket {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const radius = Math.hypot(halfWidth, halfHeight);
  const center = transformPoint(worldMatrix, [0, 0, 0]);
  const localAabb: Aabb = {
    min: [-halfWidth, -halfHeight, -0.001],
    max: [halfWidth, halfHeight, 0.001],
  };
  const worldAabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
  const localSphere: BoundingSphere = {
    center: [0, 0, 0],
    radius,
  };

  return {
    boundsId,
    entity: entityRef(entity),
    localAabb,
    worldAabb,
    localSphere,
    worldSphere: { center, radius },
  };
}
