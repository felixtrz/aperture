import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import {
  WorldTransform,
  registerMetadataComponents,
  registerTransformComponents,
} from "@aperture-engine/simulation";
import {
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/simulation";
import {
  Camera,
  registerRenderAuthoringComponents,
  validateCameraInput,
} from "./index.js";
import {
  compareRenderSortKeys,
  createStableRenderId,
  type BoundsPacket,
  type EnvironmentPacket,
  type InstanceAttributePacket,
  type RenderDiagnostic,
  type RenderSnapshot,
  type ShadowRequestPacket,
  type ViewPacket,
  type ViewCullStats,
} from "./snapshot.js";
import {
  createFrustumPlanes,
  createViewCullSignature,
  type ViewCullContext,
} from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { extractFogs } from "./extraction-fogs.js";
import {
  applyTemporalJitter,
  cameraInput,
  readCameraNumber,
  readRenderTarget,
} from "./extraction-inputs.js";
import { extractLights } from "./extraction-lights.js";
import {
  extractMeshDraws,
  type RenderExtractionCache,
} from "./extraction-meshes.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
import { extractSkyboxes } from "./extraction-skyboxes.js";
import { extractSpriteDraws } from "./extraction-sprites.js";

export {
  createRenderExtractionCache,
  type RenderExtractionCache,
} from "./extraction-meshes.js";

export interface RenderExtractionOptions {
  readonly frame?: number;
  readonly cache?: RenderExtractionCache;
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
  const morphTargetWeights: number[] = [];
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
  const fogs = extractFogs(world, diagnostics, cameraLayerMask);
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
    morphTargetWeights,
    instanceTints,
    instanceAttributes,
    instanceAttributePackets,
    bounds,
    diagnostics,
    cameraLayerMask,
    fogs,
    viewCullContexts,
    viewCullSignature,
    options.cache,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  const spriteDraws = extractSpriteDraws(
    world,
    assets,
    transforms,
    bounds,
    diagnostics,
    cameraLayerMask,
    viewCullContexts,
  ).sort((a, b) => compareRenderSortKeys(a.sortKey, b.sortKey));
  const skyboxes = extractSkyboxes(world, assets, diagnostics, cameraLayerMask);

  return {
    frame: options.frame ?? 0,
    views,
    meshDraws,
    spriteDraws,
    skyboxes,
    fogs,
    lights,
    environments,
    shadowRequests,
    bounds,
    transforms: new Float32Array(transforms),
    ...(bones.length === 0 ? {} : { bones: new Float32Array(bones) }),
    ...(morphTargetWeights.length === 0
      ? {}
      : { morphTargetWeights: new Float32Array(morphTargetWeights) }),
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
      spriteDraws: spriteDraws.length,
      skyboxes: skyboxes.length,
      fogs: fogs.length,
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
    applyTemporalJitter(projectionMatrix, entity);
    const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
    const viewOffset = pushMatrix(viewMatrices, viewMatrix);
    const projectionOffset = pushMatrix(viewMatrices, projectionMatrix);
    const viewProjectionOffset = pushMatrix(viewMatrices, viewProjectionMatrix);

    viewCullContexts.push({
      viewId,
      camera,
      priority,
      layerMask,
      viewMatrix,
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
