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
  Light,
  LightShadowSettings,
  Material,
  Mesh,
  RenderLayer,
  RenderOrder,
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
  type LightPacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
  type RenderEntityRef,
  type RenderQueue,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewPacket,
} from "./snapshot.js";

export interface RenderExtractionOptions {
  readonly frame?: number;
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
  const viewMatrices: number[] = [];
  const bounds: BoundsPacket[] = [];
  const views = extractViews(world, viewMatrices, diagnostics);
  const cameraLayerMask = views.reduce(
    (mask, view) => mask | view.layerMask,
    0,
  );
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
    bounds,
    diagnostics,
    cameraLayerMask,
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
    },
  };
}

function extractViews(
  world: EcsWorld,
  viewMatrices: number[],
  diagnostics: RenderDiagnostic[],
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
    const viewOffset = pushMatrix(viewMatrices, viewMatrix);
    const projectionOffset = pushMatrix(viewMatrices, projectionMatrix);
    const viewProjectionOffset = pushMatrix(
      viewMatrices,
      multiplyMat4(projectionMatrix, viewMatrix),
    );

    views.push({
      viewId: createStableRenderId(entityRef(entity)),
      camera: entityRef(entity),
      priority: entity.getValue(Camera, "priority") ?? 0,
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

  if (kind !== "directional") {
    diagnoseUnsupportedShadowRequest(entity, kind, settings, diagnostics);
    return;
  }

  const lightId = createStableRenderId(entityRef(entity));

  shadowRequests.push({
    shadowId: lightId,
    lightId,
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
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
): MeshDrawPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Mesh, Material],
  });
  const draws: MeshDrawPacket[] = [];

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

    const meshValidation = validateMeshAsset(meshEntry.asset);

    if (!meshValidation.valid) {
      for (const meshDiagnostic of meshValidation.diagnostics) {
        diagnostics.push(
          diagnostic(`render.${meshDiagnostic.code}`, entity, meshHandle),
        );
      }
      continue;
    }

    const worldMatrix = readWorldMatrix(entity);
    const worldTransformOffset = pushMatrix(transforms, worldMatrix);
    const boundsIndex = pushBounds(
      bounds,
      entity,
      meshEntry.asset,
      worldMatrix,
    );

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

      draws.push({
        renderId: stableId,
        entity: entityRef(entity),
        mesh: meshHandle,
        material: materialHandle,
        submesh: submesh.materialSlot,
        materialSlot: submesh.materialSlot,
        worldTransformOffset,
        boundsIndex,
        layerMask,
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
          materialPipeline: createMaterialPipelineKeyInput(materialEntry.asset),
          materialKey,
          meshLayoutKey: meshEntry.asset.vertexStreams
            .flatMap((stream) =>
              stream.attributes.map((attribute) => attribute.semantic),
            )
            .join(","),
          topology: submesh.topology,
        }),
      });
    }
  }

  return draws;
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

function pushBounds(
  bounds: BoundsPacket[],
  entity: Entity,
  mesh: MeshAsset,
  worldMatrix: Mat4,
): number {
  const localAabb = mesh.localAabb as Aabb;
  const localSphere = mesh.localSphere as BoundingSphere;
  const center = transformPoint(worldMatrix, localSphere.center);
  const packet: BoundsPacket = {
    boundsId: bounds.length,
    entity: entityRef(entity),
    localAabb,
    worldAabb: transformAabb(localAabb, worldMatrix),
    localSphere,
    worldSphere: { center, radius: localSphere.radius },
  };

  bounds.push(packet);
  return packet.boundsId;
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();

  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
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
