import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshDrawPacket,
  RenderSnapshot,
  ShadowRequestPacket,
} from "@aperture-engine/render";
import { prepareAppMeshResource } from "../resources/meshes/prepared-app-mesh-resource.js";
import {
  createRenderShadowFrame,
  type RenderShadowFrameDeviceLike,
  type RenderShadowFrameResult,
} from "../shadows/render-shadow-frame.js";
import type { ShadowCasterExecutableMeshResourceView } from "../shadows/shadow-caster-command-record-plan.js";
import type { ShadowCasterPreparedMeshResourceView } from "../shadows/shadow-caster-frame-resource-readiness.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

export type WebGpuAppAutoShadowPipelineKind =
  | "directional"
  | "directional-cascaded";

export function standardAutoShadowPipelineKindFromSnapshot(
  snapshot: RenderSnapshot,
): WebGpuAppAutoShadowPipelineKind | null {
  if (!snapshotHasStandardShadowReceiver(snapshot)) {
    return null;
  }

  const directionalRequests = snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );

  if (directionalRequests.length === 0) {
    return null;
  }

  return directionalRequests.some((request) => (request.cascadeCount ?? 1) > 1)
    ? "directional-cascaded"
    : "directional";
}

export function createWebGpuAppAutoShadowFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
  readonly label?: string;
}): RenderShadowFrameResult | null {
  if (standardAutoShadowPipelineKindFromSnapshot(options.snapshot) === null) {
    return null;
  }

  const meshViews = createAutoShadowCasterMeshViews(options);

  // Center the shadow ortho on the primary camera's ground look-target (≈ the
  // followed subject) and size it to the visible play area, mirroring the
  // reference's car-targeted DirectionalLight shadow camera. Without this the
  // matrix computation defaults to a tiny origin-centered ortho that misses an
  // off-origin / moving scene, so shadows only appear near the world origin.
  const sceneMatrix = computeShadowSceneMatrix(options.snapshot);

  return createRenderShadowFrame({
    device: options.app.initialization.device as RenderShadowFrameDeviceLike,
    snapshot: options.snapshot,
    preparedMeshes: meshViews.preparedMeshes,
    executableMeshes: meshViews.executableMeshes,
    cache: options.cache.environmentResources,
    ...(sceneMatrix === null ? {} : { matrix: sceneMatrix }),
    label: `${options.label ?? "aperture-webgpu-app"}:auto-shadow`,
  });
}

/**
 * Derive a light-space ortho centered on the primary camera's ground look-target,
 * sized to the visible play area. Recovers the camera world position + forward
 * from the column-major view matrix without a full inverse (camPos = -Rᵀ·t,
 * forward = -(c0.z,c1.z,c2.z)). Null when there is no view.
 */
function computeShadowSceneMatrix(snapshot: RenderSnapshot): {
  readonly center: readonly [number, number, number];
  readonly orthographicSize: number;
  readonly near: number;
  readonly far: number;
  readonly lightDistance: number;
} | null {
  const views = snapshot.views;
  if (views.length === 0) {
    return null;
  }
  let primary = views[0];
  for (const view of views) {
    if (primary === undefined || view.priority > primary.priority) {
      primary = view;
    }
  }
  if (primary === undefined) {
    return null;
  }
  const m = snapshot.viewMatrices;
  const o = primary.viewMatrixOffset;
  if (m.length < o + 16) {
    return null;
  }
  const c0x = m[o] as number;
  const c0z = m[o + 2] as number;
  const c1z = m[o + 6] as number;
  const c2x = m[o + 8] as number;
  const c2z = m[o + 10] as number;
  const c0y = m[o + 1] as number;
  const c2y = m[o + 9] as number;
  const tx = m[o + 12] as number;
  const ty = m[o + 13] as number;
  const tz = m[o + 14] as number;
  const camX = -(c0x * tx + c0y * ty + c0z * tz);
  const camZ = -(c2x * tx + c2y * ty + c2z * tz);
  let fx = -c0z;
  let fz = -c2z;
  const flen = Math.sqrt(fx * fx + c1z * c1z + fz * fz) || 1;
  fx /= flen;
  fz /= flen;
  if (!Number.isFinite(camX) || !Number.isFinite(fx)) {
    return null;
  }

  // Ground look-target ahead of the camera (≈ the followed subject), and a
  // radius covering the visible play area at workable shadow-map precision.
  const LOOK_DISTANCE = 16;
  const radius = 30;
  return {
    center: [camX + fx * LOOK_DISTANCE, 0, camZ + fz * LOOK_DISTANCE],
    orthographicSize: radius * 2,
    lightDistance: radius * 1.6,
    near: radius * 0.3,
    far: radius * 3,
  };
}

function createAutoShadowCasterMeshViews(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
}): {
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
} {
  const preparedMeshes: ShadowCasterPreparedMeshResourceView[] = [];
  const executableMeshes: ShadowCasterExecutableMeshResourceView[] = [];
  const preparedByMeshKey = new Set<string>();

  for (const draw of options.snapshot.meshDraws) {
    if (!isShadowCasterDraw(draw, options.snapshot.shadowRequests)) {
      continue;
    }

    const meshKey = assetHandleKey(draw.mesh);

    if (preparedByMeshKey.has(meshKey)) {
      continue;
    }

    preparedByMeshKey.add(meshKey);

    const meshEntry = options.assets.get<"mesh", MeshAsset>(draw.mesh);
    const mesh = meshEntry?.asset ?? null;
    const prepared = prepareAppMeshResource({
      device: options.app.initialization.device,
      mesh,
      meshHandle: draw.mesh,
      meshKey: sourceAssetCacheKey(draw.mesh, meshEntry?.version ?? -1),
      frame: options.snapshot.frame,
      preparedMeshes: options.cache.preparedMeshes,
    });

    if (prepared === null) {
      continue;
    }

    if (prepared.status === "reused") {
      options.reuse.meshBuffersReused += 1;
      options.reuse.preparedMeshBuffersReused += 1;
    } else {
      options.reuse.meshBuffersCreated += 1;
      options.reuse.preparedMeshBuffersCreated += 1;
    }

    const resource = prepared.resource.mesh;
    const preparedView: ShadowCasterPreparedMeshResourceView = {
      meshKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    };
    const executableView: ShadowCasterExecutableMeshResourceView = {
      meshKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined || resource.indexBuffer === null
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    };

    preparedMeshes.push(preparedView);
    executableMeshes.push(executableView);
  }

  return { preparedMeshes, executableMeshes };
}

function snapshotHasStandardShadowReceiver(snapshot: RenderSnapshot): boolean {
  return snapshot.meshDraws.some(
    (draw) =>
      draw.receivesShadow !== false &&
      draw.batchKey.pipelineKey.startsWith("standard|"),
  );
}

function isShadowCasterDraw(
  draw: MeshDrawPacket,
  shadowRequests: readonly ShadowRequestPacket[],
): boolean {
  return (
    draw.castsShadow !== false &&
    shadowRequests.some(
      (request) =>
        isDirectionalShadowRequest(request) &&
        (draw.layerMask & request.casterLayerMask) !== 0,
    )
  );
}

function isDirectionalShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === undefined || request.lightKind === "directional";
}
