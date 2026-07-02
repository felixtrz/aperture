import {
  createPreparedMaterialStore,
  createPreparedMeshStore,
  preparedMaterialStoreSummaryToJsonValue,
  preparedMeshStoreSummaryToJsonValue,
  RENDER_SNAPSHOT_CHANGE_SET_FAMILIES,
  type RenderEntityRef,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotFamilyChangeKeys,
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
  createPreparedBuiltInMaterialCacheEvictionReport,
  createPreparedMeshGpuResourceCacheEvictionReport,
} from "./prepared-resource-cache-eviction.js";
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
  localLightClusterDeferredSamplingDiagnostics,
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
  options: {
    readonly detail?: "full" | "status";
  } = {},
): WebGpuAppRenderReportJsonValue {
  const materialDependencyReadiness =
    collectWebGpuAppMaterialDependencyReadiness(report.diagnostics);
  const resourceReuse =
    options.detail === "status"
      ? compactWebGpuAppResourceReuseReport(report.resourceReuse)
      : { ...report.resourceReuse };
  const renderChangeSet =
    report.snapshotChangeSet === undefined
      ? undefined
      : options.detail === "status"
        ? compactRenderSnapshotChangeSet(report.snapshotChangeSet)
        : toWebGpuAppJsonValue(report.snapshotChangeSet);
  const diagnosticsSummary =
    report.diagnosticsSummary === undefined
      ? undefined
      : options.detail === "status"
        ? compactWebGpuAppDiagnosticsSummary(report.diagnosticsSummary)
        : toWebGpuAppJsonValue(report.diagnosticsSummary);
  const shadow =
    report.shadow === undefined
      ? undefined
      : options.detail === "status"
        ? compactRenderShadowFrameReport(report.shadow)
        : renderShadowFrameReportToJsonValue(report.shadow);

  return {
    ok: report.ok,
    frame: report.frame,
    ...(renderChangeSet === undefined ? {} : { renderChangeSet }),
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
    ...(diagnosticsSummary === undefined ? {} : { diagnosticsSummary }),
    resourceReuse,
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
    ...(shadow === undefined ? {} : { shadow }),
    ...(report.localLightClusters === undefined
      ? {}
      : { localLightClusters: report.localLightClusters }),
    ...(report.localLightCookies === undefined
      ? {}
      : { localLightCookies: report.localLightCookies }),
    ...(report.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: report.occlusionQueries }),
    ...(report.particles === undefined
      ? {}
      : { particles: toWebGpuAppJsonValue(report.particles) }),
    ...(report.features === undefined
      ? {}
      : { features: toWebGpuAppJsonValue(report.features) }),
    ...(materialDependencyReadiness.length === 0
      ? {}
      : { materialDependencyReadiness }),
  };
}

const STATUS_CHANGE_SET_KEY_SAMPLE_LIMIT = 8;

function compactRenderSnapshotChangeSet(
  changeSet: RenderSnapshotChangeSet,
): WebGpuAppJsonValue {
  return {
    previousFrame: changeSet.previousFrame,
    frame: changeSet.frame,
    views: { ...changeSet.views },
    meshDraws: { ...changeSet.meshDraws },
    shadowCasterDraws: { ...changeSet.shadowCasterDraws },
    lights: { ...changeSet.lights },
    environments: { ...changeSet.environments },
    proceduralSkies: { ...changeSet.proceduralSkies },
    runtimeUniforms: { ...changeSet.runtimeUniforms },
    shadowRequests: { ...changeSet.shadowRequests },
    bounds: { ...changeSet.bounds },
    total: { ...changeSet.total },
    ...(changeSet.keys === undefined
      ? {}
      : {
          keys: Object.fromEntries(
            RENDER_SNAPSHOT_CHANGE_SET_FAMILIES.map((family) => [
              family,
              compactRenderSnapshotFamilyChangeKeys(changeSet.keys?.[family]),
            ]),
          ),
        }),
  };
}

function compactRenderSnapshotFamilyChangeKeys(
  keys: RenderSnapshotFamilyChangeKeys | undefined,
): WebGpuAppJsonValue {
  if (keys === undefined) {
    return null;
  }

  return {
    changed: compactStringList(keys.changed),
    unchanged: compactStringList(keys.unchanged),
    removed: compactStringList(keys.removed),
  };
}

function compactStringList(values: readonly string[]): WebGpuAppJsonValue {
  return {
    count: values.length,
    sample: values.slice(0, STATUS_CHANGE_SET_KEY_SAMPLE_LIMIT),
    omitted: Math.max(0, values.length - STATUS_CHANGE_SET_KEY_SAMPLE_LIMIT),
  };
}

function compactWebGpuAppResourceReuseReport(
  report: WebGpuAppResourceReuseReport,
): WebGpuAppResourceReuseReport {
  return {
    ...report,
    preparedMeshCache: {
      totalEntries: report.preparedMeshCache.totalEntries,
      layouts: [],
    },
    preparedMeshFacade: {
      totalEntries: report.preparedMeshFacade.totalEntries,
      entries: [],
    },
    preparedMaterialFacade: {
      totalEntries: report.preparedMaterialFacade.totalEntries,
      families: report.preparedMaterialFacade.families,
      entries: [],
    },
  };
}

function compactWebGpuAppDiagnosticsSummary(
  summary: WebGpuAppDiagnosticsSummary,
): WebGpuAppJsonValue {
  return toWebGpuAppJsonValue({
    sectionCount: summary.sectionCount,
    ...(summary.materialQueue === undefined
      ? {}
      : { materialQueue: summary.materialQueue }),
    ...(summary.materialQueueRoute === undefined
      ? {}
      : { materialQueueRoute: summary.materialQueueRoute }),
    ...(summary.routedResourceSet === undefined
      ? {}
      : { routedResourceSet: summary.routedResourceSet }),
    ...(summary.builtInAppResourceAdapters === undefined
      ? {}
      : { builtInAppResourceAdapters: summary.builtInAppResourceAdapters }),
    ...(summary.renderFrameQueue === undefined
      ? {}
      : { renderFrameQueue: summary.renderFrameQueue }),
    ...(summary.renderQueueSortPhases === undefined
      ? {}
      : {
          renderQueueSortPhases: summary.renderQueueSortPhases.map((phase) => ({
            ...phase,
          })),
        }),
    ...(summary.gpuTimings === undefined
      ? {}
      : { gpuTimings: summary.gpuTimings }),
    ...(summary.directLighting === undefined
      ? {}
      : {
          directLighting: {
            ready: summary.directLighting.ready,
            lightCounts: { ...summary.directLighting.lightCounts },
            sections: { ...summary.directLighting.sections },
            resources: {
              lightGpuBuffer:
                summary.directLighting.resources.lightGpuBufferResourceKey !==
                null,
              lightBindGroupLayout:
                summary.directLighting.resources.lightBindGroupLayoutKey !==
                null,
              lightBindGroup:
                summary.directLighting.resources.lightBindGroupResourceKey !==
                null,
            },
            shaderMetadata: {
              valid: summary.directLighting.shaderMetadata.valid,
              diagnosticCount:
                summary.directLighting.shaderMetadata.diagnostics.length,
            },
            diagnosticCount: summary.directLighting.diagnostics.length,
          },
        }),
  });
}

function compactRenderShadowFrameReport(
  shadow: NonNullable<WebGpuAppRenderReport["shadow"]>,
): WebGpuAppJsonValue {
  return toWebGpuAppJsonValue({
    ready: shadow.ready,
    status: shadow.status,
    shadowKind: shadow.shadowKind,
    requestCount: shadow.requestCount,
    passCount: shadow.passCount,
    drawCalls: shadow.drawCalls,
    descriptor: {
      ready: shadow.descriptor.ready,
      requestCount: shadow.descriptor.requestCount,
      descriptorCount: shadow.descriptor.descriptorCount,
      sections: { ...shadow.descriptor.sections },
      diagnosticCount: shadow.descriptor.diagnostics.length,
    },
    viewProjection: {
      ready: shadow.viewProjection.ready,
      status: shadow.viewProjection.status,
      requestCount: shadow.viewProjection.requestCount,
      passCount: shadow.viewProjection.passCount,
      planCount: shadow.viewProjection.planCount,
      sections: { ...shadow.viewProjection.sections },
      diagnosticCount: shadow.viewProjection.diagnostics.length,
    },
    matrixComputation: {
      ready: shadow.matrixComputation.ready,
      status: shadow.matrixComputation.status,
      planCount: shadow.matrixComputation.planCount,
      matrixCount: shadow.matrixComputation.matrixCount,
      sections: { ...shadow.matrixComputation.sections },
      diagnosticCount: shadow.matrixComputation.diagnostics.length,
    },
    casterDrawList: {
      ready: shadow.casterDrawList.ready,
      status: shadow.casterDrawList.status,
      requestCount: shadow.casterDrawList.requestCount,
      meshDrawCount: shadow.casterDrawList.meshDrawCount,
      listCount: shadow.casterDrawList.listCount,
      includedDrawCount: shadow.casterDrawList.includedDrawCount,
      skippedDrawCount: shadow.casterDrawList.skippedDrawCount,
      sections: { ...shadow.casterDrawList.sections },
      diagnosticCount: shadow.casterDrawList.diagnostics.length,
    },
    depthTextureKeyCount: shadow.depthTextureKeys.length,
    matrixBufferResourceKey: shadow.matrixBufferResourceKey,
    sections: { ...shadow.sections },
    resourceReuse: { ...shadow.resourceReuse },
    commandBufferSubmission: {
      status: shadow.commandBufferSubmission.status,
      assembledPasses: shadow.commandBufferSubmission.assembledPasses,
      commandBuffers: shadow.commandBufferSubmission.commandBuffers,
      submittedCommandBuffers:
        shadow.commandBufferSubmission.submittedCommandBuffers,
      commandBufferKeyCount:
        shadow.commandBufferSubmission.commandBufferKeys.length,
      sections: { ...shadow.commandBufferSubmission.sections },
    },
    diagnosticCount: shadow.diagnostics.length,
  });
}

function renderShadowFrameReportToJsonValue(
  shadow: NonNullable<WebGpuAppRenderReport["shadow"]>,
): WebGpuAppJsonValue {
  return {
    ready: shadow.ready,
    status: shadow.status,
    shadowKind: shadow.shadowKind,
    requestCount: shadow.requestCount,
    passCount: shadow.passCount,
    drawCalls: shadow.drawCalls,
    descriptor: toWebGpuAppJsonValue(shadow.descriptor),
    viewProjection: toWebGpuAppJsonValue(shadow.viewProjection),
    matrixComputation: toWebGpuAppJsonValue(shadow.matrixComputation),
    casterDrawList: shadowCasterDrawListReportToJsonValue(
      shadow.casterDrawList,
    ),
    depthTextureKeys: [...shadow.depthTextureKeys],
    matrixBufferResourceKey: shadow.matrixBufferResourceKey,
    sections: { ...shadow.sections },
    resourceReuse: { ...shadow.resourceReuse },
    commandBufferSubmission: {
      status: shadow.commandBufferSubmission.status,
      assembledPasses: shadow.commandBufferSubmission.assembledPasses,
      commandBuffers: shadow.commandBufferSubmission.commandBuffers,
      submittedCommandBuffers:
        shadow.commandBufferSubmission.submittedCommandBuffers,
      commandBufferKeys: [...shadow.commandBufferSubmission.commandBufferKeys],
      sections: { ...shadow.commandBufferSubmission.sections },
    },
    diagnostics: shadow.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
  };
}

function shadowCasterDrawListReportToJsonValue(
  report: NonNullable<WebGpuAppRenderReport["shadow"]>["casterDrawList"],
): WebGpuAppJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    requestCount: report.requestCount,
    meshDrawCount: report.meshDrawCount,
    listCount: report.listCount,
    includedDrawCount: report.includedDrawCount,
    skippedDrawCount: report.skippedDrawCount,
    sections: { ...report.sections },
    lists: report.lists.map((list) => {
      const drawSample = list.draws.slice(0, 8);

      return {
        shadowId: list.shadowId,
        lightId: list.lightId,
        passKey: list.passKey,
        casterLayerMask: list.casterLayerMask,
        receiverLayerMask: list.receiverLayerMask,
        includedDrawCount: list.includedDrawCount,
        skippedDrawCount: list.skippedDrawCount,
        commandEncoding: list.commandEncoding,
        omittedDrawCount: Math.max(0, list.draws.length - drawSample.length),
        drawSample: drawSample.map((draw) => ({
          renderId: draw.renderId,
          meshKey: draw.meshKey,
          materialKey: draw.materialKey,
          meshLayoutKey: draw.meshLayoutKey,
          casterCullMode: draw.casterCullMode,
          submesh: draw.submesh,
          ...(draw.vertexStart === undefined
            ? {}
            : { vertexStart: draw.vertexStart }),
          ...(draw.vertexCount === undefined
            ? {}
            : { vertexCount: draw.vertexCount }),
          ...(draw.indexStart === undefined
            ? {}
            : { indexStart: draw.indexStart }),
          ...(draw.indexCount === undefined
            ? {}
            : { indexCount: draw.indexCount }),
        })),
      };
    }),
    diagnostics: report.diagnostics.map((diagnostic) =>
      toWebGpuAppJsonValue(diagnostic),
    ),
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
  readonly particles?: WebGpuAppRenderReport["particles"];
  readonly features?: WebGpuAppRenderReport["features"];
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
  const diagnostics = [
    ...input.diagnostics,
    ...localLightClusterDeferredSamplingDiagnostics(localLightClusters),
  ];

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
      ...(input.snapshot.shadowCasterDraws === undefined
        ? {}
        : { shadowCasterDraws: input.snapshot.shadowCasterDraws.length }),
      spriteDraws: input.snapshot.spriteDraws?.length ?? 0,
      particleEmitters: input.snapshot.particleEmitters?.length ?? 0,
      quadInstances:
        input.snapshot.quads === undefined
          ? 0
          : input.snapshot.quads.instanceFloats.length /
            input.snapshot.quads.instanceFloatStride,
      quadBatches: input.snapshot.quadBatches?.length ?? 0,
      uiNodes: input.snapshot.uiNodes?.length ?? 0,
      uiHitRegions: input.snapshot.uiHitRegions?.length ?? 0,
      skyboxes: input.snapshot.skyboxes?.length ?? 0,
      proceduralSkies: input.snapshot.proceduralSkies?.length ?? 0,
      runtimeUniforms: input.snapshot.runtimeUniforms?.length ?? 0,
      fogs: input.snapshot.fogs?.length ?? 0,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: diagnostics.length,
    },
    diagnostics,
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
    ...(input.particles === undefined ? {} : { particles: input.particles }),
    ...(input.features === undefined ? {} : { features: input.features }),
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
    preparedMeshCacheEviction:
      createPreparedMeshGpuResourceCacheEvictionReport(),
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
    preparedMaterialCacheEviction:
      createPreparedBuiltInMaterialCacheEvictionReport(),
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
    standardFrameResourceCacheHits: 0,
    standardFrameResourceCacheMisses: 0,
    standardFrameResourceCacheMissReasons: {},
    localLightClusterBuffersCreated: 0,
    localLightClusterBuffersReused: 0,
    localLightClusterBufferWrites: 0,
    localLightClusterBufferWritesSkipped: 0,
    autoShadowFramesCreated: 0,
    autoShadowFramesReused: 0,
    autoShadowFrameCache: {
      status: "not-evaluated",
    },
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

/**
 * Whether the assembled frame produced GPU→CPU readbacks that require a full
 * queue drain before they can be consumed this frame. Frames without pending
 * readbacks must skip `waitForSubmittedWork` — draining unconditionally
 * serializes the CPU against the GPU and defeats frame pipelining (AI-11).
 */
export function frameBoundariesNeedGpuDrain(boundaries: {
  readonly readbackBoundary: object | null;
  readonly gpuTimingReadbacks?: readonly unknown[];
  readonly occlusionQueryReadbacks?: readonly unknown[];
  readonly occlusionQueryCount?: number;
}): boolean {
  return (
    boundaries.readbackBoundary !== null ||
    (boundaries.gpuTimingReadbacks?.length ?? 0) > 0 ||
    (boundaries.occlusionQueryReadbacks?.length ?? 0) > 0 ||
    (boundaries.occlusionQueryCount ?? 0) > 0
  );
}
