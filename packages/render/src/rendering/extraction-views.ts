import type {
  AssetRegistry,
  EcsWorld,
  Entity,
} from "@aperture-engine/simulation";
import {
  WorldTransform,
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/simulation";
import { Camera, CameraClipPlanes, validateCameraInput } from "./index.js";
import {
  MAX_CLIP_PLANES,
  resolveClipPlanes,
  type ClipPlane,
} from "./clip-planes.js";
import {
  createStableRenderId,
  type RenderDiagnostic,
  type ViewPacket,
} from "./snapshot.js";
import { isRenderTargetAsset } from "../assets/render-target-asset.js";
import {
  createFrustumPlanes,
  type ViewCullContext,
} from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import {
  applyTemporalJitter,
  cameraInput,
  readCameraNumber,
  readRenderTarget,
} from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";
import {
  CUBE_CAPTURE_FACE_COUNT,
  createCubeCaptureFaceViewId,
  cubeCaptureFaceViewMatrix,
  resolveCubeCaptureSchedule,
} from "./extraction-cube-capture.js";
import type { RenderExtractionCache } from "./extraction-mesh-cache.js";

export interface ExtractViewsOptions {
  /** Extraction frame index (cube-capture scheduling input). */
  readonly frame?: number;
  /** Persistent extraction cache (cube-capture bookkeeping). */
  readonly cache?: RenderExtractionCache;
}

export function extractViews(
  world: EcsWorld,
  assets: AssetRegistry,
  viewMatrices: number[],
  diagnostics: RenderDiagnostic[],
  viewCullContexts: ViewCullContext[],
  options: ExtractViewsOptions = {},
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
    const renderTarget = readRenderTarget(entity, diagnostics);
    const clipPlanes = readCameraClipPlanes(entity, diagnostics);

    // B2: a camera paired with a cube render target is a capture camera — it
    // emits six face views per scheduled capture (and none in between, so an
    // idle probe costs nothing).
    if (renderTarget !== null && isCubeRenderTarget(assets, renderTarget)) {
      const capture = resolveCubeCaptureSchedule({
        frame: options.frame ?? 0,
        captureEvery: entity.getValue(Camera, "captureEvery") ?? 1,
        captureRequestFrame:
          entity.getValue(Camera, "captureRequestFrame") ?? -1,
        viewId,
        cubeCaptures: options.cache?.cubeCaptures,
      });

      if (!capture) {
        continue;
      }

      const position: [number, number, number] = [
        worldMatrix[12] ?? 0,
        worldMatrix[13] ?? 0,
        worldMatrix[14] ?? 0,
      ];
      const near = readCameraNumber(entity, "near");
      const far = readCameraNumber(entity, "far");
      const frustumCulling =
        entity.getValue(Camera, "frustumCulling") !== false;
      const clearColor = Array.from(
        entity.getVectorView(Camera, "clearColor"),
      ) as [number, number, number, number];
      const clearDepth = entity.getValue(Camera, "clearDepth") ?? 1;
      const clearStencil = entity.getValue(Camera, "clearStencil") ?? 0;

      for (let face = 0; face < CUBE_CAPTURE_FACE_COUNT; face += 1) {
        const faceViewId = createCubeCaptureFaceViewId(camera, face);
        const faceViewMatrix = cubeCaptureFaceViewMatrix(position, face);
        // 90-degree square faces; temporal jitter is deliberately not applied
        // (a jittered probe would smear the prefiltered environment).
        const faceProjection = makePerspective(Math.PI / 2, 1, near, far);
        const faceViewProjection = multiplyMat4(faceProjection, faceViewMatrix);
        const faceViewOffset = pushMatrix(viewMatrices, faceViewMatrix);
        const faceProjectionOffset = pushMatrix(viewMatrices, faceProjection);
        const faceViewProjectionOffset = pushMatrix(
          viewMatrices,
          faceViewProjection,
        );

        viewCullContexts.push({
          viewId: faceViewId,
          camera,
          priority,
          layerMask,
          viewMatrix: faceViewMatrix,
          frustumCulling,
          planes: createFrustumPlanes(faceViewProjection),
          stats: {
            viewId: faceViewId,
            camera,
            tested: 0,
            culled: 0,
            included: 0,
          },
        });

        views.push({
          viewId: faceViewId,
          camera,
          priority,
          layerMask,
          viewMatrixOffset: faceViewOffset,
          projectionMatrixOffset: faceProjectionOffset,
          viewProjectionMatrixOffset: faceViewProjectionOffset,
          // Faces always fill their cube layer; authored viewport/scissor
          // rects apply to screen cameras only.
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
          clearColor,
          clearDepth,
          clearStencil,
          renderTarget,
          renderTargetFace: face,
          ...(clipPlanes === undefined ? {} : { clipPlanes }),
        });
      }

      continue;
    }

    const viewMatrix = invertMat4(worldMatrix) ?? identityMat4();
    const projection = entity.getValue(Camera, "projection");
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
      ...(clipPlanes === undefined ? {} : { clipPlanes }),
    });
  }

  viewCullContexts.sort(
    (a, b) => a.priority - b.priority || a.viewId - b.viewId,
  );
  return views.sort((a, b) => a.priority - b.priority || a.viewId - b.viewId);
}

/**
 * D2: read a camera's authored clip planes (if any), resolve + cap them to
 * {@link MAX_CLIP_PLANES}, and emit `camera.clipPlanesExceedLimit` when the cap
 * drops planes. Returns `undefined` when the camera has no (finite) clip planes
 * so the view stays on the byte-identical no-clip path.
 */
function readCameraClipPlanes(
  entity: Entity,
  diagnostics: RenderDiagnostic[],
): readonly ClipPlane[] | undefined {
  if (!entity.hasComponent(CameraClipPlanes)) {
    return undefined;
  }

  const authored = entity.getValue(CameraClipPlanes, "planes") as
    | readonly (readonly [number, number, number, number])[]
    | null
    | undefined;
  const resolved = resolveClipPlanes({ cameraPlanes: authored ?? null });

  if (resolved.exceeded) {
    diagnostics.push({
      code: "camera.clipPlanesExceedLimit",
      severity: "warning",
      entity: entityRef(entity),
      message: `Camera requested ${resolved.requested} clip planes but the maximum is ${MAX_CLIP_PLANES}; ${resolved.dropped} were dropped.`,
    });
  }

  return resolved.planes.length === 0 ? undefined : resolved.planes;
}

/**
 * True when the handle resolves to a ready facade `RenderTargetAsset` with
 * `dimension: "cube"`. Missing/not-ready entries and the low-level
 * live-texture route stay on the single-view path (their diagnostics surface
 * at the frame boundary, exactly as before B2).
 */
function isCubeRenderTarget(
  assets: AssetRegistry,
  handle: NonNullable<ViewPacket["renderTarget"]>,
): boolean {
  const entry = assets.get<"render-target", unknown>(handle);

  return (
    entry !== undefined &&
    entry.status === "ready" &&
    isRenderTargetAsset(entry.asset) &&
    entry.asset.dimension === "cube"
  );
}
