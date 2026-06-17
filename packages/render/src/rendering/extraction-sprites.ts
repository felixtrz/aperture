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
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteSizeMode,
  Sprite,
  Visibility,
  validateSpriteInput,
} from "./index.js";
import {
  createRenderSortKey,
  createStableRenderId,
  encodeQuadInstanceFlags,
  QUAD_INSTANCE_FLOAT_STRIDE,
  QUAD_INSTANCE_WORD_STRIDE,
  type BoundsPacket,
  type QuadBatchPacket,
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
  quadInstanceFloats: number[],
  quadInstanceWords: number[],
  quadBatches: QuadBatchPacket[],
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
      pipelineKey: "sprite-billboard",
      materialKey: textureKey,
      meshKey: "sprite-quad",
      stableId,
    });
    const firstInstance =
      quadInstanceFloats.length / QUAD_INSTANCE_FLOAT_STRIDE;

    bounds.push(boundsPacket);
    writeSpriteQuadInstance({
      entity,
      input,
      stableId,
      sortDepth,
      worldTransformOffset,
      quadInstanceFloats,
      quadInstanceWords,
    });
    quadBatches.push({
      batchId: stableId,
      kind: "sprite",
      texture: input.texture,
      ...(input.sampler === undefined ? {} : { sampler: input.sampler }),
      materialKey: textureKey,
      pipelineVariant: "sprite",
      coordinateMode: input.coordinateMode ?? SpriteCoordinateMode.World,
      billboardMode: input.billboardMode ?? SpriteBillboardMode.Spherical,
      sizeMode: input.sizeMode ?? SpriteSizeMode.WorldUnits,
      blendMode: input.blendMode ?? SpriteBlendMode.Alpha,
      depthMode: input.depthMode ?? "test",
      firstInstance,
      instanceCount: 1,
      layerMask,
      sortKey,
    });
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
      worldTransformOffset,
      boundsIndex,
      layerMask,
      sortKey,
    });
  }

  return draws;
}

function writeSpriteQuadInstance(options: {
  readonly entity: Entity;
  readonly input: ReturnType<typeof spriteInput>;
  readonly stableId: number;
  readonly sortDepth: number;
  readonly worldTransformOffset: number;
  readonly quadInstanceFloats: number[];
  readonly quadInstanceWords: number[];
}): void {
  const width = options.entity.getValue(Sprite, "width") ?? 1;
  const height = options.entity.getValue(Sprite, "height") ?? 1;
  const color = options.entity.getVectorView(Sprite, "color");
  const uvRect = options.input.uvRect ?? [0, 0, 1, 1];
  const pivot = options.input.pivot ?? [0.5, 0.5];
  const floatStart = options.quadInstanceFloats.length;
  const wordStart = options.quadInstanceWords.length;

  for (let index = 0; index < QUAD_INSTANCE_FLOAT_STRIDE; index += 1) {
    options.quadInstanceFloats.push(0);
  }

  options.quadInstanceFloats[floatStart] = 0;
  options.quadInstanceFloats[floatStart + 1] = 0;
  options.quadInstanceFloats[floatStart + 2] = 0;
  options.quadInstanceFloats[floatStart + 3] = options.sortDepth;
  options.quadInstanceFloats[floatStart + 4] = width;
  options.quadInstanceFloats[floatStart + 5] = height;
  options.quadInstanceFloats[floatStart + 6] = options.input.rotation ?? 0;
  options.quadInstanceFloats[floatStart + 7] = pivot[0] ?? 0.5;
  options.quadInstanceFloats[floatStart + 8] = pivot[1] ?? 0.5;
  options.quadInstanceFloats[floatStart + 9] = uvRect[0] ?? 0;
  options.quadInstanceFloats[floatStart + 10] = uvRect[1] ?? 0;
  options.quadInstanceFloats[floatStart + 11] = uvRect[2] ?? 1;
  options.quadInstanceFloats[floatStart + 12] = uvRect[3] ?? 1;
  options.quadInstanceFloats[floatStart + 13] = color[0] ?? 1;
  options.quadInstanceFloats[floatStart + 14] = color[1] ?? 1;
  options.quadInstanceFloats[floatStart + 15] = color[2] ?? 1;
  options.quadInstanceFloats[floatStart + 16] = color[3] ?? 1;

  for (let index = 0; index < QUAD_INSTANCE_WORD_STRIDE; index += 1) {
    options.quadInstanceWords.push(0);
  }

  options.quadInstanceWords[wordStart] = options.worldTransformOffset >>> 0;
  options.quadInstanceWords[wordStart + 1] = 0xffff_ffff;
  options.quadInstanceWords[wordStart + 2] =
    (options.input.atlasFrame ?? 0) >>> 0;
  options.quadInstanceWords[wordStart + 3] = encodeQuadInstanceFlags({
    coordinateMode: options.input.coordinateMode ?? SpriteCoordinateMode.World,
    billboardMode: options.input.billboardMode ?? SpriteBillboardMode.Spherical,
    sizeMode: options.input.sizeMode ?? SpriteSizeMode.WorldUnits,
  });
  options.quadInstanceWords[wordStart + 4] = options.stableId >>> 0;
  options.quadInstanceWords[wordStart + 5] = options.entity.index >>> 0;
  options.quadInstanceWords[wordStart + 6] = options.entity.generation >>> 0;
  options.quadInstanceWords[wordStart + 7] = 0;
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
