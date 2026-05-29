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

  return createRenderShadowFrame({
    device: options.app.initialization.device as RenderShadowFrameDeviceLike,
    snapshot: options.snapshot,
    preparedMeshes: meshViews.preparedMeshes,
    executableMeshes: meshViews.executableMeshes,
    cache: options.cache.environmentResources,
    label: `${options.label ?? "aperture-webgpu-app"}:auto-shadow`,
  });
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
