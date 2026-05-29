import {
  createPreparedMaterialStore,
  createPreparedMeshStore,
  preparedMaterialStoreSummaryToJsonValue,
  preparedMeshStoreSummaryToJsonValue,
  type RenderEntityRef,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotUpdateSchedule,
} from "@aperture-engine/render";
import {
  collectWebGpuAppMaterialDependencyReadiness,
  type WebGpuAppDiagnosticsSummary,
} from "./app-diagnostics-summary.js";
import {
  createAppTextureSamplerResourceCacheSummary,
  writeAppTextureSamplerResourceCacheSummary,
  type AppTextureSamplerResourceCache,
  type AppTextureSamplerResourceCacheSummary,
} from "./app-texture-sampler-resources.js";
import {
  createPreparedAppMaterialCacheSummary,
  type PreparedAppMaterialCacheSummary,
} from "../materials/core/prepared-app-material-resource.js";
import {
  writePreparedBuiltInMaterialStoreSummary,
  type PreparedBuiltInMaterialStore,
} from "../materials/core/prepared-built-in-material-store.js";
import {
  createPreparedMeshGpuResourceCacheSummary,
  writePreparedMeshGpuResourceCacheSummary,
  type PreparedMeshGpuResourceCache,
  type PreparedMeshGpuResourceCacheSummary,
} from "../resources/meshes/prepared-mesh-cache.js";
import {
  createLocalLightClusterDescriptor,
  localLightClusterReportFromDescriptor,
  snapshotShouldUseClusteredLocalLights,
  type LocalLightClusterGpuResource,
  type LocalLightClusterReport,
} from "../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import type {
  FrameBoundaryAssemblyReport,
  FrameBoundaryReadbackResult,
} from "../render/frame/frame-boundary.js";
import type { IndirectDrawCommandReport } from "../render/draw/indirect-draw-commands.js";
import type { GpuPassTimingReport } from "../gpu/gpu-timing.js";
import type { WebGpuAppRenderPhaseTimingReport } from "./app-phase-timing.js";
import { parseMaterialPipelineRenderStateTokens } from "../materials/core/material-render-state.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import type { RenderPassCommandPressureReport } from "../render/passes/render-pass-commands.js";
import type { WebGpuIdBufferPickReadbackResult } from "../picking/id-buffer-pick.js";
import type {
  WebGpuAppDepthAttachmentReport,
  WebGpuAppFrameResourcesResult,
  WebGpuAppJsonValue,
  WebGpuAppLocalLightCookieReport,
  WebGpuAppMotionVectorReport,
  WebGpuAppMsaaReport,
  WebGpuAppOcclusionQueryReport,
  WebGpuAppPickReport,
  WebGpuAppPickReportJsonValue,
  WebGpuAppPipelineResourceResult,
  WebGpuAppPostEffectSubmissionReport,
  WebGpuAppRenderBundleReport,
  WebGpuAppRenderReport,
  WebGpuAppRenderReportJsonValue,
  WebGpuAppRenderTargetSubmissionReport,
  WebGpuAppResourceReuseReport,
  WebGpuAppTransmissionGrabPassReport,
} from "./app.js";

interface WebGpuAppResourceSummaryCache extends AppTextureSamplerResourceCache {
  readonly preparedMaterials: PreparedBuiltInMaterialStore;
  readonly preparedMeshes: PreparedMeshGpuResourceCache;
}

export function createWebGpuAppPickReport(input: {
  readonly x: number;
  readonly y: number;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly id: number | null;
  readonly entity: RenderEntityRef | null;
  readonly diagnostics: readonly unknown[];
  readonly readback?: WebGpuIdBufferPickReadbackResult;
}): WebGpuAppPickReport {
  return {
    ok: input.entity !== null && input.diagnostics.length === 0,
    x: input.x,
    y: input.y,
    width: input.dimensions.width,
    height: input.dimensions.height,
    id: input.id,
    entity: input.entity,
    diagnostics: input.diagnostics,
    ...(input.readback === undefined ? {} : { readback: input.readback }),
  };
}

export function webGpuAppRenderReportToJsonValue(
  report: WebGpuAppRenderReport,
): WebGpuAppRenderReportJsonValue {
  const materialDependencyReadiness =
    collectWebGpuAppMaterialDependencyReadiness(report.diagnostics);

  return {
    ok: report.ok,
    frame: report.frame,
    ...(report.snapshotChangeSet === undefined
      ? {}
      : { renderChangeSet: toWebGpuAppJsonValue(report.snapshotChangeSet) }),
    ...(report.snapshotUpdateSchedule === undefined
      ? {}
      : {
          renderUpdateSchedule: toWebGpuAppJsonValue(
            report.snapshotUpdateSchedule,
          ),
        }),
    counts: { ...report.counts },
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    ...(report.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: report.diagnosticsSummary }),
    resourceReuse: { ...report.resourceReuse },
    ...(report.depthAttachment === undefined
      ? {}
      : { depthAttachment: report.depthAttachment }),
    ...(report.renderTargets === undefined
      ? {}
      : { renderTargets: report.renderTargets }),
    ...(report.postEffects === undefined
      ? {}
      : { postEffects: report.postEffects }),
    ...(report.transmissionGrabPass === undefined
      ? {}
      : { transmissionGrabPass: report.transmissionGrabPass }),
    ...(report.msaa === undefined ? {} : { msaa: report.msaa }),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
    ...(report.gpuTimings === undefined
      ? {}
      : { gpuTimings: report.gpuTimings }),
    ...(report.phaseTimings === undefined
      ? {}
      : { phaseTimings: report.phaseTimings }),
    ...(report.commandPressure === undefined
      ? {}
      : { commandPressure: toWebGpuAppJsonValue(report.commandPressure) }),
    ...(report.renderBundles === undefined
      ? {}
      : { renderBundles: report.renderBundles }),
    ...(report.indirectDraws === undefined
      ? {}
      : { indirectDraws: report.indirectDraws }),
    ...(report.motionVectors === undefined
      ? {}
      : { motionVectors: report.motionVectors }),
    ...(report.shadow === undefined
      ? {}
      : { shadow: toWebGpuAppJsonValue(report.shadow) }),
    ...(report.localLightClusters === undefined
      ? {}
      : { localLightClusters: report.localLightClusters }),
    ...(report.localLightCookies === undefined
      ? {}
      : { localLightCookies: report.localLightCookies }),
    ...(report.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: report.occlusionQueries }),
    ...(materialDependencyReadiness.length === 0
      ? {}
      : { materialDependencyReadiness }),
  };
}

export function webGpuAppPickReportToJsonValue(
  report: WebGpuAppPickReport,
): WebGpuAppPickReportJsonValue {
  return {
    ok: report.ok,
    x: report.x,
    y: report.y,
    width: report.width,
    height: report.height,
    id: report.id,
    entity: report.entity,
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
    ...(report.readback === undefined
      ? {}
      : { readback: toWebGpuAppJsonValue(report.readback) }),
  };
}

export function webGpuAppRenderReportToJson(
  report: WebGpuAppRenderReport,
): string {
  return JSON.stringify(webGpuAppRenderReportToJsonValue(report));
}

export function toWebGpuAppJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): WebGpuAppJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toWebGpuAppJsonValue(entry, seen));
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const result: Record<string, WebGpuAppJsonValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === undefined ||
      typeof entry === "function" ||
      typeof entry === "symbol" ||
      typeof entry === "bigint"
    ) {
      continue;
    }

    result[key] = toWebGpuAppJsonValue(entry, seen);
  }

  return result;
}

export function renderReport(input: {
  readonly ok: boolean;
  readonly snapshot: RenderSnapshot;
  readonly snapshotChangeSet?: RenderSnapshotChangeSet;
  readonly snapshotUpdateSchedule?: RenderSnapshotUpdateSchedule;
  readonly diagnostics: readonly unknown[];
  readonly diagnosticsSummary?: WebGpuAppDiagnosticsSummary;
  readonly resourceReuse?: WebGpuAppResourceReuseReport;
  readonly pipeline?: WebGpuAppPipelineResourceResult | null;
  readonly resources?: WebGpuAppFrameResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
  readonly boundaries?: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets?: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects?: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly readback?: FrameBoundaryReadbackResult;
  readonly gpuTimings?: GpuPassTimingReport;
  readonly phaseTimings?: WebGpuAppRenderPhaseTimingReport;
  readonly commandPressure?: RenderPassCommandPressureReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly indirectDraws?: IndirectDrawCommandReport;
  readonly motionVectors?: WebGpuAppMotionVectorReport;
  readonly shadow?: WebGpuAppRenderReport["shadow"];
  readonly localLightCookieResources?:
    | LocalLightClusterCookieResources
    | null
    | undefined;
  readonly occlusionQueries?: WebGpuAppOcclusionQueryReport;
  readonly drawPackages?: number;
  readonly drawCommands?: number;
  readonly drawCalls?: number;
}): WebGpuAppRenderReport {
  const resourceReuse =
    input.resourceReuse ?? createWebGpuAppResourceReuseReport();
  const localLightClusters = createWebGpuAppLocalLightClusterReport(
    input.snapshot,
    input.resources ?? null,
    resourceReuse,
  );
  const localLightCookies = createWebGpuAppLocalLightCookieReport(
    input.localLightCookieResources ?? null,
  );

  return {
    ok: input.ok,
    frame: input.snapshot.frame,
    snapshot: input.snapshot,
    ...(input.snapshotChangeSet === undefined
      ? {}
      : { snapshotChangeSet: input.snapshotChangeSet }),
    ...(input.snapshotUpdateSchedule === undefined
      ? {}
      : { snapshotUpdateSchedule: input.snapshotUpdateSchedule }),
    counts: {
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      spriteDraws: input.snapshot.spriteDraws?.length ?? 0,
      skyboxes: input.snapshot.skyboxes?.length ?? 0,
      fogs: input.snapshot.fogs?.length ?? 0,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: input.diagnostics.length,
    },
    diagnostics: input.diagnostics,
    ...(input.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: input.diagnosticsSummary }),
    resourceReuse,
    pipeline: input.pipeline ?? null,
    resources: input.resources ?? null,
    boundary: input.boundary ?? null,
    ...(input.boundaries === undefined ? {} : { boundaries: input.boundaries }),
    ...(input.renderTargets === undefined
      ? {}
      : { renderTargets: input.renderTargets }),
    ...(input.postEffects === undefined
      ? {}
      : { postEffects: input.postEffects }),
    ...(input.transmissionGrabPass === undefined
      ? {}
      : { transmissionGrabPass: input.transmissionGrabPass }),
    ...(input.msaa === undefined ? {} : { msaa: input.msaa }),
    ...(input.depthAttachment === undefined
      ? {}
      : { depthAttachment: input.depthAttachment }),
    ...(input.readback === undefined ? {} : { readback: input.readback }),
    ...(input.gpuTimings === undefined ? {} : { gpuTimings: input.gpuTimings }),
    ...(input.phaseTimings === undefined
      ? {}
      : { phaseTimings: input.phaseTimings }),
    ...(input.commandPressure === undefined
      ? {}
      : { commandPressure: input.commandPressure }),
    ...(input.renderBundles === undefined
      ? {}
      : { renderBundles: input.renderBundles }),
    ...(input.indirectDraws === undefined
      ? {}
      : { indirectDraws: input.indirectDraws }),
    ...(input.motionVectors === undefined
      ? {}
      : { motionVectors: input.motionVectors }),
    ...(input.shadow === undefined ? {} : { shadow: input.shadow }),
    ...(localLightClusters === undefined ? {} : { localLightClusters }),
    ...(localLightCookies === undefined ? {} : { localLightCookies }),
    ...(input.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: input.occlusionQueries }),
  };
}

function createWebGpuAppLocalLightCookieReport(
  resources: LocalLightClusterCookieResources | null,
): WebGpuAppLocalLightCookieReport | undefined {
  if (resources === null) {
    return undefined;
  }

  return {
    ...(resources.textureLayout === undefined
      ? {}
      : { textureLayout: resources.textureLayout }),
    textureViewDimension: resources.textureViewDimension,
    ...(resources.shadowMatrixCompatible === undefined
      ? {}
      : { shadowMatrixCompatible: resources.shadowMatrixCompatible }),
    textureKey: resources.textureKey,
    samplerKey: resources.samplerKey,
    supportedLightCount: resources.supportedResources.length,
    ...(resources.atlasUpdate === undefined
      ? {}
      : { atlasUpdate: resources.atlasUpdate }),
  };
}

function createWebGpuAppLocalLightClusterReport(
  snapshot: RenderSnapshot,
  resources: WebGpuAppFrameResourcesResult | null,
  reuse: WebGpuAppResourceReuseReport,
): LocalLightClusterReport | undefined {
  const clusterResources =
    collectWebGpuAppLocalLightClusterResources(resources);
  const resource = clusterResources[0] ?? null;

  if (resource !== null) {
    const report = localLightClusterReportFromDescriptor(resource.descriptor, {
      resource,
      buffersCreated: reuse.localLightClusterBuffersCreated,
      buffersReused: reuse.localLightClusterBuffersReused,
      bufferWrites: reuse.localLightClusterBufferWrites,
      bufferWritesSkipped: reuse.localLightClusterBufferWritesSkipped,
    });

    if (clusterResources.length <= 1) {
      return report;
    }

    return {
      ...report,
      routes: clusterResources.map((routeResource) =>
        localLightClusterReportFromDescriptor(routeResource.descriptor, {
          resource: routeResource,
        }),
      ),
    };
  }

  if (!snapshotShouldUseClusteredLocalLights(snapshot)) {
    return undefined;
  }

  return localLightClusterReportFromDescriptor(
    createLocalLightClusterDescriptor(snapshot),
    {
      buffersCreated: reuse.localLightClusterBuffersCreated,
      buffersReused: reuse.localLightClusterBuffersReused,
      bufferWrites: reuse.localLightClusterBufferWrites,
      bufferWritesSkipped: reuse.localLightClusterBufferWritesSkipped,
    },
  );
}

function collectWebGpuAppLocalLightClusterResources(
  result: WebGpuAppFrameResourcesResult | null,
): readonly LocalLightClusterGpuResource[] {
  const resources = result?.resources;

  if (resources === null || resources === undefined) {
    return [];
  }

  if ("localLightClusters" in resources) {
    return resources.localLightClusters === undefined
      ? []
      : [resources.localLightClusters];
  }

  if ("standard" in resources) {
    const clusterResources: LocalLightClusterGpuResource[] = [];
    const seenResourceKeys = new Set<string>();

    for (const standardResources of resources.standard) {
      const localLightClusters = standardResources.localLightClusters;

      if (
        localLightClusters !== undefined &&
        !seenResourceKeys.has(localLightClusters.resourceKey)
      ) {
        seenResourceKeys.add(localLightClusters.resourceKey);
        clusterResources.push(localLightClusters);
      }
    }

    return clusterResources;
  }

  return [];
}

export function createWebGpuAppDepthAttachmentReport(
  snapshot: RenderSnapshot,
  resource: CachedWebGpuDepthTextureResource,
): WebGpuAppDepthAttachmentReport {
  return {
    format: resource.format,
    attached: true,
    width: resource.width,
    height: resource.height,
    opaquePipelineDepthWriteCount: countOpaqueDepthWritePipelineKeys(snapshot),
  };
}

function countOpaqueDepthWritePipelineKeys(snapshot: RenderSnapshot): number {
  const pipelineKeys = new Set<string>();

  for (const draw of snapshot.meshDraws) {
    const tokens = parseMaterialPipelineRenderStateTokens(
      draw.batchKey.pipelineKey,
    );

    if ((tokens.alphaMode ?? "opaque") !== "blend") {
      pipelineKeys.add(draw.batchKey.pipelineKey);
    }
  }

  return pipelineKeys.size;
}

export function createWebGpuAppResourceReuseReport(): WebGpuAppResourceReuseReport {
  return {
    pipelineHits: 0,
    pipelineMisses: 0,
    meshBuffersCreated: 0,
    meshBuffersReused: 0,
    preparedMeshBuffersCreated: 0,
    preparedMeshBuffersReused: 0,
    preparedMeshCache: createPreparedMeshGpuResourceCacheSummary(),
    preparedMeshFacade: preparedMeshStoreSummaryToJsonValue(
      createPreparedMeshStore(),
    ),
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    preparedMaterialCache: createPreparedAppMaterialCacheSummary(),
    preparedMaterialFacade: preparedMaterialStoreSummaryToJsonValue(
      createPreparedMaterialStore(),
    ),
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    textureSamplerCache: createAppTextureSamplerResourceCacheSummary(),
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
    queuedBindGroupsCreated: 0,
    queuedBindGroupsReused: 0,
    queuedBindGroupCacheSize: 0,
    lightBuffersCreated: 0,
    lightBuffersReused: 0,
    localLightClusterBuffersCreated: 0,
    localLightClusterBuffersReused: 0,
    localLightClusterBufferWrites: 0,
    localLightClusterBufferWritesSkipped: 0,
    dynamicBufferWrites: 0,
  };
}

export function writeWebGpuAppPreparedMaterialCacheSummary(
  summary: PreparedAppMaterialCacheSummary,
  cache: WebGpuAppResourceSummaryCache,
): PreparedAppMaterialCacheSummary {
  return writePreparedBuiltInMaterialStoreSummary(
    summary,
    cache.preparedMaterials,
  );
}

export function writeWebGpuAppPreparedMeshCacheSummary(
  summary: PreparedMeshGpuResourceCacheSummary,
  cache: WebGpuAppResourceSummaryCache,
): PreparedMeshGpuResourceCacheSummary {
  return writePreparedMeshGpuResourceCacheSummary(
    summary,
    cache.preparedMeshes,
  );
}

export function writeWebGpuAppTextureSamplerCacheSummary(
  summary: AppTextureSamplerResourceCacheSummary,
  cache: WebGpuAppResourceSummaryCache,
): AppTextureSamplerResourceCacheSummary {
  return writeAppTextureSamplerResourceCacheSummary(summary, cache);
}

export async function waitForSubmittedWork(device: unknown): Promise<void> {
  const queue = (
    device as { readonly queue?: { onSubmittedWorkDone?: () => Promise<void> } }
  ).queue;

  if (typeof queue?.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }
}
