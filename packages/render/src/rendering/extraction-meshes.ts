import {
  assetHandleKey,
  Enabled,
  type AssetRegistry,
  type Entity,
  type EcsWorld,
  type MaterialHandle,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  createMaterialPipelineKeyInput,
  type MaterialAsset,
  type MaterialPipelineKeyInput,
} from "../materials/index.js";
import { type MeshAsset, validateMeshAsset } from "../mesh/index.js";
import {
  FogMode,
  InstanceData,
  InstanceTint,
  Material,
  MaterialSlots,
  Mesh,
  MorphTargetWeights,
  OcclusionQuery,
  RenderLayer,
  RenderOrder,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Visibility,
} from "./index.js";
import {
  createBatchCompatibilityKey,
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type FogPacket,
  type InstanceAttributePacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
  type RenderQueue,
} from "./snapshot.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import {
  validateMaterialTextureDependencies,
  validateStandardMaterialTextureReadiness,
  validateStandardMaterialUvSetReadiness,
  validateStandardNormalMapReadiness,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseMaterialHandle, parseMeshHandle } from "./extraction-inputs.js";
import {
  appendCachedMeshDrawEntity,
  createMeshDrawPacketTemplate,
  entityCacheKey,
  type RenderExtractionCache,
} from "./extraction-mesh-cache.js";
import { createBoundsPacket } from "./extraction-mesh-bounds.js";
import { meshLayoutStreamToken } from "./extraction-mesh-layout.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
import { pushVec4 } from "./extraction-packing.js";

export {
  createRenderExtractionCache,
  type RenderExtractionCache,
} from "./extraction-mesh-cache.js";

interface SkinExtraction {
  readonly jointMatrices: readonly number[];
  readonly jointCount: number;
}

export function extractMeshDraws(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bones: number[],
  morphTargetWeights: number[],
  instanceTints: number[],
  instanceAttributes: number[],
  instanceAttributePackets: InstanceAttributePacket[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  fogs: readonly FogPacket[],
  viewCullContexts: readonly ViewCullContext[],
  viewCullSignature: number,
  cache: RenderExtractionCache | undefined,
): MeshDrawPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Mesh, Material],
  });
  const draws: MeshDrawPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    const cacheKey = entityCacheKey(entity);
    const entityVersion = world.entityVersion(entity);
    const cached = cache?.meshDrawEntities.get(cacheKey);

    if (
      cached !== undefined &&
      cached.entityVersion === entityVersion &&
      cached.cameraLayerMask === cameraLayerMask &&
      cached.viewCullSignature === viewCullSignature
    ) {
      if (
        !isVisibleInAnyMatchingView(
          cached.bounds.worldAabb,
          cached.layerMask,
          viewCullContexts,
        )
      ) {
        continue;
      }

      appendCachedMeshDrawEntity(
        cached,
        transforms,
        instanceTints,
        bounds,
        draws,
      );
      continue;
    }

    cache?.meshDrawEntities.delete(cacheKey);

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

    const layerMask = entity.hasComponent(RenderLayer)
      ? (entity.getValue(RenderLayer, "mask") ?? 1)
      : 1;
    const castsShadow = entity.hasComponent(ShadowCaster)
      ? (entity.getValue(ShadowCaster, "enabled") ?? true)
      : true;
    const receivesShadow = entity.hasComponent(ShadowReceiver)
      ? (entity.getValue(ShadowReceiver, "enabled") ?? true)
      : true;

    if (layerMask === 0) {
      diagnostics.push(diagnostic("render.zeroLayerMask", entity));
      continue;
    }

    if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
      diagnostics.push(diagnostic("render.layerMismatch", entity));
      continue;
    }

    const meshHandle = parseMeshHandle(entity.getValue(Mesh, "meshId") ?? "");
    const meshEntry =
      meshHandle === null
        ? undefined
        : assets.get<"mesh", MeshAsset>(meshHandle);

    if (meshHandle === null || meshEntry === undefined) {
      diagnostics.push(diagnostic("render.missingMeshHandle", entity));
      continue;
    }

    if (meshEntry.status !== "ready" || meshEntry.asset === null) {
      diagnostics.push(
        diagnostic(`render.mesh.${meshEntry.status}`, entity, meshHandle),
      );
      continue;
    }

    const worldMatrix = readWorldMatrix(entity);
    const boundsPacket = createBoundsPacket(
      bounds.length,
      entity,
      meshEntry.asset,
      worldMatrix,
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

    const meshValidation = validateMeshAsset(meshEntry.asset);

    if (!meshValidation.valid) {
      for (const meshDiagnostic of meshValidation.diagnostics) {
        diagnostics.push(
          diagnostic(`render.${meshDiagnostic.code}`, entity, meshHandle),
        );
      }
      continue;
    }

    const worldTransformOffset = pushMatrix(transforms, worldMatrix);
    const instanceTintOffset = pushInstanceTint(instanceTints, entity);
    const instanceAttributePacketIndex = pushInstanceAttributePacket(
      instanceAttributes,
      instanceAttributePackets,
      diagnostics,
      entity,
    );
    const skinning = readSkinning(entity, meshEntry.asset, diagnostics);

    if (skinning === null) {
      continue;
    }

    const morphWeights = readMorphTargetWeights(
      entity,
      meshEntry.asset,
      diagnostics,
    );

    if (morphWeights === null) {
      continue;
    }

    if (morphWeights !== undefined) {
      pushMorphTargetWeights(
        morphTargetWeights,
        worldTransformOffset,
        morphWeights,
      );
    }

    const boneMatrixOffset =
      skinning === undefined ? undefined : pushBoneMatrices(bones, skinning);
    const occlusionQuery =
      entity.hasComponent(OcclusionQuery) &&
      entity.getValue(OcclusionQuery, "enabled") !== false;
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

    const entityDiagnosticsStart = diagnostics.length;
    const entityDraws: MeshDrawPacket[] = [];

    const primaryMaterialHandle = parseMaterialHandle(
      entity.getValue(Material, "materialId") ?? "",
    );
    const materialSlots = readMaterialSlots(entity, diagnostics);

    for (
      let submeshIndex = 0;
      submeshIndex < meshEntry.asset.submeshes.length;
      submeshIndex += 1
    ) {
      const submesh = meshEntry.asset.submeshes[submeshIndex];

      if (submesh === undefined) {
        continue;
      }

      const materialHandle =
        materialSlots.get(submesh.materialSlot) ?? primaryMaterialHandle;
      const materialEntry =
        materialHandle === null
          ? undefined
          : assets.get<"material", MaterialAsset>(materialHandle);

      if (materialHandle === null || materialEntry === undefined) {
        diagnostics.push(diagnostic("render.missingMaterialHandle", entity));
        continue;
      }

      if (materialEntry.status !== "ready" || materialEntry.asset === null) {
        diagnostics.push(
          diagnostic(
            `render.material.${materialEntry.status}`,
            entity,
            materialHandle,
          ),
        );
        continue;
      }

      if (
        !validateMaterialTextureDependencies(
          materialEntry.asset,
          materialHandle,
          assets,
          entity,
          diagnostics,
        )
      ) {
        continue;
      }

      const materialKey = assetHandleKey(materialHandle);
      const meshKey = assetHandleKey(meshHandle);

      if (
        materialEntry.asset.kind === "standard" &&
        !validateStandardMaterialTextureReadiness({
          registry: assets,
          material: materialHandle,
          entity,
          diagnostics,
        })
      ) {
        continue;
      }

      if (
        materialEntry.asset.kind === "standard" &&
        !validateStandardMaterialUvSetReadiness({
          mesh: meshEntry.asset,
          material: materialEntry.asset,
          meshKey,
          materialKey,
          entity,
          diagnostics,
        })
      ) {
        continue;
      }

      const queue = materialQueue(materialEntry.asset);
      const baseMaterialPipeline = createMaterialPipelineKeyInput(
        materialEntry.asset,
      );
      const materialPipeline = createExtractedMaterialPipelineKeyInput({
        base: baseMaterialPipeline,
        material: materialEntry.asset,
        instanceTint: instanceTintOffset !== undefined,
        skinned: skinning !== undefined,
        morphed: morphWeights !== undefined,
        fogMode: selectFogModeForLayer(layerMask, fogs),
      });

      const stableId = createStableRenderId(entityRef(entity)) + submeshIndex;
      const normalMapReadiness = validateStandardNormalMapReadiness({
        mesh: meshEntry.asset,
        material: materialEntry.asset,
        meshKey,
        materialKey,
        entity,
        diagnostics,
      });

      if (!normalMapReadiness) {
        continue;
      }

      entityDraws.push({
        renderId: stableId,
        entity: entityRef(entity),
        mesh: meshHandle,
        material: materialHandle,
        submesh: submeshIndex,
        materialSlot: submesh.materialSlot,
        vertexStart: submesh.vertexStart,
        vertexCount: submesh.vertexCount,
        indexStart: submesh.indexStart,
        indexCount: submesh.indexCount,
        worldTransformOffset,
        ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
        ...(instanceAttributePacketIndex === undefined
          ? {}
          : { instanceAttributePacketIndex }),
        ...(boneMatrixOffset === undefined || skinning === undefined
          ? {}
          : {
              boneMatrixOffset,
              boneMatrixCount: skinning.jointCount,
            }),
        boundsIndex,
        layerMask,
        castsShadow,
        receivesShadow,
        ...(occlusionQuery ? { occlusionQuery } : {}),
        sortKey: createRenderSortKey({
          queue,
          viewId: sortViewId,
          layer: layerMask,
          order: entity.hasComponent(RenderOrder)
            ? (entity.getValue(RenderOrder, "value") ?? 0)
            : 0,
          depth: sortDepth,
          materialKey,
          meshKey,
          stableId,
        }),
        batchKey: createBatchCompatibilityKey({
          materialPipeline,
          materialKey,
          meshLayoutKey: meshEntry.asset.vertexStreams
            .map(meshLayoutStreamToken)
            .join("|"),
          topology: submesh.topology,
          skinned:
            skinning !== undefined && materialEntry.asset.kind === "standard",
          morphed:
            morphWeights !== undefined &&
            materialEntry.asset.kind === "standard",
        }),
      });
    }

    draws.push(...entityDraws);

    if (
      cache !== undefined &&
      entityDraws.length > 0 &&
      diagnostics.length === entityDiagnosticsStart &&
      !entity.hasComponent(InstanceData) &&
      !entity.hasComponent(Skin) &&
      morphWeights === undefined
    ) {
      const sourceBounds = bounds[boundsIndex];

      if (sourceBounds !== undefined) {
        cache.meshDrawEntities.set(cacheKey, {
          entityVersion,
          cameraLayerMask,
          viewCullSignature,
          layerMask,
          worldMatrix: Array.from(worldMatrix),
          instanceTint:
            instanceTintOffset === undefined
              ? null
              : instanceTints.slice(instanceTintOffset, instanceTintOffset + 4),
          bounds: {
            entity: sourceBounds.entity,
            localAabb: sourceBounds.localAabb,
            worldAabb: sourceBounds.worldAabb,
            localSphere: sourceBounds.localSphere,
            worldSphere: sourceBounds.worldSphere,
          },
          draws: entityDraws.map(createMeshDrawPacketTemplate),
        });
      }
    }
  }

  return draws;
}

function pushInstanceTint(
  values: number[],
  entity: Entity,
): number | undefined {
  if (!entity.hasComponent(InstanceTint)) {
    return undefined;
  }

  return pushVec4(values, entity.getVectorView(InstanceTint, "color"));
}

function pushInstanceAttributePacket(
  values: number[],
  packets: InstanceAttributePacket[],
  diagnostics: RenderDiagnostic[],
  entity: Entity,
): number | undefined {
  if (!entity.hasComponent(InstanceData)) {
    return undefined;
  }

  const materialKind = entity.getValue(InstanceData, "materialKind") ?? "";
  const valuesJson = entity.getValue(InstanceData, "valuesJson") ?? "{}";
  const fields: InstanceAttributePacket["fields"][number][] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(valuesJson);
  } catch {
    diagnostics.push(diagnostic("render.instanceData.invalidJson", entity));
    return undefined;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.push(diagnostic("render.instanceData.invalidValues", entity));
    return undefined;
  }

  for (const name of Object.keys(parsed).sort()) {
    const source = (parsed as Record<string, unknown>)[name];
    const components = instanceDataComponents(source);

    if (components === null) {
      diagnostics.push(diagnostic("render.instanceData.invalidValue", entity));
      continue;
    }

    const offset = values.length;

    values.push(...components);
    fields.push({
      name,
      offset,
      components: components.length,
    });
  }

  if (fields.length === 0) {
    return undefined;
  }

  const packetIndex = packets.length;

  packets.push({
    packetIndex,
    entity: entityRef(entity),
    materialKind,
    fields,
  });

  return packetIndex;
}

function readSkinning(
  entity: Entity,
  mesh: MeshAsset,
  diagnostics: RenderDiagnostic[],
): SkinExtraction | undefined | null {
  if (!entity.hasComponent(Skin)) {
    return undefined;
  }

  if (!meshHasVertexSemantic(mesh, "JOINTS_0")) {
    diagnostics.push(diagnostic("render.skinning.missingJoints0", entity));
    return null;
  }

  if (!meshHasVertexSemantic(mesh, "WEIGHTS_0")) {
    diagnostics.push(diagnostic("render.skinning.missingWeights0", entity));
    return null;
  }

  const jointCount = entity.getValue(Skin, "jointCount") ?? 0;
  const jointMatricesJson = entity.getValue(Skin, "jointMatricesJson") ?? "[]";
  let parsed: unknown;

  try {
    parsed = JSON.parse(jointMatricesJson);
  } catch {
    diagnostics.push(diagnostic("render.skinning.invalidJson", entity));
    return null;
  }

  if (!Array.isArray(parsed)) {
    diagnostics.push(diagnostic("render.skinning.invalidMatrices", entity));
    return null;
  }

  const jointMatrices = parseFiniteNumberArray(parsed);

  if (jointMatrices === null || jointMatrices.length === 0) {
    diagnostics.push(diagnostic("render.skinning.invalidMatrices", entity));
    return null;
  }

  if (jointMatrices.length % 16 !== 0) {
    diagnostics.push(diagnostic("render.skinning.misalignedMatrices", entity));
    return null;
  }

  const matrixCount = jointMatrices.length / 16;

  if (jointCount !== matrixCount) {
    diagnostics.push(diagnostic("render.skinning.jointCountMismatch", entity));
    return null;
  }

  return { jointMatrices, jointCount: matrixCount };
}

function pushBoneMatrices(values: number[], skinning: SkinExtraction): number {
  const offset = values.length;

  values.push(...skinning.jointMatrices);
  return offset;
}

function readMorphTargetWeights(
  entity: Entity,
  mesh: MeshAsset,
  diagnostics: RenderDiagnostic[],
): readonly [number, number, number, number] | undefined | null {
  if (!meshHasStandardMorphTargetAttributes(mesh)) {
    return undefined;
  }

  if (!entity.hasComponent(MorphTargetWeights)) {
    return [0, 0, 0, 0];
  }

  const weightsJson =
    entity.getValue(MorphTargetWeights, "weightsJson") ?? "[]";
  let parsed: unknown;

  try {
    parsed = JSON.parse(weightsJson);
  } catch {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidJson", entity),
    );
    return null;
  }

  if (!Array.isArray(parsed)) {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidWeights", entity),
    );
    return null;
  }

  const weights = parseFiniteNumberArray(parsed);

  if (weights === null) {
    diagnostics.push(
      diagnostic("render.morphTargetWeights.invalidWeights", entity),
    );
    return null;
  }

  return [
    clamp(weights[0] ?? 0, -1, 1),
    clamp(weights[1] ?? 0, -1, 1),
    clamp(weights[2] ?? 0, -1, 1),
    clamp(weights[3] ?? 0, -1, 1),
  ];
}

function pushMorphTargetWeights(
  values: number[],
  worldTransformOffset: number,
  weights: readonly [number, number, number, number],
): number {
  const packedOffset = (worldTransformOffset / 16) * 4;

  while (values.length < packedOffset + 4) {
    values.push(0);
  }

  values[packedOffset] = weights[0];
  values[packedOffset + 1] = weights[1];
  values[packedOffset + 2] = weights[2];
  values[packedOffset + 3] = weights[3];

  return packedOffset;
}

function createExtractedMaterialPipelineKeyInput(input: {
  readonly base: MaterialPipelineKeyInput;
  readonly material: MaterialAsset;
  readonly instanceTint: boolean;
  readonly skinned: boolean;
  readonly morphed: boolean;
  readonly fogMode?: FogMode | null;
}): MaterialPipelineKeyInput {
  if (
    input.material.kind !== "standard" ||
    (!input.instanceTint &&
      !input.skinned &&
      !input.morphed &&
      input.fogMode == null)
  ) {
    return input.base;
  }

  const features = new Set(input.base.features);

  if (input.instanceTint) {
    features.add("instance-tint");
  }

  if (input.skinned) {
    features.add("skinned");
  }

  if (input.morphed) {
    features.add("morphed");
  }

  const fogFeature = fogPipelineFeature(input.fogMode);

  if (fogFeature !== null) {
    features.add(fogFeature);
  }

  return {
    ...input.base,
    features: [...features].sort(),
  };
}

function selectFogModeForLayer(
  layerMask: number,
  fogs: readonly FogPacket[],
): FogMode | null {
  for (const fog of fogs) {
    if ((fog.layerMask & layerMask) !== 0) {
      return fog.mode;
    }
  }

  return null;
}

function fogPipelineFeature(mode: FogMode | null | undefined): string | null {
  switch (mode) {
    case FogMode.Linear:
      return "fogLinear";
    case FogMode.Exp:
      return "fogExp";
    case FogMode.Exp2:
      return "fogExp2";
    case null:
    case undefined:
      return null;
  }
}

function meshHasVertexSemantic(
  mesh: MeshAsset,
  semantic:
    | "JOINTS_0"
    | "WEIGHTS_0"
    | "MORPH_POSITION_0"
    | "MORPH_NORMAL_0"
    | "MORPH_POSITION_1"
    | "MORPH_NORMAL_1",
): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
  );
}

function meshHasStandardMorphTargetAttributes(mesh: MeshAsset): boolean {
  return (
    meshHasVertexSemantic(mesh, "MORPH_POSITION_0") &&
    meshHasVertexSemantic(mesh, "MORPH_NORMAL_0") &&
    meshHasVertexSemantic(mesh, "MORPH_POSITION_1") &&
    meshHasVertexSemantic(mesh, "MORPH_NORMAL_1")
  );
}

function parseFiniteNumberArray(values: readonly unknown[]): number[] | null {
  const result: number[] = [];

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    result.push(value);
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function instanceDataComponents(value: unknown): readonly number[] | null {
  const raw = Array.isArray(value) ? value : [value];

  if (raw.length < 1 || raw.length > 4) {
    return null;
  }

  const components: number[] = [];

  for (const component of raw) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      return null;
    }

    components.push(component);
  }

  return components;
}

function readMaterialSlots(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): Map<number, MaterialHandle> {
  const slots = new Map<number, MaterialHandle>();

  if (!entity.hasComponent(MaterialSlots)) {
    return slots;
  }

  const slotsJson = entity.getValue(MaterialSlots, "slotsJson") ?? "[]";
  let parsed: unknown;

  try {
    parsed = JSON.parse(slotsJson);
  } catch {
    diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
    return slots;
  }

  if (!Array.isArray(parsed)) {
    diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
    return slots;
  }

  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !Number.isInteger((entry as { slot?: unknown }).slot) ||
      ((entry as { slot?: number }).slot ?? -1) < 0 ||
      typeof (entry as { materialId?: unknown }).materialId !== "string"
    ) {
      diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
      continue;
    }

    const slot = (entry as { slot: number }).slot;
    const material = parseMaterialHandle(
      (entry as { materialId: string }).materialId,
    );

    if (material === null) {
      diagnostics.push(diagnostic("render.invalidMaterialSlots", entity));
      continue;
    }

    slots.set(slot, material);
  }

  return slots;
}

function materialQueue(material: MaterialAsset): RenderQueue {
  switch (material.renderState.alphaMode) {
    case "mask":
      return "alpha-test";
    case "blend":
      return "transparent";
    case "opaque":
      return "opaque";
  }
}
