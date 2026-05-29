import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  createMaterialDependencyReadinessReport,
  isCustomWgslMaterialAsset,
  writePackedSnapshotInstanceTintsForVertexBuffer,
  writePackedSnapshotTransforms,
  writePackedSnapshotViewUniforms,
  type MeshAsset,
  type MeshDrawPacket,
  type RenderSnapshot,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import { createWebGpuAppDrawResourceSetPlan } from "./draw-resource-set.js";
import {
  emptyPreparedAppTextureSamplerResources,
  sourceAssetCacheKey,
} from "./app-texture-sampler-resources.js";
import { createPreparedMaterialTextureSamplerDependencies } from "../materials/core/prepared-material-texture-sampler-dependencies.js";
import { mapFrameBoundaryReadbackSamples } from "../render/frame/frame-boundary.js";
import { createWebGpuAppRenderPhaseTimer } from "./app-phase-timing.js";
import { isBuiltInMaterialQueueFamily } from "../materials/core/built-in-material-queue-family.js";
import {
  collectQueuedBuiltInAppResourceSet,
  createSingleQueuedBuiltInAppResourceItem,
} from "../render/queues/queued-built-in-app-resource-set.js";
import { prepareLocalLightClusterCookieResources } from "../lighting/local-light-cookie-resources.js";
import {
  canReuseClusteredLocalLightShadowMatricesForCookies,
  hasReadyStandardDiffuseIblResources,
  hasReadyStandardSpecularIblProofResources,
  standardShadowPipelineKind,
  withStandardClusteredLocalLightPipelineKeys,
  withStandardIblPipelineKeys,
  withStandardShadowPipelineKeys,
} from "../materials/standard/standard-app-pipeline-keys.js";
import { writeRenderFramePlanFromSnapshot } from "../render/frame/render-frame-plan.js";
import {
  createWebGpuAppResourceReuseReport,
  renderReport,
  waitForSubmittedWork,
} from "./report.js";
import { prepareWebGpuAppSourceAssetFacades } from "./source-assets.js";
import {
  createWebGpuAppMaterialDependencyDiagnostic,
  diagnoseSnapshotMaterialDependencies,
} from "./material-dependencies.js";
import { getWebGpuAppPipelineLayouts } from "./pipeline-layouts.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import { getOrCreateWebGpuAppPipeline } from "./pipeline-resources.js";
import {
  createEmptyRenderSnapshot,
  createWebGpuAppSnapshotUpdateMetadata,
} from "./snapshot.js";
import {
  newOcclusionQueryDiagnostics,
  readWebGpuAppOcclusionQueries,
} from "./gpu-readback.js";
import {
  prepareWebGpuAppIndirectDrawCommands,
  shouldUseRenderBundlesForSnapshotSchedule,
} from "./frame-boundary-support.js";
import {
  createQueuedBuiltInRouteFailureDiagnosticsSummary,
  resolveStandardAreaLightLtcResources,
} from "./queued-built-in-support.js";
import { prepareSpriteFrameResourcesForSnapshot } from "./sprites.js";
import {
  collectMultiUnlitAppResourceSet,
  createMultiUnlitAppFrameResources,
} from "./multi-unlit.js";
import {
  QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
  QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
} from "./queued-built-in-adapters.js";
import { assembleWebGpuAppFrameBoundaries } from "./frame-boundaries.js";
import { renderSpriteOnlyWebGpuAppFrame } from "./sprite-frame.js";
import { renderQueuedBuiltInWebGpuAppFrame } from "./queued-built-in-frame.js";
import { renderCustomWgslWebGpuAppFrame } from "./custom-wgsl-frame.js";
import { renderMixedCustomWgslWebGpuAppFrame } from "./mixed-custom-wgsl-frame.js";
import { standardAutoShadowPipelineKindFromSnapshot } from "./auto-shadow-frame.js";
import type {
  WebGpuApp,
  WebGpuAppFrameResourcesResult,
  WebGpuAppRenderOptions,
  WebGpuAppRenderReport,
} from "./app.js";

interface WebGpuAppFrameRenderOptions extends WebGpuAppRenderOptions {
  readonly previousSnapshotForUpdate?: RenderSnapshot | null;
}

export async function renderWebGpuAppFrame(
  context: {
    readonly app: WebGpuApp;
    readonly sourceAssets: AssetRegistry;
  },
  resourceCache: WebGpuAppResourceCache,
  options: WebGpuAppFrameRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const { app, sourceAssets } = context;
  const reuse = createWebGpuAppResourceReuseReport();
  const phaseTimer = createWebGpuAppRenderPhaseTimer(
    options.phaseTimingSamples,
  );
  const extractedSnapshot = options.snapshot;
  const autoStandardMaterialShadowReceiverResources =
    options.autoStandardMaterialShadowReceiverResources !== false;

  phaseTimer.start("collect");

  if (extractedSnapshot === undefined) {
    const emptySnapshot = createEmptyRenderSnapshot(options.frame ?? 0);

    return renderReport({
      ok: false,
      snapshot: emptySnapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        emptySnapshot.frame,
      ),
      diagnostics: [
        {
          code: "webGpuApp.missingSnapshot",
          message:
            "Renderer-only WebGPU app rendering requires a RenderSnapshot from the simulation worker.",
        },
      ],
    });
  }

  const shadowPipelineKind =
    options.standardMaterialShadowReceiverResources === undefined
      ? autoStandardMaterialShadowReceiverResources
        ? standardAutoShadowPipelineKindFromSnapshot(extractedSnapshot)
        : null
      : standardShadowPipelineKind(
          options.standardMaterialShadowReceiverResources,
        );
  const shadowSnapshot =
    shadowPipelineKind === null
      ? extractedSnapshot
      : withStandardShadowPipelineKeys(extractedSnapshot, shadowPipelineKind);
  const iblSnapshot = hasReadyStandardDiffuseIblResources(
    options.standardMaterialIblResources,
  )
    ? withStandardIblPipelineKeys(
        shadowSnapshot,
        hasReadyStandardSpecularIblProofResources(
          options.standardMaterialIblResources,
        ),
      )
    : shadowSnapshot;
  const localLightCookieResources = prepareLocalLightClusterCookieResources({
    snapshot: iblSnapshot,
    assets: sourceAssets,
    device: app.initialization.device,
    cache: resourceCache,
    reuse,
    matrixCache: resourceCache.localLightCookieMatrices,
    ...(options.standardMaterialShadowReceiverResources === undefined
      ? {}
      : {
          shadowReceiverResources:
            options.standardMaterialShadowReceiverResources,
        }),
  });

  if (!localLightCookieResources.valid) {
    return renderReport({
      ok: false,
      snapshot: iblSnapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        iblSnapshot.frame,
      ),
      diagnostics: [
        ...iblSnapshot.diagnostics,
        ...localLightCookieResources.diagnostics,
      ],
    });
  }

  const snapshot = withStandardClusteredLocalLightPipelineKeys(iblSnapshot, {
    supportedCookieResources:
      localLightCookieResources.resources?.supportedResources ?? [],
    cookieTextureViewDimension:
      localLightCookieResources.resources?.textureViewDimension ?? null,
    reuseShadowMatricesForCookies:
      canReuseClusteredLocalLightShadowMatricesForCookies(
        options.standardMaterialShadowReceiverResources,
        localLightCookieResources.resources,
      ),
  });
  const updateMetadata = createWebGpuAppSnapshotUpdateMetadata(
    snapshot,
    options,
  );
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];
  const spriteDraws = snapshot.spriteDraws ?? [];
  const skyboxes = snapshot.skyboxes ?? [];
  const resourceSetPlan = createWebGpuAppDrawResourceSetPlan(snapshot);

  if (
    firstDraw === undefined &&
    firstView !== undefined &&
    (spriteDraws.length > 0 || skyboxes.length > 0)
  ) {
    phaseTimer.finish("collect");
    phaseTimer.start("prepare");

    return renderSpriteOnlyWebGpuAppFrame(context, resourceCache, {
      ...options,
      snapshot,
    });
  }

  if (firstDraw === undefined || firstView === undefined) {
    const materialDependencyDiagnostics = diagnoseSnapshotMaterialDependencies(
      sourceAssets,
      snapshot,
    );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        ...snapshot.diagnostics,
        ...materialDependencyDiagnostics,
        {
          code: "webGpuApp.emptySnapshot",
          message:
            "WebGPU app render requires at least one view and one mesh draw.",
        },
      ],
    });
  }

  const snapshotMaterialDependencyDiagnostics =
    diagnoseSnapshotMaterialDependencies(sourceAssets, snapshot);

  if (snapshotMaterialDependencyDiagnostics.length > 0) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        ...snapshot.diagnostics,
        ...snapshotMaterialDependencyDiagnostics,
      ],
    });
  }

  const meshEntry = sourceAssets.get<"mesh", MeshAsset>(firstDraw.mesh);
  const materialEntry = sourceAssets.get<"material", SourceMaterialAsset>(
    firstDraw.material,
  );
  const mesh = meshEntry?.asset ?? null;
  const material = materialEntry?.asset ?? null;

  if (mesh === null || material === null) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        {
          code: "webGpuApp.missingSourceAsset",
          message: "WebGPU app render requires ready mesh and material assets.",
        },
      ],
    });
  }

  const materialDependencyReadiness = createMaterialDependencyReadinessReport({
    registry: sourceAssets,
    material: firstDraw.material,
  });

  if (!materialDependencyReadiness.ready) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        ...snapshot.diagnostics,
        createWebGpuAppMaterialDependencyDiagnostic(
          materialDependencyReadiness,
        ),
      ],
    });
  }

  const materialIsCustom = isCustomWgslMaterialAsset(material);
  const builtInMaterial = materialIsCustom ? null : material;
  const materialFamilyLabel = materialIsCustom
    ? material.familyKey
    : material.kind;
  const firstMaterialKindSupported =
    builtInMaterial !== null &&
    isBuiltInMaterialQueueFamily(builtInMaterial.kind);
  const mixedCustomBuiltInSnapshot =
    createBuiltInOnlySnapshotForMixedCustomWgslRoute(sourceAssets, snapshot);

  if (mixedCustomBuiltInSnapshot !== null) {
    prepareWebGpuAppSourceAssetFacades({
      registry: sourceAssets,
      snapshot,
      cache: resourceCache,
      resourceReuse: reuse,
    });

    const queuedBuiltIn = collectQueuedBuiltInAppResourceSet({
      assets: sourceAssets,
      snapshot: mixedCustomBuiltInSnapshot,
      materialQueueScratch: resourceCache.frameScratch.materialQueue,
      routeScratch: resourceCache.frameScratch.queueRoute,
      meshes: resourceCache.preparedMeshFacade,
      materials: resourceCache.preparedMaterialFacade,
      adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
    });

    if (!queuedBuiltIn.valid || queuedBuiltIn.resourceSet === null) {
      const diagnosticsSummary =
        createQueuedBuiltInRouteFailureDiagnosticsSummary(
          queuedBuiltIn.diagnostics,
          QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
        );

      return renderReport({
        ok: false,
        snapshot,
        resourceReuse: reuse,
        phaseTimings: phaseTimer.report(
          resourceCache.phaseTimingHistory,
          snapshot.frame,
        ),
        ...(diagnosticsSummary === undefined ? {} : { diagnosticsSummary }),
        diagnostics: [...snapshot.diagnostics, ...queuedBuiltIn.diagnostics],
      });
    }

    phaseTimer.finish("collect");
    phaseTimer.start("prepare");

    return renderMixedCustomWgslWebGpuAppFrame({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      snapshot,
      snapshotChangeSet: updateMetadata.snapshotChangeSet,
      snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
      builtInSnapshot: mixedCustomBuiltInSnapshot,
      builtInResourceSet: queuedBuiltIn.resourceSet,
      reuse,
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.readbackSamples === undefined
        ? {}
        : { readbackSamples: options.readbackSamples }),
      ...(options.standardMaterialShadowReceiverResources === undefined
        ? {}
        : {
            standardMaterialShadowReceiverResources:
              options.standardMaterialShadowReceiverResources,
          }),
      autoStandardMaterialShadowReceiverResources,
      ...(options.standardMaterialIblResources === undefined
        ? {}
        : {
            standardMaterialIblResources: options.standardMaterialIblResources,
          }),
      localLightCookieResources: localLightCookieResources.resources,
      phaseTimer,
    });
  }

  if (materialIsCustom && resourceSetPlan.sets.length <= 1) {
    prepareWebGpuAppSourceAssetFacades({
      registry: sourceAssets,
      snapshot,
      cache: resourceCache,
      resourceReuse: reuse,
    });

    phaseTimer.finish("collect");
    phaseTimer.start("prepare");

    return renderCustomWgslWebGpuAppFrame({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      snapshot,
      snapshotChangeSet: updateMetadata.snapshotChangeSet,
      snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
      reuse,
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.readbackSamples === undefined
        ? {}
        : { readbackSamples: options.readbackSamples }),
      phaseTimer,
    });
  }

  if (!firstMaterialKindSupported && resourceSetPlan.sets.length <= 1) {
    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${materialFamilyLabel}'.`,
        },
      ],
    });
  }

  const multiUnlit = collectMultiUnlitAppResourceSet({
    assets: sourceAssets,
    snapshot,
    plan: resourceSetPlan,
    firstDraw,
  });
  const shouldUseQueuedBuiltInRoute =
    multiUnlit === null &&
    (firstMaterialKindSupported || resourceSetPlan.sets.length > 1);

  if (shouldUseQueuedBuiltInRoute) {
    prepareWebGpuAppSourceAssetFacades({
      registry: sourceAssets,
      snapshot,
      cache: resourceCache,
    });
  }

  const queuedBuiltIn = shouldUseQueuedBuiltInRoute
    ? collectQueuedBuiltInAppResourceSet({
        assets: sourceAssets,
        snapshot,
        materialQueueScratch: resourceCache.frameScratch.materialQueue,
        routeScratch: resourceCache.frameScratch.queueRoute,
        meshes: resourceCache.preparedMeshFacade,
        materials: resourceCache.preparedMaterialFacade,
        adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
      })
    : null;

  if (queuedBuiltIn !== null && !queuedBuiltIn.valid) {
    const diagnosticsSummary =
      createQueuedBuiltInRouteFailureDiagnosticsSummary(
        queuedBuiltIn.diagnostics,
        QUEUED_BUILT_IN_APP_RESOURCE_ADAPTER_VALIDATION,
      );

    return renderReport({
      ok: false,
      snapshot,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      ...(diagnosticsSummary === undefined ? {} : { diagnosticsSummary }),
      diagnostics: [...snapshot.diagnostics, ...queuedBuiltIn.diagnostics],
    });
  }

  phaseTimer.finish("collect");
  phaseTimer.start("prepare");

  if (queuedBuiltIn !== null && queuedBuiltIn.resourceSet !== null) {
    return renderQueuedBuiltInWebGpuAppFrame({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      snapshot,
      snapshotChangeSet: updateMetadata.snapshotChangeSet,
      snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
      resourceSet: queuedBuiltIn.resourceSet,
      reuse,
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(options.label === undefined ? {} : { label: options.label }),
      ...(options.readbackSamples === undefined
        ? {}
        : { readbackSamples: options.readbackSamples }),
      ...(options.standardMaterialShadowReceiverResources === undefined
        ? {}
        : {
            standardMaterialShadowReceiverResources:
              options.standardMaterialShadowReceiverResources,
          }),
      autoStandardMaterialShadowReceiverResources,
      ...(options.standardMaterialIblResources === undefined
        ? {}
        : {
            standardMaterialIblResources: options.standardMaterialIblResources,
          }),
      localLightCookieResources: localLightCookieResources.resources,
      phaseTimer,
    });
  }

  const materialKind =
    multiUnlit === null &&
    builtInMaterial !== null &&
    firstMaterialKindSupported
      ? builtInMaterial.kind
      : "unlit";
  const pipeline = await getOrCreateWebGpuAppPipeline({
    app,
    cache: resourceCache,
    reuse,
    kind: materialKind,
    pipelineKey: firstDraw.batchKey.pipelineKey,
    batchKey: firstDraw.batchKey,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: pipeline.diagnostics,
    });
  }

  const pipelineHandle = pipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.missingPipelineLayouts",
          message:
            "The WebGPU app pipeline does not expose bind group layouts.",
        },
      ],
    });
  }

  const getBindGroupLayout =
    pipelineHandle.getBindGroupLayout.bind(pipelineHandle);
  const layouts = getWebGpuAppPipelineLayouts({
    cache: resourceCache,
    kind: materialKind,
    pipeline,
    getBindGroupLayout,
  });
  const packedViews = writePackedSnapshotViewUniforms(
    snapshot,
    resourceCache.frameScratch.viewUniforms,
  );
  const packedTransforms = writePackedSnapshotTransforms(
    snapshot,
    resourceCache.frameScratch.worldTransforms,
  );
  const packedInstanceTints = writePackedSnapshotInstanceTintsForVertexBuffer(
    snapshot,
    packedTransforms,
    resourceCache.frameScratch.instanceTints,
  );
  const meshKey = sourceAssetCacheKey(firstDraw.mesh, meshEntry?.version ?? -1);
  const materialKey = sourceAssetCacheKey(
    firstDraw.material,
    materialEntry?.version ?? -1,
  );
  const singleBuiltInItem =
    multiUnlit === null && builtInMaterial !== null
      ? createSingleQueuedBuiltInAppResourceItem({
          adapters: QUEUED_BUILT_IN_MATERIAL_ADAPTERS,
          draw: firstDraw,
          drawIndex: 0,
          mesh,
          meshKey,
          material: builtInMaterial,
          materialKey,
          materialVersion: materialEntry?.version ?? -1,
          frame: snapshot.frame,
        })
      : null;

  if (multiUnlit === null && singleBuiltInItem === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialKind",
          message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${materialFamilyLabel}'.`,
        },
      ],
    });
  }

  const preparedTextures =
    singleBuiltInItem === null
      ? emptyPreparedAppTextureSamplerResources()
      : singleBuiltInItem.adapter.prepareTextureSamplerResources({
          app,
          assets: sourceAssets,
          cache: resourceCache,
          item: singleBuiltInItem,
          reuse,
        });

  if (!preparedTextures.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resourceReuse: reuse,
      diagnostics: [
        ...snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...preparedTextures.diagnostics,
      ],
    });
  }

  let resources: WebGpuAppFrameResourcesResult;

  if (multiUnlit !== null) {
    resources = createMultiUnlitAppFrameResources({
      app,
      mesh: multiUnlit.mesh,
      materials: multiUnlit.materials,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      layouts,
      reuse,
    });
  } else {
    const item = singleBuiltInItem;

    if (item === null) {
      return renderReport({
        ok: false,
        snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          {
            code: "webGpuApp.unsupportedMaterialKind",
            message: `WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '${materialFamilyLabel}'.`,
          },
        ],
      });
    }

    const standardAreaLightLtc = resolveStandardAreaLightLtcResources({
      app,
      cache: resourceCache,
      required: item.adapter.kind === "standard",
    });

    if (!standardAreaLightLtc.valid) {
      return renderReport({
        ok: false,
        snapshot,
        pipeline,
        resourceReuse: reuse,
        diagnostics: [
          ...snapshot.diagnostics,
          ...packedViews.diagnostics,
          ...packedTransforms.diagnostics,
          ...packedInstanceTints.diagnostics,
          ...standardAreaLightLtc.diagnostics,
        ],
      });
    }

    const textureSamplerDependencies =
      createPreparedMaterialTextureSamplerDependencies(preparedTextures);

    resources = item.adapter.createFrameResources({
      app,
      assets: sourceAssets,
      cache: resourceCache,
      preparedMaterials: resourceCache.preparedMaterials,
      snapshot,
      item,
      textureSamplerDependencies,
      viewUniforms: packedViews,
      worldTransforms: packedTransforms,
      instanceTints: packedInstanceTints,
      layouts,
      standardAreaLightLtcResources: standardAreaLightLtc.resources,
      localLightCookieResources: localLightCookieResources.resources,
      ...(options.standardMaterialShadowReceiverResources === undefined
        ? {}
        : {
            standardMaterialShadowReceiverResources:
              options.standardMaterialShadowReceiverResources,
          }),
      ...(options.standardMaterialIblResources === undefined
        ? {}
        : {
            standardMaterialIblResources: options.standardMaterialIblResources,
          }),
      reuse,
    });
  }

  if (!resources.valid || resources.resources === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...resources.diagnostics,
      ],
    });
  }

  const frameResources = resources.resources;
  const meshResourceKeys = new Map<string, string>();
  const materialResourceKeys = new Map<string, string>();

  meshResourceKeys.set(
    assetHandleKey(firstDraw.mesh),
    frameResources.mesh.resourceKey,
  );

  if ("materials" in frameResources && multiUnlit !== null) {
    for (let index = 0; index < multiUnlit.materialKeys.length; index += 1) {
      const materialResource = frameResources.materials[index];
      const materialHandleKey = multiUnlit.materialKeys[index];

      if (materialResource !== undefined && materialHandleKey !== undefined) {
        materialResourceKeys.set(
          materialHandleKey,
          materialResource.resourceKey,
        );
      }
    }
  } else if ("material" in frameResources) {
    materialResourceKeys.set(
      assetHandleKey(firstDraw.material),
      frameResources.material.resourceKey,
    );
  }

  const pipelineResult = {
    ok: true as const,
    status: "miss" as const,
    key: firstDraw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
  phaseTimer.finish("prepare");
  phaseTimer.start("queue");
  const framePlan = writeRenderFramePlanFromSnapshot({
    snapshot,
    snapshotChangeSet: updateMetadata.snapshotChangeSet,
    renderWorld: app.renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      meshResourceKeys.get(assetHandleKey(draw.mesh)) ?? null,
    resolveMaterialResourceKey: (draw) =>
      materialResourceKeys.get(assetHandleKey(draw.material)) ?? null,
    meshResources: [frameResources.mesh],
    ...("instanceTints" in frameResources
      ? { instanceTintResources: [frameResources.instanceTints] }
      : {}),
    pipelines: [pipelineResult],
    bindGroups: frameResources.bindGroups,
    scratch: resourceCache.frameScratch.framePlan,
  });
  phaseTimer.finish("queue");
  phaseTimer.start("sort");
  phaseTimer.finish("sort");
  phaseTimer.start("prepare");
  const spriteFrame = await prepareSpriteFrameResourcesForSnapshot({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    reuse,
  });
  phaseTimer.finish("prepare");

  if (!spriteFrame.resources.valid) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      resourceReuse: reuse,
      phaseTimings: phaseTimer.report(
        resourceCache.phaseTimingHistory,
        snapshot.frame,
      ),
      diagnostics: [
        ...snapshot.diagnostics,
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...packedInstanceTints.diagnostics,
        ...spriteFrame.resources.diagnostics,
      ],
    });
  }

  const frameCommands =
    spriteFrame.resources.commands.length === 0
      ? framePlan.commandPlan.commands
      : [...framePlan.commandPlan.commands, ...spriteFrame.resources.commands];
  const indirectDraws = prepareWebGpuAppIndirectDrawCommands({
    app,
    cache: resourceCache,
    commands: frameCommands,
    label: options.label ?? "aperture-webgpu-app",
  });
  phaseTimer.start("submit");
  const boundaries = await assembleWebGpuAppFrameBoundaries({
    app,
    assets: sourceAssets,
    cache: resourceCache,
    snapshot,
    commands: indirectDraws.commands,
    label: options.label ?? "aperture-webgpu-app",
    reuse,
    enableRenderBundles: shouldUseRenderBundlesForSnapshotSchedule(
      updateMetadata.snapshotUpdateSchedule,
    ),
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.readbackSamples === undefined
      ? {}
      : { readbackSamples: options.readbackSamples }),
  });

  await waitForSubmittedWork(app.initialization.device);
  const occlusionQueries = await readWebGpuAppOcclusionQueries({
    readbacks: boundaries.occlusionQueryReadbacks,
    diagnostics: boundaries.occlusionQueryDiagnostics,
    queryCount: boundaries.occlusionQueryCount,
    frame: snapshot.frame,
    feedbackState: resourceCache.occlusionFeedback,
    culling: boundaries.occlusionCulling,
  });
  const frameOk =
    framePlan.apply.diagnostics.length === 0 &&
    framePlan.bindingPlan.diagnostics.length === 0 &&
    framePlan.packages.diagnostics.length === 0 &&
    framePlan.drawCommands.diagnostics.length === 0 &&
    framePlan.drawList.valid &&
    framePlan.resources.valid &&
    framePlan.commandPlan.valid &&
    spriteFrame.resources.diagnostics.length === 0 &&
    boundaries.valid &&
    (occlusionQueries === undefined ||
      occlusionQueries.status !== "unsupported");
  const readback = await mapFrameBoundaryReadbackSamples(
    boundaries.readbackBoundary?.readback,
    frameOk,
  );
  phaseTimer.finish("submit");

  return renderReport({
    ok: frameOk,
    snapshot,
    snapshotChangeSet: updateMetadata.snapshotChangeSet,
    snapshotUpdateSchedule: updateMetadata.snapshotUpdateSchedule,
    pipeline,
    resources,
    boundary: boundaries.boundary,
    boundaries: boundaries.boundaries,
    renderTargets: boundaries.renderTargets,
    postEffects: boundaries.postEffects,
    ...(boundaries.renderBundles === undefined
      ? {}
      : { renderBundles: boundaries.renderBundles }),
    ...(boundaries.depthAttachment === undefined
      ? {}
      : { depthAttachment: boundaries.depthAttachment }),
    ...(readback === undefined ? {} : { readback }),
    ...(occlusionQueries === undefined ? {} : { occlusionQueries }),
    ...(indirectDraws.report.status === "skipped"
      ? {}
      : { indirectDraws: indirectDraws.report }),
    localLightCookieResources: localLightCookieResources.resources,
    resourceReuse: reuse,
    phaseTimings: phaseTimer.report(
      resourceCache.phaseTimingHistory,
      snapshot.frame,
    ),
    drawPackages: framePlan.packages.packages.length,
    drawCommands: boundaries.plannedCommands,
    drawCalls: boundaries.drawCalls,
    commandPressure: framePlan.commandPlan.pressure,
    diagnostics: [
      ...snapshot.diagnostics,
      ...framePlan.bindingPlan.diagnostics,
      ...framePlan.readiness.diagnostics,
      ...framePlan.packages.diagnostics,
      ...framePlan.drawCommands.diagnostics,
      ...framePlan.drawList.diagnostics,
      ...framePlan.resources.diagnostics,
      ...framePlan.commandPlan.diagnostics,
      ...spriteFrame.resources.diagnostics,
      ...boundaries.diagnostics,
      ...newOcclusionQueryDiagnostics(
        occlusionQueries,
        boundaries.occlusionQueryDiagnostics,
      ),
    ],
  });
}

function createBuiltInOnlySnapshotForMixedCustomWgslRoute(
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
): RenderSnapshot | null {
  const builtInDraws: MeshDrawPacket[] = [];
  let customDrawCount = 0;

  for (const draw of snapshot.meshDraws) {
    const material = assets.get<"material", SourceMaterialAsset>(
      draw.material,
    )?.asset;

    if (material === null || material === undefined) {
      continue;
    }

    if (isCustomWgslMaterialAsset(material)) {
      customDrawCount += 1;
      continue;
    }

    if (isBuiltInMaterialQueueFamily(material.kind)) {
      builtInDraws.push(draw);
    }
  }

  if (customDrawCount === 0 || builtInDraws.length === 0) {
    return null;
  }

  return {
    ...snapshot,
    meshDraws: builtInDraws,
    report: {
      ...snapshot.report,
      meshDraws: builtInDraws.length,
    },
  };
}
