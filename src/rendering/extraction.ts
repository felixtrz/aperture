import {
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
  createRenderTargetHandle,
  type AssetRegistry,
  type MaterialHandle,
  type MeshHandle,
  type RenderTargetHandle,
} from "../assets/index.js";
import type { EcsWorld, Entity } from "../ecs/index.js";
import {
  Enabled,
  WorldTransform,
  registerMetadataComponents,
  registerTransformComponents,
} from "../transform/index.js";
import {
  createMaterialPipelineKeyInput,
  type MaterialAsset,
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
} from "../math/index.js";
import {
  Camera,
  Light,
  MeshRenderer,
  RenderLayer,
  RenderOrder,
  Visibility,
  registerRenderAuthoringComponents,
  type CameraInput,
  type LightInput,
  validateCameraInput,
  validateLightInput,
} from "./index.js";
import {
  compareRenderSortKeys,
  createBatchCompatibilityKey,
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type LightPacket,
  type MeshDrawPacket,
  type RenderDiagnostic,
  type RenderEntityRef,
  type RenderQueue,
  type RenderSnapshot,
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
  const lights = extractLights(world, transforms, diagnostics);
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
    environments: [],
    shadowRequests: [],
    bounds,
    transforms: new Float32Array(transforms),
    viewMatrices: new Float32Array(viewMatrices),
    diagnostics,
    report: {
      views: views.length,
      meshDraws: meshDraws.length,
      lights: lights.length,
      environments: 0,
      shadowRequests: 0,
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
  transforms: number[],
  diagnostics: RenderDiagnostic[],
): LightPacket[] {
  const query = world.queryManager.registerQuery({
    required: [Light, WorldTransform],
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

    const worldTransformOffset = pushMatrix(
      transforms,
      readWorldMatrix(entity),
    );

    lights.push({
      lightId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      kind: (entity.getValue(Light, "kind") ??
        "directional") as LightPacket["kind"],
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
  }

  return lights;
}

function extractMeshDraws(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
): MeshDrawPacket[] {
  const query = world.queryManager.registerQuery({ required: [MeshRenderer] });
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

    const meshHandle = parseMeshHandle(
      entity.getValue(MeshRenderer, "meshId") ?? "",
    );
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
      const field = materialField(submesh.materialSlot);

      if (field === null) {
        diagnostics.push(diagnostic("render.unsupportedMaterialSlot", entity));
        continue;
      }

      const materialHandle = parseMaterialHandle(
        entity.getValue(MeshRenderer, field) ?? "",
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

      const queue = materialQueue(materialEntry.asset);
      const stableId =
        createStableRenderId(entityRef(entity)) + submesh.materialSlot;
      const materialKey = assetHandleKey(materialHandle);
      const meshKey = assetHandleKey(meshHandle);

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

function materialField(
  slot: number,
): "material0Id" | "material1Id" | "material2Id" | "material3Id" | null {
  switch (slot) {
    case 0:
      return "material0Id";
    case 1:
      return "material1Id";
    case 2:
      return "material2Id";
    case 3:
      return "material3Id";
    default:
      return null;
  }
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
  handle?: MeshHandle | MaterialHandle,
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
