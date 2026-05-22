import {
  assetHandleKey,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createMeshHandle,
  createRenderTargetHandle,
  type AssetHandle,
  type EnvironmentMapHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
  type RenderTargetHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import {
  Enabled,
  WorldTransform,
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import {
  createMaterialPipelineKeyInput,
  createStandardMaterialNormalMapTangentReadinessReport,
  createStandardMaterialTextureReadinessReport,
  type SamplerAsset,
  type MaterialAsset,
  type MaterialPipelineKeyInput,
  type MaterialTextureBinding,
  type StandardMaterialAsset,
  type TextureAsset,
} from "../materials/index.js";
import { type MeshAsset, validateMeshAsset } from "../mesh/index.js";
import {
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
  transformAabb,
  transformPoint,
  type Aabb,
  type BoundingSphere,
  type Mat4,
} from "@aperture-engine/simulation";
import {
  Camera,
  InstanceData,
  InstanceTint,
  Light,
  LightShadowSettings,
  Material,
  Mesh,
  RenderLayer,
  RenderOrder,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Visibility,
  registerRenderAuthoringComponents,
  type CameraInput,
  type LightInput,
  type LightShadowSettingsInput,
  validateCameraInput,
  validateLightInput,
  validateLightShadowSettingsInput,
} from "./index.js";
import {
  compareRenderSortKeys,
  createBatchCompatibilityKey,
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type EnvironmentPacket,
  type InstanceAttributePacket,
  type LightPacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
  type RenderEntityRef,
  type RenderQueue,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewPacket,
  type ViewCullStats,
} from "./snapshot.js";

export interface RenderExtractionOptions {
  readonly frame?: number;
  readonly cache?: RenderExtractionCache;
}

export interface RenderExtractionCache {
  readonly meshDrawEntities: Map<string, CachedMeshDrawEntity>;
  clear(): void;
}

type MeshDrawPacketTemplate = Omit<
  MeshDrawPacket,
  "worldTransformOffset" | "boundsIndex" | "instanceAttributePacketIndex"
>;

interface CachedMeshDrawEntity {
  readonly entityVersion: number;
  readonly cameraLayerMask: number;
  readonly viewCullSignature: number;
  readonly layerMask: number;
  readonly worldMatrix: readonly number[];
  readonly instanceTint: readonly number[] | null;
  readonly bounds: Omit<BoundsPacket, "boundsId">;
  readonly draws: readonly MeshDrawPacketTemplate[];
}

interface FrustumPlane {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly constant: number;
}

interface MutableViewCullStats {
  viewId: number;
  camera: RenderEntityRef;
  tested: number;
  culled: number;
  included: number;
}

interface ViewCullContext {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly priority: number;
  readonly layerMask: number;
  readonly frustumCulling: boolean;
  readonly planes: readonly FrustumPlane[];
  readonly stats: MutableViewCullStats;
}

interface SkinExtraction {
  readonly jointMatrices: readonly number[];
  readonly jointCount: number;
}

export function createRenderExtractionCache(): RenderExtractionCache {
  const meshDrawEntities = new Map<string, CachedMeshDrawEntity>();

  return {
    meshDrawEntities,
    clear() {
      meshDrawEntities.clear();
    },
  };
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
    instanceTints,
    instanceAttributes,
    instanceAttributePackets,
    bounds,
    diagnostics,
    cameraLayerMask,
    viewCullContexts,
    viewCullSignature,
    options.cache,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));

  return {
    frame: options.frame ?? 0,
    views,
    meshDraws,
    lights,
    environments,
    shadowRequests,
    bounds,
    transforms: new Float32Array(transforms),
    ...(bones.length === 0 ? {} : { bones: new Float32Array(bones) }),
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

function extractViews(
  world: EcsWorld,
  viewMatrices: number[],
  diagnostics: RenderDiagnostic[],
  viewCullContexts: ViewCullContext[],
): ViewPacket[] {
  const query = world.queryManager.registerQuery({ required: [Camera] });
  const views: ViewPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.cameraMissingTransform", entity));
      continue;
    }

    const validation = validateCameraInput(cameraInput(entity));

    if (!validation.valid) {
      for (const cameraDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${cameraDiagnostic.code}`, entity));
      }
      continue;
    }

    const layerMask = entity.getValue(Camera, "layerMask") ?? 1;
    const camera = entityRef(entity);
    const viewId = createStableRenderId(camera);
    const priority = entity.getValue(Camera, "priority") ?? 0;
    const worldMatrix = readWorldMatrix(entity);
    const viewMatrix = invertMat4(worldMatrix) ?? identityMat4();
    const projection = entity.getValue(Camera, "projection");
    const renderTarget = readRenderTarget(entity, diagnostics);
    const projectionMatrix =
      projection === "orthographic"
        ? makeOrthographic(
            -readCameraNumber(entity, "aspect") *
              readCameraNumber(entity, "orthographicHeight") *
              0.5,
            readCameraNumber(entity, "aspect") *
              readCameraNumber(entity, "orthographicHeight") *
              0.5,
            -readCameraNumber(entity, "orthographicHeight") * 0.5,
            readCameraNumber(entity, "orthographicHeight") * 0.5,
            readCameraNumber(entity, "near"),
            readCameraNumber(entity, "far"),
          )
        : makePerspective(
            readCameraNumber(entity, "fovYRadians"),
            readCameraNumber(entity, "aspect"),
            readCameraNumber(entity, "near"),
            readCameraNumber(entity, "far"),
          );
    const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
    const viewOffset = pushMatrix(viewMatrices, viewMatrix);
    const projectionOffset = pushMatrix(viewMatrices, projectionMatrix);
    const viewProjectionOffset = pushMatrix(viewMatrices, viewProjectionMatrix);

    viewCullContexts.push({
      viewId,
      camera,
      priority,
      layerMask,
      frustumCulling: entity.getValue(Camera, "frustumCulling") !== false,
      planes: createFrustumPlanes(viewProjectionMatrix),
      stats: {
        viewId,
        camera,
        tested: 0,
        culled: 0,
        included: 0,
      },
    });

    views.push({
      viewId,
      camera,
      priority,
      layerMask,
      viewMatrixOffset: viewOffset,
      projectionMatrixOffset: projectionOffset,
      viewProjectionMatrixOffset: viewProjectionOffset,
      viewport: Array.from(entity.getVectorView(Camera, "viewport")) as [
        number,
        number,
        number,
        number,
      ],
      scissor: Array.from(entity.getVectorView(Camera, "scissor")) as [
        number,
        number,
        number,
        number,
      ],
      clearColor: Array.from(entity.getVectorView(Camera, "clearColor")) as [
        number,
        number,
        number,
        number,
      ],
      clearDepth: entity.getValue(Camera, "clearDepth") ?? 1,
      clearStencil: entity.getValue(Camera, "clearStencil") ?? 0,
      renderTarget,
    });
  }

  viewCullContexts.sort(
    (a, b) => a.priority - b.priority || a.viewId - b.viewId,
  );
  return views.sort((a, b) => a.priority - b.priority || a.viewId - b.viewId);
}

function extractLights(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  diagnostics: RenderDiagnostic[],
  environments: EnvironmentPacket[],
  shadowRequests: ShadowRequestPacket[],
): LightPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Light],
  });
  const lights: LightPacket[] = [];

  for (const entity of sortedEntities(query.entities)) {
    const validation = validateLightInput(lightInput(entity));

    if (!validation.valid) {
      for (const lightDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${lightDiagnostic.code}`, entity));
      }
      continue;
    }

    const kind = (entity.getValue(Light, "kind") ??
      "directional") as LightPacket["kind"];
    const shadowSettings = readShadowSettings(entity, diagnostics);

    if (kind === "environment") {
      diagnoseUnsupportedShadowRequest(
        entity,
        kind,
        shadowSettings,
        diagnostics,
      );
      const handle = readEnvironmentMapHandle(entity, diagnostics);

      if (
        handle === undefined ||
        (handle !== null &&
          !validateEnvironmentMapAssetState(
            handle,
            assets,
            entity,
            diagnostics,
          ))
      ) {
        continue;
      }

      environments.push({
        environmentId: createStableRenderId(entityRef(entity)),
        handle,
        color: Array.from(entity.getVectorView(Light, "color")) as [
          number,
          number,
          number,
          number,
        ],
        intensity: entity.getValue(Light, "intensity") ?? 1,
        layerMask: entity.getValue(Light, "layerMask") ?? 1,
      });
      continue;
    }

    const hasWorldTransform = entity.hasComponent(WorldTransform);

    if (!hasWorldTransform && requiresLightTransform(kind)) {
      diagnostics.push(diagnostic("render.lightMissingTransform", entity));
      continue;
    }

    const worldTransformOffset = pushMatrix(
      transforms,
      hasWorldTransform ? readWorldMatrix(entity) : identityMat4(),
    );

    lights.push({
      lightId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      kind,
      color: Array.from(entity.getVectorView(Light, "color")) as [
        number,
        number,
        number,
        number,
      ],
      intensity: entity.getValue(Light, "intensity") ?? 1,
      range: entity.getValue(Light, "range") ?? 10,
      innerConeAngle: entity.getValue(Light, "innerConeAngle") ?? Math.PI / 8,
      outerConeAngle: entity.getValue(Light, "outerConeAngle") ?? Math.PI / 6,
      worldTransformOffset,
      layerMask: entity.getValue(Light, "layerMask") ?? 1,
    });

    appendShadowRequest(
      entity,
      kind,
      shadowSettings,
      shadowRequests,
      diagnostics,
    );
  }

  return lights;
}

function requiresLightTransform(kind: LightPacket["kind"]): boolean {
  return kind !== "ambient" && kind !== "environment";
}

function readShadowSettings(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): LightShadowSettingsInput | null {
  if (!entity.hasComponent(LightShadowSettings)) {
    return null;
  }

  const settings: LightShadowSettingsInput = {
    enabled: entity.getValue(LightShadowSettings, "enabled") ?? false,
    mapSize: entity.getValue(LightShadowSettings, "mapSize") ?? 1024,
    bias: entity.getValue(LightShadowSettings, "bias") ?? 0,
    normalBias: entity.getValue(LightShadowSettings, "normalBias") ?? 0,
    casterLayerMask:
      entity.getValue(LightShadowSettings, "casterLayerMask") ?? -1,
    receiverLayerMask:
      entity.getValue(LightShadowSettings, "receiverLayerMask") ?? -1,
  };
  const validation = validateLightShadowSettingsInput(settings);

  if (!validation.valid) {
    for (const shadowDiagnostic of validation.diagnostics) {
      diagnostics.push(diagnostic(`render.${shadowDiagnostic.code}`, entity));
    }
    return null;
  }

  return settings;
}

function appendShadowRequest(
  entity: Entity,
  kind: LightPacket["kind"],
  settings: LightShadowSettingsInput | null,
  shadowRequests: ShadowRequestPacket[],
  diagnostics: RenderDiagnostic[],
): void {
  if (settings?.enabled !== true) {
    return;
  }

  if (kind !== "directional" && kind !== "point" && kind !== "spot") {
    diagnoseUnsupportedShadowRequest(entity, kind, settings, diagnostics);
    return;
  }

  const lightId = createStableRenderId(entityRef(entity));

  shadowRequests.push({
    shadowId: lightId,
    lightId,
    lightKind: kind,
    casterLayerMask: settings.casterLayerMask ?? -1,
    receiverLayerMask: settings.receiverLayerMask ?? -1,
  });
}

function diagnoseUnsupportedShadowRequest(
  entity: Entity,
  kind: LightPacket["kind"],
  settings: LightShadowSettingsInput | null,
  diagnostics: RenderDiagnostic[],
): void {
  if (settings?.enabled === true) {
    diagnostics.push(
      diagnostic(`render.shadowUnsupportedLightKind.${kind}`, entity),
    );
  }
}

function extractMeshDraws(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bones: number[],
  instanceTints: number[],
  instanceAttributes: number[],
  instanceAttributePackets: InstanceAttributePacket[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
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

    const boneMatrixOffset =
      skinning === undefined ? undefined : pushBoneMatrices(bones, skinning);
    const boundsIndex = bounds.length;

    bounds.push(boundsPacket);

    const entityDiagnosticsStart = diagnostics.length;
    const entityDraws: MeshDrawPacket[] = [];

    for (const submesh of meshEntry.asset.submeshes) {
      const materialHandle = parseMaterialHandle(
        entity.getValue(Material, "materialId") ?? "",
      );
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
      });

      const stableId =
        createStableRenderId(entityRef(entity)) + submesh.materialSlot;
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
        submesh: submesh.materialSlot,
        materialSlot: submesh.materialSlot,
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
        sortKey: createRenderSortKey({
          queue,
          layer: layerMask,
          order: entity.hasComponent(RenderOrder)
            ? (entity.getValue(RenderOrder, "value") ?? 0)
            : 0,
          materialKey,
          meshKey,
          stableId,
        }),
        batchKey: createBatchCompatibilityKey({
          materialPipeline,
          materialKey,
          meshLayoutKey: meshEntry.asset.vertexStreams
            .flatMap((stream) =>
              stream.attributes.map((attribute) => attribute.semantic),
            )
            .join(","),
          topology: submesh.topology,
          skinned:
            skinning !== undefined && materialEntry.asset.kind === "standard",
        }),
      });
    }

    draws.push(...entityDraws);

    if (
      cache !== undefined &&
      entityDraws.length > 0 &&
      diagnostics.length === entityDiagnosticsStart &&
      !entity.hasComponent(InstanceData) &&
      !entity.hasComponent(Skin)
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

function appendCachedMeshDrawEntity(
  cached: CachedMeshDrawEntity,
  transforms: number[],
  instanceTints: number[],
  bounds: BoundsPacket[],
  draws: MeshDrawPacket[],
): void {
  const worldTransformOffset = pushMatrix(transforms, cached.worldMatrix);
  const instanceTintOffset =
    cached.instanceTint === null
      ? undefined
      : pushVec4(instanceTints, cached.instanceTint);
  const boundsIndex = bounds.length;

  bounds.push({
    boundsId: boundsIndex,
    ...cached.bounds,
  });

  for (const draw of cached.draws) {
    draws.push({
      ...draw,
      worldTransformOffset,
      ...(instanceTintOffset === undefined ? {} : { instanceTintOffset }),
      boundsIndex,
    });
  }
}

function createMeshDrawPacketTemplate(
  draw: MeshDrawPacket,
): MeshDrawPacketTemplate {
  return {
    renderId: draw.renderId,
    entity: draw.entity,
    mesh: draw.mesh,
    material: draw.material,
    submesh: draw.submesh,
    materialSlot: draw.materialSlot,
    layerMask: draw.layerMask,
    ...(draw.instanceTintOffset === undefined
      ? {}
      : { instanceTintOffset: draw.instanceTintOffset }),
    ...(draw.castsShadow === undefined
      ? {}
      : { castsShadow: draw.castsShadow }),
    ...(draw.receivesShadow === undefined
      ? {}
      : { receivesShadow: draw.receivesShadow }),
    sortKey: draw.sortKey,
    batchKey: draw.batchKey,
  };
}

function isVisibleInAnyMatchingView(
  worldAabb: Aabb,
  layerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): boolean {
  let matchedView = false;
  let includedInAnyView = false;

  for (const context of viewCullContexts) {
    if ((context.layerMask & layerMask) === 0) {
      continue;
    }

    matchedView = true;

    if (!context.frustumCulling) {
      context.stats.included += 1;
      includedInAnyView = true;
      continue;
    }

    context.stats.tested += 1;

    if (aabbIntersectsFrustum(worldAabb, context.planes)) {
      context.stats.included += 1;
      includedInAnyView = true;
    } else {
      context.stats.culled += 1;
    }
  }

  return !matchedView || includedInAnyView;
}

function aabbIntersectsFrustum(
  aabb: Aabb,
  planes: readonly FrustumPlane[],
): boolean {
  for (const plane of planes) {
    const x = plane.x > 0 ? readVec3(aabb.max, 0) : readVec3(aabb.min, 0);
    const y = plane.y > 0 ? readVec3(aabb.max, 1) : readVec3(aabb.min, 1);
    const z = plane.z > 0 ? readVec3(aabb.max, 2) : readVec3(aabb.min, 2);

    if (plane.x * x + plane.y * y + plane.z * z + plane.constant < 0) {
      return false;
    }
  }

  return true;
}

function createFrustumPlanes(matrix: Mat4): readonly FrustumPlane[] {
  const m0 = readMat4(matrix, 0);
  const m1 = readMat4(matrix, 1);
  const m2 = readMat4(matrix, 2);
  const m3 = readMat4(matrix, 3);
  const m4 = readMat4(matrix, 4);
  const m5 = readMat4(matrix, 5);
  const m6 = readMat4(matrix, 6);
  const m7 = readMat4(matrix, 7);
  const m8 = readMat4(matrix, 8);
  const m9 = readMat4(matrix, 9);
  const m10 = readMat4(matrix, 10);
  const m11 = readMat4(matrix, 11);
  const m12 = readMat4(matrix, 12);
  const m13 = readMat4(matrix, 13);
  const m14 = readMat4(matrix, 14);
  const m15 = readMat4(matrix, 15);

  return [
    normalizePlane(m3 - m0, m7 - m4, m11 - m8, m15 - m12),
    normalizePlane(m3 + m0, m7 + m4, m11 + m8, m15 + m12),
    normalizePlane(m3 + m1, m7 + m5, m11 + m9, m15 + m13),
    normalizePlane(m3 - m1, m7 - m5, m11 - m9, m15 - m13),
    normalizePlane(m3 - m2, m7 - m6, m11 - m10, m15 - m14),
    normalizePlane(m2, m6, m10, m14),
  ];
}

function readMat4(matrix: Mat4, index: number): number {
  return matrix[index] ?? 0;
}

function normalizePlane(
  x: number | undefined,
  y: number | undefined,
  z: number | undefined,
  constant: number | undefined,
): FrustumPlane {
  const nx = x ?? 0;
  const ny = y ?? 0;
  const nz = z ?? 0;
  const d = constant ?? 0;
  const length = Math.hypot(nx, ny, nz);

  if (length === 0) {
    return { x: nx, y: ny, z: nz, constant: d };
  }

  return {
    x: nx / length,
    y: ny / length,
    z: nz / length,
    constant: d / length,
  };
}

function createViewCullSignature(
  viewCullContexts: readonly ViewCullContext[],
): number {
  let hash = 2_166_136_261;

  for (const context of viewCullContexts) {
    hash = hashCullNumber(hash, context.viewId);
    hash = hashCullNumber(hash, context.layerMask);
    hash = hashCullNumber(hash, context.frustumCulling ? 1 : 0);

    for (const plane of context.planes) {
      hash = hashCullNumber(hash, plane.x);
      hash = hashCullNumber(hash, plane.y);
      hash = hashCullNumber(hash, plane.z);
      hash = hashCullNumber(hash, plane.constant);
    }
  }

  return hash >>> 0;
}

function hashCullNumber(hash: number, value: number): number {
  const scaled = Number.isFinite(value) ? Math.trunc(value * 1_000_000) : 0;

  return Math.imul(hash ^ scaled, 16_777_619) >>> 0;
}

function validateStandardNormalMapReadiness(input: {
  readonly mesh: MeshAsset;
  readonly material: MaterialAsset;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  if (input.material.kind !== "standard") {
    return true;
  }

  const report = createStandardMaterialNormalMapTangentReadinessReport({
    mesh: input.mesh,
    material: input.material,
    meshKey: input.meshKey,
    materialKey: input.materialKey,
  });

  if (report.ready) {
    return true;
  }

  for (const readinessDiagnostic of report.diagnostics) {
    input.diagnostics.push({
      code: `render.${readinessDiagnostic.code}`,
      severity: readinessDiagnostic.severity,
      entity: entityRef(input.entity),
      assetKey: input.materialKey,
      message: readinessDiagnostic.message,
    });
  }

  return false;
}

function validateStandardMaterialTextureReadiness(input: {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  const report = createStandardMaterialTextureReadinessReport({
    registry: input.registry,
    material: input.material,
  });

  if (report.ready) {
    return true;
  }

  for (const readinessDiagnostic of report.diagnostics) {
    input.diagnostics.push({
      code: `render.${readinessDiagnostic.code}`,
      severity: readinessDiagnostic.severity,
      entity: entityRef(input.entity),
      assetKey: readinessDiagnostic.materialKey,
      materialKey: readinessDiagnostic.materialKey,
      ...(readinessDiagnostic.textureKey === undefined
        ? {}
        : { textureKey: readinessDiagnostic.textureKey }),
      ...(readinessDiagnostic.samplerKey === undefined
        ? {}
        : { samplerKey: readinessDiagnostic.samplerKey }),
      ...(readinessDiagnostic.field === undefined
        ? {}
        : { field: readinessDiagnostic.field }),
      ...(readinessDiagnostic.dependencyKind === undefined
        ? {}
        : { dependencyKind: readinessDiagnostic.dependencyKind }),
      ...(readinessDiagnostic.status === undefined
        ? {}
        : { status: readinessDiagnostic.status }),
      ...(readinessDiagnostic.expectedSemantic === undefined
        ? {}
        : { expectedSemantic: readinessDiagnostic.expectedSemantic }),
      ...(readinessDiagnostic.actualSemantic === undefined
        ? {}
        : { actualSemantic: readinessDiagnostic.actualSemantic }),
      ...(readinessDiagnostic.expectedColorSpaces === undefined
        ? {}
        : {
            expectedColorSpaces: [...readinessDiagnostic.expectedColorSpaces],
          }),
      ...(readinessDiagnostic.actualColorSpace === undefined
        ? {}
        : { actualColorSpace: readinessDiagnostic.actualColorSpace }),
      ...(readinessDiagnostic.texCoord === undefined
        ? {}
        : { texCoord: readinessDiagnostic.texCoord }),
      ...(readinessDiagnostic.supportedTexCoords === undefined
        ? {}
        : {
            supportedTexCoords: [...readinessDiagnostic.supportedTexCoords],
          }),
      ...(readinessDiagnostic.textureTransform === undefined
        ? {}
        : {
            textureTransform: {
              ...readinessDiagnostic.textureTransform,
              ...(readinessDiagnostic.textureTransform.offset === undefined
                ? {}
                : {
                    offset: [
                      readinessDiagnostic.textureTransform.offset[0],
                      readinessDiagnostic.textureTransform.offset[1],
                    ],
                  }),
              ...(readinessDiagnostic.textureTransform.scale === undefined
                ? {}
                : {
                    scale: [
                      readinessDiagnostic.textureTransform.scale[0],
                      readinessDiagnostic.textureTransform.scale[1],
                    ],
                  }),
            },
          }),
      message: readinessDiagnostic.message,
    });
  }

  return false;
}

function validateStandardMaterialUvSetReadiness(input: {
  readonly mesh: MeshAsset;
  readonly material: StandardMaterialAsset;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly entity: Entity;
  readonly diagnostics: RenderDiagnostic[];
}): boolean {
  if (!usesStandardTexCoord1(input.material)) {
    return true;
  }

  if (meshHasSemantic(input.mesh, "TEXCOORD_1")) {
    return true;
  }

  for (const [field, binding] of standardMaterialTextureBindings(
    input.material,
  )) {
    if (binding === null || binding.texture === null) {
      continue;
    }

    const texCoord = binding.texCoord ?? 0;

    if (texCoord !== 1) {
      continue;
    }

    const textureKey = assetHandleKey(binding.texture);

    input.diagnostics.push({
      code: "render.standardMaterialTexture.missingTexCoord1",
      severity: "warning",
      entity: entityRef(input.entity),
      assetKey: input.materialKey,
      materialKey: input.materialKey,
      meshKey: input.meshKey,
      textureKey,
      field,
      texCoord,
      message: `StandardMaterial ${field} uses TEXCOORD_1 texture '${textureKey}', but mesh '${input.meshKey}' does not provide a TEXCOORD_1 vertex attribute.`,
    });
  }

  return false;
}

function usesStandardTexCoord1(material: StandardMaterialAsset): boolean {
  return standardMaterialTextureBindings(material).some(([, binding]) => {
    return (
      binding !== null &&
      binding.texture !== null &&
      (binding.texCoord ?? 0) === 1
    );
  });
}

function standardMaterialTextureBindings(
  material: StandardMaterialAsset,
): readonly (readonly [
  (
    | "baseColorTexture"
    | "metallicRoughnessTexture"
    | "normalTexture"
    | "occlusionTexture"
    | "emissiveTexture"
  ),
  MaterialTextureBinding | null,
])[] {
  return [
    ["baseColorTexture", material.baseColorTexture],
    ["metallicRoughnessTexture", material.metallicRoughnessTexture],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveTexture", material.emissiveTexture],
  ];
}

function meshHasSemantic(mesh: MeshAsset, semantic: "TEXCOORD_1"): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
  );
}

function validateMaterialTextureDependencies(
  material: MaterialAsset,
  materialHandle: MaterialHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  if (material.kind !== "unlit" || material.baseColorTexture === null) {
    return true;
  }

  const binding = material.baseColorTexture;
  let valid = true;

  if (binding.texture === null) {
    diagnostics.push(
      diagnostic(
        "render.material.missingTextureHandle",
        entity,
        materialHandle,
      ),
    );
    valid = false;
  } else {
    valid =
      validateTextureAssetState(binding.texture, assets, entity, diagnostics) &&
      valid;
  }

  if (binding.sampler === null) {
    diagnostics.push(
      diagnostic(
        "render.material.missingSamplerHandle",
        entity,
        materialHandle,
      ),
    );
    valid = false;
  } else {
    valid =
      validateSamplerAssetState(binding.sampler, assets, entity, diagnostics) &&
      valid;
  }

  return valid;
}

function validateTextureAssetState(
  handle: TextureHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"texture", TextureAsset>(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.texture.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.texture.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

function validateSamplerAssetState(
  handle: SamplerHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"sampler", SamplerAsset>(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.sampler.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.sampler.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

function validateEnvironmentMapAssetState(
  handle: EnvironmentMapHandle,
  assets: AssetRegistry,
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): boolean {
  const entry = assets.get<"environment-map">(handle);

  if (entry === undefined) {
    diagnostics.push(diagnostic("render.environment.missing", entity, handle));
    return false;
  }

  if (entry.status !== "ready" || entry.asset === null) {
    diagnostics.push(
      diagnostic(`render.environment.${entry.status}`, entity, handle),
    );
    return false;
  }

  return true;
}

function createBoundsPacket(
  boundsId: number,
  entity: Entity,
  mesh: MeshAsset,
  worldMatrix: Mat4,
): BoundsPacket {
  const localAabb = mesh.localAabb as Aabb;
  const localSphere = mesh.localSphere as BoundingSphere;
  const center = transformPoint(worldMatrix, localSphere.center);

  return {
    boundsId,
    entity: entityRef(entity),
    localAabb,
    worldAabb: transformAabb(localAabb, worldMatrix),
    localSphere,
    worldSphere: { center, radius: localSphere.radius },
  };
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();

  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

function readVec3(values: Aabb["min"], index: 0 | 1 | 2): number {
  return values[index] ?? 0;
}

function readCameraNumber(
  entity: Entity,
  key: keyof typeof Camera.schema,
): number {
  const value = entity.getValue(Camera, key);
  return typeof value === "number" ? value : 0;
}

function readRenderTarget(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): RenderTargetHandle | null {
  const value = entity.getValue(Camera, "renderTargetId") ?? "";

  if (value === "") {
    return null;
  }

  const id = parseAssetId(value, "render-target");

  if (id === null) {
    diagnostics.push(
      diagnostic("render.camera.invalidRenderTargetHandle", entity),
    );
    return null;
  }

  return createRenderTargetHandle(id);
}

function readEnvironmentMapHandle(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): EnvironmentMapHandle | null | undefined {
  const value = entity.getValue(Light, "environmentMapId") ?? "";

  if (value === "") {
    return null;
  }

  const id = parseAssetId(value, "environment-map");

  if (id === null) {
    diagnostics.push(diagnostic("render.environment.invalidHandle", entity));
    return undefined;
  }

  return createEnvironmentMapHandle(id);
}

function cameraInput(entity: Entity): CameraInput {
  return {
    projection: (entity.getValue(Camera, "projection") ?? "perspective") as
      | "perspective"
      | "orthographic",
    fovYRadians: entity.getValue(Camera, "fovYRadians") ?? Math.PI / 3,
    aspect: entity.getValue(Camera, "aspect") ?? 1,
    near: entity.getValue(Camera, "near") ?? 0.1,
    far: entity.getValue(Camera, "far") ?? 1000,
    orthographicHeight: entity.getValue(Camera, "orthographicHeight") ?? 10,
    viewport: Array.from(entity.getVectorView(Camera, "viewport")) as [
      number,
      number,
      number,
      number,
    ],
    scissor: Array.from(entity.getVectorView(Camera, "scissor")) as [
      number,
      number,
      number,
      number,
    ],
    layerMask: entity.getValue(Camera, "layerMask") ?? 1,
    frustumCulling: entity.getValue(Camera, "frustumCulling") !== false,
  };
}

function lightInput(entity: Entity): LightInput {
  return {
    kind: (entity.getValue(Light, "kind") ?? "directional") as
      | "ambient"
      | "environment"
      | "directional"
      | "point"
      | "spot",
    intensity: entity.getValue(Light, "intensity") ?? 1,
    range: entity.getValue(Light, "range") ?? 10,
    innerConeAngle: entity.getValue(Light, "innerConeAngle") ?? Math.PI / 8,
    outerConeAngle: entity.getValue(Light, "outerConeAngle") ?? Math.PI / 6,
    layerMask: entity.getValue(Light, "layerMask") ?? 1,
  };
}

function pushMatrix(values: number[], matrix: Mat4): number {
  const offset = values.length;
  values.push(...matrix);
  return offset;
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

function createExtractedMaterialPipelineKeyInput(input: {
  readonly base: MaterialPipelineKeyInput;
  readonly material: MaterialAsset;
  readonly instanceTint: boolean;
  readonly skinned: boolean;
}): MaterialPipelineKeyInput {
  if (
    input.material.kind !== "standard" ||
    (!input.instanceTint && !input.skinned)
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

  return {
    ...input.base,
    features: [...features].sort(),
  };
}

function meshHasVertexSemantic(
  mesh: MeshAsset,
  semantic: "JOINTS_0" | "WEIGHTS_0",
): boolean {
  return mesh.vertexStreams.some((stream) =>
    stream.attributes.some((attribute) => attribute.semantic === semantic),
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

function pushVec4(values: number[], vector: ArrayLike<number>): number {
  const offset = values.length;
  values.push(vector[0] ?? 1, vector[1] ?? 1, vector[2] ?? 1, vector[3] ?? 1);
  return offset;
}

function parseMeshHandle(value: string): MeshHandle | null {
  const id = parseAssetId(value, "mesh");
  return id === null ? null : createMeshHandle(id);
}

function parseMaterialHandle(value: string): MaterialHandle | null {
  const id = parseAssetId(value, "material");
  return id === null ? null : createMaterialHandle(id);
}

function parseAssetId(value: string, kind: string): string | null {
  const prefix = `${kind}:`;
  return value.startsWith(prefix) && value.length > prefix.length
    ? value.slice(prefix.length)
    : null;
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

function sortedEntities(entities: Iterable<Entity>): Entity[] {
  return [...entities].sort(
    (a, b) => a.index - b.index || a.generation - b.generation,
  );
}

function entityCacheKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function entityRef(entity: Entity): RenderEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function diagnostic(
  code: string,
  entity: Entity,
  handle?: AssetHandle,
): RenderDiagnostic {
  const result: RenderDiagnostic = {
    code,
    severity: "warning",
    entity: entityRef(entity),
    message: code,
  };

  if (handle !== undefined) {
    return { ...result, assetKey: assetHandleKey(handle) };
  }

  return result;
}
