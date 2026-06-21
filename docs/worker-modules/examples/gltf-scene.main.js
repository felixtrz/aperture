import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const shadowReceiverToggle = document.querySelector("#shadow-receiver-toggle");
const shadowCasterToggle = document.querySelector("#shadow-caster-toggle");
const exampleParams = new URLSearchParams(globalThis.location.search);
const enableIblSampling = !exampleParams.has("disable-ibl-sampling");
const enableSpecularIblSampling = !exampleParams.has(
  "disable-specular-ibl-sampling",
);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
};

const clearColor = [0.015, 0.025, 0.035, 1];
const primitiveShapes = [
  { meshIndex: 0, primitiveIndex: 0, shape: "plane" },
  { meshIndex: 1, primitiveIndex: 0, shape: "box" },
  { meshIndex: 2, primitiveIndex: 0, shape: "cone" },
];
const cameraIntent = {
  key: "gltf:camera:main",
  nodeKey: "gltf:node:camera",
  projection: "perspective",
  near: 0.1,
  far: 100,
  yfov: 0.9,
};
const directLightIntent = {
  key: "gltf:light:directional:0",
  nodeKey: "gltf:node:light:0",
  kind: "directional",
  color: [1, 0.94, 0.82],
  intensity: 2.4,
  castsShadow: true,
};
const environmentIntent = {
  key: "gltf:environment:studio",
  diffuseTextureHandleKey: "texture:gltf:environment:studio:diffuse",
  specularTextureHandleKey: "texture:gltf:environment:studio:specular",
  intensity: 0.6,
};
const shadowIntent = {
  key: "gltf:shadow:directional:0",
  lightKey: directLightIntent.key,
  mapSize: 1024,
  depthBias: 0.001,
  normalBias: 0.01,
};
const bufferBackedGlbKeyPrefix = "buffer-backed";
let shadowDepthTextureResourceReport = null;

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, sourceAssets, canvas);

      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "gltf-scene-failed",
      error instanceof Error ? error.message : "GLTF scene example failed.",
    ),
  );
}

function createScene(aperture, sourceAssets, targetCanvas) {
  const glbFixture = createGltfSceneGlbFixture(aperture);
  const bufferBackedGlbFixture =
    createGltfSceneBufferBackedGlbFixture(aperture);
  const root = glbFixture.root;
  const meshConstruction = createMeshConstructionReport(aperture);
  const environmentHandle = aperture.createEnvironmentMapHandle(
    "gltf:environment:studio",
  );

  sourceAssets.register(environmentHandle, { label: "GltfSceneStudioIBL" });
  sourceAssets.markReady(environmentHandle, {
    kind: "environment-map",
    label: "GltfSceneStudioIBL",
    diffuseTextureHandleKey: environmentIntent.diffuseTextureHandleKey,
    specularTextureHandleKey: environmentIntent.specularTextureHandleKey,
    intensity: environmentIntent.intensity,
  });

  const initialContract = aperture.createGltfSceneImportContractReport({
    root,
    resolveImageData: () => null,
    primitiveShapes,
    cameras: [cameraIntent],
    directLights: [directLightIntent],
    environment: environmentIntent,
    shadows: [shadowIntent],
  });
  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: sourceAssets,
    assetMapping: initialContract.assetMapping,
    meshConstruction,
  });
  const contract = aperture.createGltfSceneImportContractReport({
    root,
    resolveImageData: () => null,
    sourceRegistrationReport: registration.sourceRegistration,
    meshRegistrationReport: registration.meshRegistration,
    primitiveShapes,
    cameras: [cameraIntent],
    directLights: [directLightIntent],
    environment: environmentIntent,
    shadows: [shadowIntent],
  });

  if (contract.ecsCommandPlan === null) {
    throw new Error("GLTF scene contract did not produce an ECS command plan.");
  }

  const visibleBufferBackedPresentation =
    registerVisibleBufferBackedPresentationAssets(
      aperture,
      sourceAssets,
      bufferBackedGlbFixture,
    );

  setupShadowControls(shadowControls, () => {});

  return {
    canvas: targetCanvas,
    contract,
    environmentHandle,
    bufferBackedGlbFixture: bufferBackedGlbFixture.status,
    glbFixture: glbFixture.status,
    registration,
    shadowControls,
    visibleBufferBackedPresentation,
    workerScene: null,
    root,
  };
}

function registerVisibleBufferBackedPresentationAssets(
  aperture,
  sourceAssets,
  fixture,
) {
  const mesh = fixture.mesh;

  if (mesh === null) {
    throw new Error("Buffer-backed GLB fixture did not produce a mesh asset.");
  }

  const meshHandle = aperture.createMeshHandle(
    "gltf:buffer-backed:mesh:0:primitive:0",
  );
  const materialResolution = createBufferBackedMaterialResolution(
    aperture,
    fixture.importReport,
  );
  const resolvedMaterial = materialResolution.resolved[0];

  if (resolvedMaterial === undefined) {
    throw new Error("Buffer-backed GLB fixture did not resolve a material.");
  }

  const materialHandle = materialHandleFromKey(
    aperture,
    resolvedMaterial.materialHandleKey,
  );
  const materialAsset = materialAssetFromMapping(
    fixture.importReport,
    resolvedMaterial.materialIndex,
  );
  const baseColorFactor = Array.from(materialAsset.baseColorFactor, (value) =>
    Number(value.toFixed(4)),
  );
  const meshHandleKey = aperture.assetHandleKey(meshHandle);
  const materialHandleKey = aperture.assetHandleKey(materialHandle);

  sourceAssets.register(meshHandle, { label: "BufferBackedVisibleTriangle" });
  sourceAssets.markReady(meshHandle, {
    ...mesh,
    label: "BufferBackedVisibleTriangle",
  });
  sourceAssets.register(materialHandle, {
    label: materialAsset.label,
  });
  sourceAssets.markReady(materialHandle, materialAsset);

  return {
    meshHandleKey,
    materialHandleKey,
    materialSource: resolvedMaterial.source,
    baseColorFactor,
  };
}

function startRendering(aperture, app, scene) {
  const worker = new Worker("/aperture/worker-modules/examples/gltf-scene.worker.js", {
    name: "aperture-gltf-scene-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    standardMaterialShadowReceiverResources: null,
    standardMaterialIblResources: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
    shadowControls: scene.shadowControls,
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    scene.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop, scene);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;
  scene.workerScene = message.scene ?? scene.workerScene;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame,
    clearColor,
    label: "gltf-scene-app",
    ...(loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
    ...(!enableIblSampling || loop.standardMaterialIblResources === null
      ? {}
      : { standardMaterialIblResources: loop.standardMaterialIblResources }),
  });

  const nextFrameResources = await publishFrameStatus(
    aperture,
    app,
    scene,
    message.workerStep ?? {
      transformDiagnostics: message.snapshot.diagnostics.length,
    },
    report,
    message.frame,
    loop,
    typedSnapshot,
  );

  loop.standardMaterialShadowReceiverResources =
    nextFrameResources.standardMaterialShadowReceiverResources;
  loop.standardMaterialIblResources =
    nextFrameResources.standardMaterialIblResources;
  requestWorkerFrame(worker, loop, scene);
}

function requestWorkerFrame(worker, loop, scene) {
  requestAnimationFrame(() => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      shadowControls: scene.shadowControls,
    });
  });
}

async function publishFrameStatus(
  aperture,
  app,
  scene,
  workerStep,
  report,
  frame,
  loop,
  typedSnapshot,
) {
  const contractJson = aperture.gltfSceneImportContractReportToJsonValue(
    scene.contract,
  );
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const environmentMapKey = aperture.assetHandleKey(scene.environmentHandle);
  const environmentReadiness =
    aperture.environmentMapReadinessReportToJsonValue(
      aperture.createEnvironmentMapReadinessReport({
        snapshot: report.snapshot,
        resources: {
          environmentMapResourceKeys: [environmentMapKey],
        },
      }),
    );
  const iblDescriptor = aperture.iblResourceDescriptorReportToJsonValue(
    aperture.createIblResourceDescriptorReport({
      snapshot: report.snapshot,
      descriptors: [
        {
          environmentMapResourceKey: environmentMapKey,
          diffuseResourceKey: environmentIntent.diffuseTextureHandleKey,
          specularResourceKey: environmentIntent.specularTextureHandleKey,
        },
      ],
    }),
  );
  const iblTextures = aperture.iblTexturePreparationReportToJsonValue(
    aperture.createIblTexturePreparationReport({
      descriptors: iblDescriptor,
    }),
  );
  const iblSamplerDescriptors =
    aperture.createIblSamplerDescriptorReadinessReport({
      textures: iblTextures,
      allocation: "ready",
    });
  const iblAppResources = aperture.prepareWebGpuAppIblResourceReports({
    app,
    textures: iblTextures,
    samplers: iblSamplerDescriptors,
  });
  const diffuseIblTextureResourceReport =
    iblAppResources.diffuseTextureResource;
  const diffuseIblTextureResource =
    aperture.diffuseIblTextureResourceReportToJsonValue(
      diffuseIblTextureResourceReport,
    );
  const specularIblTextureResourceReport =
    iblAppResources.specularTextureResource;
  const specularIblTextureResource =
    aperture.specularIblTextureResourceReportToJsonValue(
      specularIblTextureResourceReport,
    );
  const iblSamplers = aperture.iblSamplerDescriptorReadinessReportToJsonValue(
    iblSamplerDescriptors,
  );
  const iblSamplerResourceReport = iblAppResources.samplerResources;
  const iblSamplerResources = aperture.iblSamplerResourceReportToJsonValue(
    iblSamplerResourceReport,
  );
  const diffuseIblResourceSummary =
    aperture.diffuseIblResourceSummaryReportToJsonValue(
      aperture.createDiffuseIblResourceSummaryReport({
        textures: iblTextures,
        diffuseTextureResource: diffuseIblTextureResourceReport,
        samplers: iblSamplerResourceReport,
      }),
    );
  const iblPassPlan = aperture.iblPreparationPassPlanReportToJsonValue(
    aperture.createIblPreparationPassPlanReport({
      textures: iblTextures,
    }),
  );
  const iblResourceSummary =
    aperture.iblPreparationResourceSummaryReportToJsonValue(
      aperture.createIblPreparationResourceSummaryReport({
        descriptors: iblDescriptor,
        textures: iblTextures,
        passPlan: iblPassPlan,
      }),
    );
  const standardMaterialCount =
    contractJson.summary.materialFamilies.find(
      (materialFamily) => materialFamily.family === "standard",
    )?.count ?? 0;
  const standardMaterialIbl =
    aperture.standardMaterialIblReadinessReportToJsonValue(
      aperture.createStandardMaterialIblReadinessReport({
        standardMaterialCount,
        iblDescriptors: iblDescriptor,
      }),
    );
  const standardMaterialIblBindGroupLayout =
    aperture.standardMaterialIblBindGroupLayoutReadinessReportToJsonValue(
      aperture.createStandardMaterialIblBindGroupLayoutReadinessReport({
        standardMaterialCount,
      }),
    );
  const standardMaterialIblBindGroupDescriptor =
    aperture.standardMaterialIblBindGroupDescriptorReadinessReportToJsonValue(
      aperture.createStandardMaterialIblBindGroupDescriptorReadinessReport({
        standardMaterialCount,
        textures: iblTextures,
        diffuseTextureResource: diffuseIblTextureResourceReport,
        specularTextureResource: specularIblTextureResourceReport,
        samplers: iblSamplerResourceReport,
      }),
    );
  const environmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const standardMaterialIblBindGroupResourceReport =
    aperture.createStandardMaterialIblBindGroupResourceReport({
      device: app.initialization.device,
      standardMaterialCount,
      descriptor: standardMaterialIblBindGroupDescriptor,
      diffuseTextureResource: diffuseIblTextureResourceReport,
      specularTextureResource: specularIblTextureResourceReport,
      samplers: iblSamplerResourceReport,
      cache: environmentResourceCache.standardIblBindGroups,
    });
  const standardMaterialIblBindGroupResource =
    aperture.standardMaterialIblBindGroupResourceReportToJsonValue(
      standardMaterialIblBindGroupResourceReport,
    );
  const environmentResourceCacheSummary =
    aperture.writeWebGpuEnvironmentResourceCacheSummary(
      aperture.createWebGpuEnvironmentResourceCacheSummary(),
      environmentResourceCache,
    );
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests: report.snapshot.shadowRequests,
      descriptors: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      })),
    }),
  );
  const shadowResources = aperture.shadowResourceReadinessReportToJsonValue(
    aperture.createShadowResourceReadinessReport({
      descriptors: shadowDescriptor,
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({
      descriptors: shadowDescriptor,
    }),
  );
  shadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });
  const shadowDepthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const shadowDepthResourceSummary =
    aperture.shadowDepthResourceSummaryReportToJsonValue(
      aperture.createShadowDepthResourceSummaryReport({
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowSamplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests: report.snapshot.shadowRequests,
      textures: shadowTextures,
    }),
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      aperture.createShadowPassAttachmentDescriptorReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const standardMaterialShadow =
    aperture.standardMaterialShadowReadinessReportToJsonValue(
      aperture.createStandardMaterialShadowReadinessReport({
        standardMaterialCount,
        shadowPassPlan,
      }),
    );
  const standardMaterialShadowBindGroupLayout =
    aperture.standardMaterialShadowBindGroupLayoutReadinessReportToJsonValue(
      aperture.createStandardMaterialShadowBindGroupLayoutReadinessReport({
        standardMaterialCount,
      }),
    );
  const shadowViewProjection =
    aperture.directionalShadowViewProjectionPlanReportToJsonValue(
      aperture.createDirectionalShadowViewProjectionPlanReport({
        shadowRequests: report.snapshot.shadowRequests,
        lights: report.snapshot.lights,
        shadowPassPlan,
      }),
    );
  const shadowMatrixComputation =
    aperture.directionalShadowMatrixComputationReportToJsonValue(
      aperture.createDirectionalShadowMatrixComputationReport({
        viewProjection: shadowViewProjection,
        transforms: report.snapshot.transforms,
      }),
    );
  const shadowProjectionCoverage = createShadowProjectionCoverageReport(
    shadowMatrixComputation,
  );
  const shadowMatrixBuffer =
    aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      aperture.createShadowMatrixBufferDescriptorReport({
        viewProjection: shadowViewProjection,
        upload: "ready",
      }),
    );
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowMatrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      shadowMatrixBufferResourceReport,
    );
  const standardMaterialShadowBindGroupDescriptorReport =
    aperture.createStandardMaterialShadowBindGroupDescriptorReadinessReport({
      standardMaterialCount,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      depthTextureResources: shadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
    });
  const standardMaterialShadowBindGroupDescriptor =
    aperture.standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(
      standardMaterialShadowBindGroupDescriptorReport,
    );
  const standardMaterialShadowBindGroupResourceReport =
    aperture.createStandardMaterialShadowBindGroupResourceReport({
      device: app.initialization.device,
      standardMaterialCount,
      descriptor: standardMaterialShadowBindGroupDescriptorReport,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      depthTextureResources: shadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
      cache: appEnvironmentResourceCache.standardShadowBindGroups,
    });
  const standardMaterialShadowBindGroupResource =
    aperture.standardMaterialShadowBindGroupResourceReportToJsonValue(
      standardMaterialShadowBindGroupResourceReport,
    );
  const shadowCasterDrawList =
    aperture.shadowCasterDrawListPlanReportToJsonValue(
      aperture.createShadowCasterDrawListPlanReport({
        shadowRequests: report.snapshot.shadowRequests,
        meshDraws: report.snapshot.meshDraws,
        shadowPassPlan,
      }),
    );
  const shadowCommandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection: shadowViewProjection,
        matrixBuffer: shadowMatrixBuffer,
        casterDrawList: shadowCasterDrawList,
      }),
    );
  const shadowPassCommandEncoding =
    aperture.shadowPassCommandEncodingReportToJsonValue(
      aperture.createShadowPassCommandEncodingReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
        matrixBufferResource: shadowMatrixBufferResourceReport,
        casterDrawList: shadowCasterDrawList,
        commandPlan: shadowCommandPlan,
      }),
    );
  const shadowCasterPipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding: shadowPassCommandEncoding,
        casterDrawList: shadowCasterDrawList,
      }),
    );
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterPipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      shadowCasterPipelineResourceReport,
    );
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterMatrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      shadowCasterMatrixBindGroupResourceReport,
    );
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowCasterFrameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList: shadowCasterDrawList,
        preparedMeshes: shadowCasterMeshViews.preparedMeshes,
        matrixBufferResource: shadowMatrixBufferResourceReport,
        pipelineDescriptor: shadowCasterPipelineDescriptor,
      }),
    );
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: shadowCasterFrameResources,
      commandPlan: shadowCommandPlan,
      pipelines: shadowCasterPipelineResourceReport.resources.map(
        (resource) => ({
          pipelineKey: resource.pipelineKey,
          resourceKey: resource.resourceKey,
          pipeline: resource.pipeline,
        }),
      ),
      matrixBindGroups:
        shadowCasterMatrixBindGroupResourceReport.resource === null
          ? []
          : [
              {
                matrixResourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .matrixResourceKey,
                resourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .resourceKey,
                group: shadowCasterMatrixBindGroupResourceReport.resource.group,
                bindGroup:
                  shadowCasterMatrixBindGroupResourceReport.resource.bindGroup,
              },
            ],
      meshes: shadowCasterMeshViews.executableMeshes,
    });
  const shadowCasterCommandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowCasterCommandRecordPlan,
    );
  const shadowGpuTimingResources = aperture.createGpuTimestampQueryResources({
    device: app.initialization.device,
    label: "gltf-scene:shadow:gpu-timing",
    queryCount: 2,
  });
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:directional",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: shadowPassAttachments,
      frameResources: shadowCasterFrameResources,
      commandEncoding: shadowPassCommandEncoding,
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        resolveShadowDepthView(shadowDepthTextureResourceReport, attachment),
      ...(shadowGpuTimingResources.resources === null
        ? {}
        : {
            gpuTiming: {
              resources: shadowGpuTimingResources.resources,
            },
          }),
    });
  const shadowPassEncoderAssembly =
    aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowPassEncoderAssemblyReport,
    );
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:directional",
      submit: true,
      ...(shadowGpuTimingResources.resources === null
        ? {}
        : {
            gpuTiming: {
              resources: shadowGpuTimingResources.resources,
            },
          }),
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
  const shadowGpuTimings = await readShadowGpuTimingReport(
    aperture,
    app,
    shadowGpuTimingResources,
    shadowPassEncoderAssemblyReport,
    shadowPassCommandBufferSubmissionReport,
  );
  const gpuTimings = mergeGpuTimingReports(
    reportJson.gpuTimings ?? reportJson.diagnosticsSummary?.gpuTimings ?? null,
    shadowGpuTimings,
  );

  if (gpuTimings !== null) {
    attachGpuTimingsToReportJson(reportJson, gpuTimings);
  }

  const shadowDepthProbeReport = await aperture.createShadowDepthProbeReport({
    device: app.initialization.device,
    samples: shadowProjectionCoverage.records,
    depthTextureResources: shadowDepthTextureResourceReport,
    samplerResource: shadowSamplerResourceReport,
    commandBufferSubmission: shadowPassCommandBufferSubmissionReport,
    depthBias: shadowIntent.depthBias,
  });
  const shadowDepthProbe = aperture.shadowDepthProbeReportToJsonValue(
    shadowDepthProbeReport,
  );
  const standardMaterialShadowReceiverBinding =
    aperture.standardMaterialShadowReceiverBindingReadinessReportToJsonValue(
      aperture.createStandardMaterialShadowReceiverBindingReadinessReport({
        standardMaterialCount,
        matrixBufferResource: shadowMatrixBufferResourceReport,
        depthTextureResources: shadowDepthTextureResourceReport,
        samplerResource: shadowSamplerResourceReport,
        bindGroupResource: standardMaterialShadowBindGroupResourceReport,
        commandBufferSubmission: shadowPassCommandBufferSubmissionReport,
      }),
    );
  const shadowResourceSummary =
    aperture.shadowCommandResourceSummaryReportToJsonValue(
      aperture.createShadowCommandResourceSummaryReport({
        textures: shadowTextures,
        passPlan: shadowPassPlan,
        viewProjection: shadowViewProjection,
        matrixBuffer: shadowMatrixBuffer,
        casterDrawList: shadowCasterDrawList,
        commandPlan: shadowCommandPlan,
      }),
    );
  const standardMaterialIblShadowBinding =
    aperture.standardMaterialIblShadowBindingReadinessReportToJsonValue(
      aperture.createStandardMaterialIblShadowBindingReadinessReport({
        standardMaterialCount,
        iblPassPlan,
        shadowViewProjection,
        shadowCasterDrawList,
      }),
    );
  const standardMaterialIblShadowPipelineKey =
    aperture.standardMaterialIblShadowPipelineKeyReadinessReportToJsonValue(
      aperture.createStandardMaterialIblShadowPipelineKeyReadinessReport({
        standardMaterialCount,
        bindingReadiness: standardMaterialIblShadowBinding,
      }),
    );
  const standardMaterialIblAppRoute = createStandardMaterialIblAppRouteStatus(
    report,
    standardMaterialIblBindGroupResource,
  );
  const readiness = createReadinessGrouping({
    environmentReadiness,
    iblDescriptor,
    iblTextures,
    diffuseIblTextureResource,
    specularIblTextureResource,
    iblSamplers,
    iblSamplerResources,
    diffuseIblResourceSummary,
    iblPassPlan,
    iblResourceSummary,
    standardMaterialIbl,
    standardMaterialIblBindGroupLayout,
    standardMaterialIblBindGroupDescriptor,
    standardMaterialIblBindGroupResource,
    standardMaterialIblAppRoute,
    standardMaterialIblShadowBinding,
    standardMaterialIblShadowPipelineKey,
    shadowDescriptor,
    shadowResources,
    shadowTextures,
    shadowDepthTextureResources,
    shadowDepthResourceSummary,
    shadowPassPlan,
    shadowPassAttachments,
    shadowViewProjection,
    shadowMatrixComputation,
    shadowMatrixBuffer,
    shadowMatrixBufferResource,
    shadowCasterDrawList,
    shadowCommandPlan,
    shadowPassCommandEncoding,
    shadowCasterPipelineDescriptor,
    shadowCasterPipelineResource,
    shadowCasterMatrixBindGroupResource,
    shadowCasterFrameResources,
    shadowCasterCommandRecords,
    shadowPassEncoderAssembly,
    shadowPassCommandBufferSubmission,
    shadowDepthProbe,
    standardMaterialShadowReceiverBinding,
    shadowResourceSummary,
    standardMaterialShadow,
    standardMaterialShadowBindGroupLayout,
    standardMaterialShadowBindGroupDescriptor,
    shadowSamplerResource,
    standardMaterialShadowBindGroupResource,
  });

  const workerScene = scene.workerScene ?? {
    replay: {
      source: "runtime-facade",
      valid: false,
      created: 0,
      appliedComponents: 0,
      diagnostics: 0,
    },
    visibleBufferBackedReplay: {
      source: "runtime-facade",
      valid: false,
      created: 0,
      diagnostics: 0,
      ...scene.visibleBufferBackedPresentation,
    },
    shadowControls: scene.shadowControls,
  };

  publishStatus({
    example: "gltf-scene",
    ok: report.ok && scene.contract.valid && workerScene.replay.valid,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    worker: {
      running: loop.workerReady,
      scene: workerScene,
      step: workerStep,
    },
    transport: {
      mode: "structured-clone-postMessage",
      jsonRoundTrip: false,
      snapshotsReceived: loop.receivedSnapshots,
      typedArraysPreserved: typedSnapshot,
    },
    source: {
      glbFixture: scene.glbFixture,
      bufferBackedGlbFixture: scene.bufferBackedGlbFixture,
    },
    frame,
    readiness,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    gltf: {
      contract: contractJson.summary,
      diagnostics: contractJson.diagnostics,
      registration: {
        valid: scene.registration.valid,
        stages: scene.registration.stages,
      },
      replay: workerScene.replay,
      visibleBufferBackedReplay: workerScene.visibleBufferBackedReplay,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: workerStep.transformDiagnostics,
      environments: report.snapshot.environments.length,
      shadowRequests: report.snapshot.shadowRequests.length,
    },
    ibl: {
      environmentMapKey,
      readiness: environmentReadiness,
      descriptor: iblDescriptor,
      textures: iblTextures,
      diffuseTextureResource: diffuseIblTextureResource,
      specularTextureResource: specularIblTextureResource,
      samplers: iblSamplers,
      samplerResources: iblSamplerResources,
      resourceReuse: iblAppResources.reuse,
      cacheSummary: environmentResourceCacheSummary,
      diffuseResourceSummary: diffuseIblResourceSummary,
      passPlan: iblPassPlan,
      resourceSummary: iblResourceSummary,
      bindGroupLayout: standardMaterialIblBindGroupLayout,
      bindGroupDescriptor: standardMaterialIblBindGroupDescriptor,
      bindGroupResource: standardMaterialIblBindGroupResource,
      appFrameRoute: standardMaterialIblAppRoute,
      shaderBinding: standardMaterialIblShadowBinding,
      pipelineKey: standardMaterialIblShadowPipelineKey,
      standardMaterial: standardMaterialIbl,
      sampling: {
        supported:
          enableIblSampling &&
          standardMaterialIblBindGroupResourceReport.status === "available" &&
          diffuseIblTextureResourceReport.status === "available" &&
          iblSamplerResourceReport.status === "available",
        mode: "diffuse-ibl",
        specularProof:
          enableIblSampling &&
          enableSpecularIblSampling &&
          specularIblTextureResourceReport.sections.proofUpload === true,
        deferred: ["specular-prefilter", "split-sum-brdf", "skybox"],
      },
    },
    shadow: {
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      controls: {
        receiverEnabled: scene.shadowControls.receiverEnabled,
        casterEnabled: scene.shadowControls.casterEnabled,
      },
      authoring: createShadowAuthoringStatus(report.snapshot.meshDraws),
      intent: {
        key: shadowIntent.key,
        lightKey: shadowIntent.lightKey,
        kind: directLightIntent.kind,
        mapSize: shadowIntent.mapSize,
        bias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      },
      descriptor: shadowDescriptor,
      resources: shadowResources,
      textures: shadowTextures,
      depthTextureResources: shadowDepthTextureResources,
      depthResourceSummary: shadowDepthResourceSummary,
      samplerResource: shadowSamplerResource,
      passPlan: shadowPassPlan,
      passAttachments: shadowPassAttachments,
      bindGroupDescriptor: standardMaterialShadowBindGroupDescriptor,
      bindGroupResource: standardMaterialShadowBindGroupResource,
      viewProjection: shadowViewProjection,
      matrixComputation: shadowMatrixComputation,
      projectionCoverage: shadowProjectionCoverage,
      matrixBuffer: shadowMatrixBuffer,
      matrixBufferResource: shadowMatrixBufferResource,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: shadowPassCommandEncoding,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
      pipelineResource: shadowCasterPipelineResource,
      matrixBindGroupResource: shadowCasterMatrixBindGroupResource,
      frameResources: shadowCasterFrameResources,
      commandRecords: shadowCasterCommandRecords,
      encoderAssembly: shadowPassEncoderAssembly,
      commandBufferSubmission: shadowPassCommandBufferSubmission,
      depthProbe: shadowDepthProbe,
      receiverBinding: standardMaterialShadowReceiverBinding,
      resourceSummary: shadowResourceSummary,
      bindGroupLayout: standardMaterialShadowBindGroupLayout,
      standardMaterial: standardMaterialShadow,
      rendering: {
        supported:
          hasShadowReceiverDraw(report.snapshot.meshDraws) &&
          shadowPassCommandBufferSubmissionReport.status === "submitted" &&
          standardMaterialShadowReceiverBinding.status === "ready",
        mode: "directional-depth-compare",
        filter: "pcf-3x3",
        diagnostic: {
          code: "gltfScene.shadowMapActive",
          severity: "info",
          message:
            "GLTF scene shadow request is rendered through the submitted shadow depth pass and StandardMaterial shadow-map pipeline.",
        },
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    gpuTimings,
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    report: reportJson,
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
  });

  return {
    standardMaterialShadowReceiverResources: {
      matrixBufferResource: shadowMatrixBufferResourceReport,
      depthTextureResources: shadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
    },
    standardMaterialIblResources: {
      bindGroupResource: standardMaterialIblBindGroupResourceReport,
      diffuseTextureResource: diffuseIblTextureResourceReport,
      ...(enableSpecularIblSampling
        ? { specularTextureResource: specularIblTextureResourceReport }
        : {}),
      samplerResource: iblSamplerResourceReport,
    },
  };
}

function createShadowAuthoringStatus(meshDraws) {
  const casterCount = meshDraws.filter(
    (draw) => draw.castsShadow !== false,
  ).length;
  const receiverCount = meshDraws.filter(
    (draw) => draw.receivesShadow !== false,
  ).length;

  return {
    drawCount: meshDraws.length,
    casterCount,
    receiverCount,
    disabledCasterCount: meshDraws.length - casterCount,
    disabledReceiverCount: meshDraws.length - receiverCount,
  };
}

function hasShadowReceiverDraw(meshDraws) {
  return meshDraws.some((draw) => draw.receivesShadow !== false);
}

function setupShadowControls(controls, onChange) {
  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = controls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      controls.receiverEnabled = shadowReceiverToggle.checked;
      onChange();
    });
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = controls.casterEnabled;
    shadowCasterToggle.addEventListener("change", () => {
      controls.casterEnabled = shadowCasterToggle.checked;
      onChange();
    });
  }
}

function createReadinessGrouping(input) {
  const iblPhases = {
    environmentMap: input.environmentReadiness.ready ? "ready" : "missing",
    descriptors: input.iblDescriptor.ready ? "ready" : "missing",
    texturePreparation: input.iblTextures.status,
    diffuseTextureResource: normalizeStatus(
      input.diffuseIblTextureResource.status,
    ),
    specularTextureResource: normalizeStatus(
      input.specularIblTextureResource.status,
    ),
    samplerDescriptors: input.iblSamplers.status,
    samplerResources: normalizeStatus(input.iblSamplerResources.status),
    diffuseResourceSummary: input.diffuseIblResourceSummary.status,
    preparationPasses: input.iblPassPlan.status,
    resourceSummary: input.iblResourceSummary.status,
    standardMaterial: normalizeStatus(input.standardMaterialIbl.status),
    bindGroupLayout: input.standardMaterialIblBindGroupLayout.status,
    bindGroupDescriptor: input.standardMaterialIblBindGroupDescriptor.status,
    bindGroupResource: normalizeStatus(
      input.standardMaterialIblBindGroupResource.status,
    ),
    appFrameRoute: input.standardMaterialIblAppRoute.status,
    shaderBinding: normalizeStatus(
      input.standardMaterialIblShadowBinding.status,
    ),
    pipelineKey: input.standardMaterialIblShadowPipelineKey.status,
    shaderSampling:
      enableIblSampling &&
      input.standardMaterialIblBindGroupResource.status === "available" &&
      input.diffuseIblTextureResource.status === "available" &&
      input.iblSamplerResources.status === "available"
        ? "ready"
        : "deferred",
  };
  const shadowPhases = {
    descriptors: input.shadowDescriptor.ready ? "ready" : "missing",
    resourceReadiness: normalizeStatus(input.shadowResources.status),
    textureDescriptors: input.shadowTextures.ready ? "deferred" : "missing",
    depthTextureResources: normalizeStatus(
      input.shadowDepthTextureResources.status,
    ),
    depthResourceSummary: input.shadowDepthResourceSummary.status,
    passPlans: input.shadowPassPlan.status,
    passAttachments: input.shadowPassAttachments.status,
    viewProjection: input.shadowViewProjection.status,
    matrixComputation: input.shadowMatrixComputation.status,
    matrixBuffer: input.shadowMatrixBuffer.status,
    matrixBufferResource: normalizeStatus(
      input.shadowMatrixBufferResource.status,
    ),
    casterDrawLists: input.shadowCasterDrawList.status,
    commandPlans: input.shadowCommandPlan.status,
    commandEncoding: input.shadowPassCommandEncoding.status,
    pipelineDescriptor: input.shadowCasterPipelineDescriptor.status,
    pipelineResource: normalizeStatus(
      input.shadowCasterPipelineResource.status,
    ),
    matrixBindGroupResource: normalizeStatus(
      input.shadowCasterMatrixBindGroupResource.status,
    ),
    frameResources: input.shadowCasterFrameResources.status,
    commandRecords: input.shadowCasterCommandRecords.status,
    encoderAssembly: input.shadowPassEncoderAssembly.status,
    commandBufferSubmission: input.shadowPassCommandBufferSubmission.status,
    depthProbe: input.shadowDepthProbe.status,
    receiverBinding: input.standardMaterialShadowReceiverBinding.status,
    resourceSummary: input.shadowResourceSummary.status,
    bindGroupLayout: input.standardMaterialShadowBindGroupLayout.status,
    bindGroupDescriptor: input.standardMaterialShadowBindGroupDescriptor.status,
    samplerResource: normalizeStatus(input.shadowSamplerResource.status),
    bindGroupResource: normalizeStatus(
      input.standardMaterialShadowBindGroupResource.status,
    ),
    standardMaterial: input.standardMaterialShadow.status,
    rendering:
      input.shadowPassCommandBufferSubmission.status === "submitted" &&
      input.standardMaterialShadowReceiverBinding.status === "ready"
        ? "ready"
        : "deferred",
  };

  return {
    ibl: {
      status: summarizePhaseStatus(Object.values(iblPhases)),
      phases: iblPhases,
    },
    shadow: {
      status: summarizePhaseStatus(Object.values(shadowPhases)),
      phases: shadowPhases,
    },
  };
}

function createStandardMaterialIblAppRouteStatus(report, bindGroupResource) {
  const expectedResourceKey = bindGroupResource.resource?.resourceKey ?? null;
  const routedResource = findStandardMaterialIblRoutedResource(report);
  const ready =
    expectedResourceKey !== null &&
    routedResource !== null &&
    routedResource.resourceKey === expectedResourceKey;

  return {
    ready,
    status: ready
      ? "ready"
      : expectedResourceKey === null
        ? "missing"
        : "deferred",
    group: 4,
    sections: {
      bindGroupResource: expectedResourceKey !== null,
      appFrameResources: routedResource !== null,
      drawListBinding: false,
      shaderSampling: false,
    },
    resource:
      routedResource === null
        ? null
        : {
            group: routedResource.group,
            resourceKey: routedResource.resourceKey,
            layoutKey: routedResource.layoutKey,
            entryResourceKeys: [...routedResource.entryResourceKeys],
          },
    diagnostics: ready
      ? [
          {
            code: "gltfScene.standardMaterialIblAppRoute.shaderSamplingDeferred",
            severity: "warning",
            message:
              "StandardMaterial IBL group 4 is routed through app frame resources, but WGSL sampling remains deferred.",
          },
        ]
      : [
          {
            code:
              expectedResourceKey === null
                ? "gltfScene.standardMaterialIblAppRoute.missingBindGroupResource"
                : "gltfScene.standardMaterialIblAppRoute.pendingFrameResource",
            severity: "warning",
            message:
              expectedResourceKey === null
                ? "StandardMaterial IBL app routing requires an available group 4 bind group resource."
                : "StandardMaterial IBL app routing will be visible after the next app frame consumes the group 4 resource.",
          },
        ],
  };
}

function findStandardMaterialIblRoutedResource(report) {
  const resources = report.resources?.resources;
  const standardResources = Array.isArray(resources?.standard)
    ? resources.standard
    : resources?.standardMaterialIblBindGroup === undefined
      ? []
      : [resources];

  for (const resource of standardResources) {
    if (resource?.standardMaterialIblBindGroup !== undefined) {
      return resource.standardMaterialIblBindGroup;
    }
  }

  return null;
}

async function readShadowGpuTimingReport(
  aperture,
  app,
  resourcesResult,
  assemblyReport,
  submissionReport,
) {
  if (resourcesResult.resources === null) {
    return resourcesResult.diagnostics.length === 0
      ? null
      : aperture.createUnsupportedGpuPassTimingReport({
          queryCount: 2,
          diagnostics: resourcesResult.diagnostics,
        });
  }

  await app.initialization.device.queue?.onSubmittedWorkDone?.();

  return aperture.createGpuPassTimingReport({
    passNames: ["shadow"],
    readback: await aperture.readGpuTimestampQueryResults(
      resourcesResult.resources,
    ),
    diagnostics: [
      ...(assemblyReport.gpuTiming?.diagnostics ?? []),
      ...(submissionReport.gpuTiming?.diagnostics ?? []),
    ],
  });
}

function mergeGpuTimingReports(main, shadow) {
  if (main === null && shadow === null) {
    return null;
  }

  const reports = [main, shadow].filter(Boolean);

  return {
    ready: reports.every((report) => report.ready),
    supported: reports.some((report) => report.supported),
    queryCount: reports.reduce((sum, report) => sum + report.queryCount, 0),
    passes: reports.flatMap((report) => report.passes),
    diagnostics: reports.flatMap((report) => report.diagnostics),
  };
}

function attachGpuTimingsToReportJson(reportJson, gpuTimings) {
  const hadGpuTimings = reportJson.diagnosticsSummary?.gpuTimings !== undefined;

  reportJson.gpuTimings = gpuTimings;
  reportJson.diagnosticsSummary = {
    ...(reportJson.diagnosticsSummary ?? { sectionCount: 0 }),
    sectionCount:
      (reportJson.diagnosticsSummary?.sectionCount ?? 0) +
      (hadGpuTimings ? 0 : 1),
    gpuTimings,
  };
}

function normalizeStatus(status) {
  return status === "available" ? "ready" : status;
}

function summarizePhaseStatus(statuses) {
  if (statuses.includes("missing")) {
    return "missing";
  }

  if (statuses.includes("unsupported")) {
    return "unsupported";
  }

  if (statuses.includes("deferred")) {
    return "deferred";
  }

  return "ready";
}

function familyBuckets(report) {
  const buckets = report.resources?.routeSummary?.familyBuckets;
  if (!Array.isArray(buckets)) {
    return [];
  }

  return buckets.map((bucket) => ({
    family: bucket.family,
    routedItems: bucket.routedItems,
    frameResources: bucket.frameResources,
  }));
}

function resolveShadowDepthView(depthTextureResources, attachment) {
  const resource = depthTextureResources.resources.find(
    (candidate) =>
      candidate.shadowId === attachment.shadowId &&
      candidate.lightId === attachment.lightId &&
      candidate.viewKey === attachment.viewKey,
  );

  return resource?.allocation.resource?.view ?? null;
}

function createShadowProjectionCoverageReport(matrixComputation) {
  const matrix = matrixComputation.matrices?.[0] ?? null;

  if (matrix === null) {
    return {
      ready: false,
      status: "missing",
      matrixKey: null,
      sampleCount: 0,
      receiverInsideCount: 0,
      casterInsideCount: 0,
      records: [],
      diagnostics: [
        {
          code: "gltfScene.shadowProjectionCoverage.missingMatrix",
          severity: "warning",
          message:
            "Shadow projection coverage requires a ready directional shadow matrix.",
        },
      ],
    };
  }

  const records = shadowProjectionSamples().map((sample) =>
    projectShadowSample(matrix.viewProjectionMatrix, sample),
  );
  const receiverRecords = records.filter(
    (record) => record.role === "receiver",
  );
  const casterRecords = records.filter((record) => record.role === "caster");
  const receiverInsideCount = receiverRecords.filter(
    (record) => record.insideProjection,
  ).length;
  const casterInsideCount = casterRecords.filter(
    (record) => record.insideProjection,
  ).length;
  const ready = receiverInsideCount > 0 && casterInsideCount > 0;

  return {
    ready,
    status: ready ? "ready" : "missing",
    matrixKey: matrix.matrixKey,
    sampleCount: records.length,
    receiverInsideCount,
    casterInsideCount,
    records,
    diagnostics: ready
      ? []
      : [
          {
            code: "gltfScene.shadowProjectionCoverage.noOverlap",
            severity: "warning",
            message:
              "Shadow projection coverage did not find both receiver and caster samples inside the light projection.",
          },
        ],
  };
}

function shadowProjectionSamples() {
  return [
    {
      key: "receiver:plane:center",
      role: "receiver",
      shape: "plane",
      worldPosition: [0.35, -0.15, 0],
    },
    {
      key: "receiver:cone:center",
      role: "receiver",
      shape: "cone",
      worldPosition: [1.45, -0.05, 0],
    },
    {
      key: "receiver:box-center-depth-probe",
      role: "receiver",
      shape: "debug-depth-probe",
      worldPosition: [0, 0, 0],
    },
    {
      key: "caster:box:center",
      role: "caster",
      shape: "box",
      worldPosition: [0, 0, 0],
    },
    {
      key: "caster:box:top",
      role: "caster",
      shape: "box",
      worldPosition: [0, 0.5, 0],
    },
  ];
}

function projectShadowSample(matrix, sample) {
  const clip = transformPoint4(matrix, sample.worldPosition);
  const w = Math.abs(clip[3]) <= 0.00001 ? 1 : clip[3];
  const ndc = [clip[0] / w, clip[1] / w, clip[2] / w];
  const depth = ndc[2] < 0 ? ndc[2] * 0.5 + 0.5 : ndc[2];
  const uv = [ndc[0] * 0.5 + 0.5, 0.5 - ndc[1] * 0.5];
  const clampedUv = [clamp01(uv[0]), clamp01(uv[1])];
  const clampedDepth = clamp01(depth);
  const projectionDistance = Math.max(
    Math.hypot(uv[0] - clampedUv[0], uv[1] - clampedUv[1]),
    Math.abs(depth - clampedDepth),
  );

  return {
    key: sample.key,
    role: sample.role,
    shape: sample.shape,
    worldPosition: sample.worldPosition,
    uv: sanitizeTuple2(uv),
    depth: sanitizeNumber(depth),
    insideProjection:
      uv[0] >= 0 &&
      uv[0] <= 1 &&
      uv[1] >= 0 &&
      uv[1] <= 1 &&
      depth >= 0 &&
      depth <= 1,
    projectionDistance: sanitizeNumber(projectionDistance),
  };
}

function transformPoint4(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];

  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15],
  ];
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function sanitizeTuple2(value) {
  return [sanitizeNumber(value[0]), sanitizeNumber(value[1])];
}

function sanitizeNumber(value) {
  return Object.is(value, -0) ? 0 : value;
}

function createGltfSceneRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0, translation: [0.35, -0.15, 0] },
      {
        name: "Box",
        mesh: 1,
        translation: [0, 0, 0],
        rotation: [0, 0.382683, 0, 0.92388],
      },
      { name: "Cone", mesh: 2, translation: [1.45, -0.05, 0] },
    ],
    accessors: [{}, {}, {}],
    meshes: [
      {
        name: "PlaneMesh",
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
      },
      {
        name: "BoxMesh",
        primitives: [{ attributes: { POSITION: 1 }, material: 1 }],
      },
      {
        name: "ConeMesh",
        primitives: [{ attributes: { POSITION: 2 }, material: 0 }],
      },
    ],
    materials: [
      {
        name: "StandardBlue",
        pbrMetallicRoughness: {
          baseColorFactor: [0.2, 0.42, 1, 1],
          metallicFactor: 0.12,
          roughnessFactor: 0.55,
        },
        emissiveFactor: [0.02, 0.025, 0.04],
      },
      {
        name: "UnlitCoral",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.36, 0.18, 1],
        },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };
}

function createGltfSceneGlbFixture(aperture) {
  const source = createGlbFixtureSource(createGltfSceneRoot());
  const loader = aperture.createNoFetchGlbSourceLoaderReport({
    source,
  });
  const report = loader.glbImportReport;
  const container = report.container.container;

  if (!report.valid || container === null || report.importReport === null) {
    throw new Error("GLTF scene GLB fixture did not produce a valid root.");
  }

  return {
    root: container.json,
    status: {
      ...loader.status,
      outputSummary: loader.outputSummary,
    },
  };
}

function createGltfSceneBufferBackedGlbFixture(aperture) {
  const { source } = createIndexedTriangleGlbFixtureSource();
  const preflight = aperture.createNoFetchGlbSourceLoaderReport({
    source,
    keyPrefix: bufferBackedGlbKeyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const root = preflight.glbImportReport.container.container?.json;

  if (!preflight.glbImportReport.valid || root === undefined) {
    throw new Error("GLTF scene buffer-backed GLB fixture did not load.");
  }

  const ecsCommandPlan = aperture.createGltfEcsAuthoringCommandPlan({
    traversalReport: aperture.createGltfSceneTraversalReport({ root }),
  });
  const loader = aperture.createNoFetchGlbSourceLoaderReport({
    source,
    keyPrefix: bufferBackedGlbKeyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
    ecsCommandPlan,
  });

  return {
    mesh:
      loader.glbImportReport.importReport?.meshConstruction?.meshes[0]?.mesh ??
      null,
    importReport: loader.glbImportReport.importReport,
    status: {
      ...loader.status,
      outputSummary: loader.outputSummary,
    },
  };
}

function createBufferBackedMaterialResolution(aperture, importReport) {
  if (
    importReport === null ||
    importReport.meshPrimitive === null ||
    importReport.assetMapping === null
  ) {
    throw new Error("Buffer-backed GLB fixture did not produce material data.");
  }

  return aperture.createGltfPrimitiveMaterialResolutionReport({
    primitiveReport: importReport.meshPrimitive,
    registrationReport: {
      valid: true,
      written: importReport.assetMapping.materials.map((material) => ({
        kind: "material",
        plannedHandleKey: material.handleKey,
        registeredHandleKey: material.handleKey,
        materialIndex: material.materialIndex,
        diagnostics: [],
      })),
      skipped: [],
      diagnostics: [],
    },
    keyPrefix: bufferBackedGlbKeyPrefix,
  });
}

function materialHandleFromKey(aperture, materialHandleKey) {
  const id = materialHandleKey.startsWith("material:")
    ? materialHandleKey.slice("material:".length)
    : materialHandleKey;

  return aperture.createMaterialHandle(id);
}

function materialAssetFromMapping(importReport, materialIndex) {
  const material = importReport?.assetMapping?.materials.find(
    (entry) => entry.materialIndex === materialIndex,
  )?.material;

  if (material === undefined || material === null) {
    throw new Error("Buffer-backed GLB fixture material mapping is missing.");
  }

  return material;
}

function createGlbFixtureSource(root) {
  return createGlbFixture([
    {
      typeCode: 0x4e4f534a,
      data: padGlbChunkData(
        new TextEncoder().encode(JSON.stringify(root)),
        0x20,
      ),
    },
  ]);
}

function createIndexedTriangleGlbFixtureSource() {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  [0, 2, 1].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "BufferBackedTriangle", mesh: 0 }],
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [
      {
        name: "BufferBackedSourceMint",
        pbrMetallicRoughness: {
          baseColorFactor: [0.12, 0.78, 0.46, 1],
          metallicFactor: 0,
          roughnessFactor: 0.62,
        },
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };

  return {
    source: createGlbFixture([
      {
        typeCode: 0x4e4f534a,
        data: padGlbChunkData(
          new TextEncoder().encode(JSON.stringify(root)),
          0x20,
        ),
      },
      {
        typeCode: 0x004e4942,
        data: bytes,
      },
    ]),
  };
}

function createGlbFixture(chunks) {
  const headerByteLength = 12;
  const chunkHeaderByteLength = 8;
  const byteLength =
    headerByteLength +
    chunks.reduce(
      (total, chunk) => total + chunkHeaderByteLength + chunk.data.byteLength,
      0,
    );
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = headerByteLength;

  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, byteLength, true);

  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true);
    view.setUint32(offset + 4, chunk.typeCode, true);
    bytes.set(chunk.data, offset + chunkHeaderByteLength);
    offset += chunkHeaderByteLength + chunk.data.byteLength;
  }

  return bytes;
}

function padGlbChunkData(data, padByte) {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength);

  padded.set(data);
  padded.fill(padByte, data.byteLength);

  return padded;
}

function createMeshConstructionReport(aperture) {
  return {
    valid: true,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh: aperture.createPlaneMeshAsset({
          label: "GltfScenePlane",
          width: 1.15,
          height: 1.15,
        }),
      },
      {
        handleKey: "gltf:mesh:1:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:1:primitive:0",
        meshIndex: 1,
        primitiveIndex: 0,
        mesh: aperture.createBoxMeshAsset({
          label: "GltfSceneBox",
          width: 1,
          height: 1,
          depth: 1,
        }),
      },
      {
        handleKey: "gltf:mesh:2:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:2:primitive:0",
        meshIndex: 2,
        primitiveIndex: 0,
        mesh: aperture.createConeMeshAsset({
          label: "GltfSceneCone",
          radius: 0.62,
          height: 1.2,
          radialSegments: 4,
        }),
      },
    ],
    diagnostics: [],
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message, extra = {}) {
  return {
    example: "gltf-scene",
    ok: false,
    phase: "initialize",
    reason,
    message,
    ...extra,
  };
}
