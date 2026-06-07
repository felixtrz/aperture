import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  outdoorAreaLight,
  outdoorShadowIntent,
  registerOutdoorSceneAssets,
} from "./outdoor-scene-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const shadowReceiverToggle = document.querySelector("#shadow-receiver-toggle");
const shadowCasterToggle = document.querySelector("#shadow-caster-toggle");
const areaLightToggle = document.querySelector("#area-light-toggle");
const exampleParams = new URLSearchParams(globalThis.location.search);
const sceneControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
  areaLightEnabled: !exampleParams.has("disable-area-light"),
  iblEnabled: !exampleParams.has("disable-ibl"),
};
const stopAfterReady = exampleParams.has("stop-after-ready");

let shadowDepthTextureResourceReport = null;

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
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
      const scene = createPresentationScene(
        aperture,
        created.app,
        sourceAssets,
        canvas,
      );

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "outdoor-scene-failed",
      error instanceof Error ? error.message : "Outdoor scene example failed.",
    ),
  );
}

function createPresentationScene(aperture, app, sourceAssets, targetCanvas) {
  const assets = registerOutdoorSceneAssets(aperture, sourceAssets);
  const environmentAssetInputs = createOutdoorEnvironmentAssetInputs(
    assets.environmentMap,
  );
  const environmentAssets = aperture.prepareWebGpuAppEnvironmentAssets({
    app,
    assets: environmentAssetInputs,
    activeHandle: assets.environmentMap,
  });

  setupControls(sceneControls);

  return {
    canvas: targetCanvas,
    receiverMeshKeys: assets.receiverMeshKeys,
    casterMeshKeys: assets.casterMeshKeys,
    controls: sceneControls,
    areaLight: outdoorAreaLight,
    environmentMap: assets.environmentMap,
    environmentAssetInputs,
    environmentAssets,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/outdoor-scene.worker.js",
    {
      name: "aperture-outdoor-scene-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    standardMaterialShadowReceiverResources: null,
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
      width: canvas?.width ?? 1280,
      height: canvas?.height ?? 720,
    },
    areaLightEnabled: scene.controls.areaLightEnabled,
  });
  globalThis.__APERTURE_STOP_EXAMPLE__ = () => {
    loop.workerReady = false;
    worker.terminate();
  };
  window.__APERTURE_STOP_EXAMPLE__ = globalThis.__APERTURE_STOP_EXAMPLE__;
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
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame,
    clearColor,
    label: "outdoor-scene-app",
    ...(scene.controls.iblEnabled && scene.environmentAssets.active !== null
      ? {
          standardMaterialIblResources:
            scene.environmentAssets.active.standardMaterialIblResources,
        }
      : {}),
    ...(!scene.controls.receiverEnabled ||
    loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
  });
  const nextFrameResources = await publishFrameStatus(
    aperture,
    app,
    scene,
    loop,
    message.workerStep,
    report,
    message.frame,
  );

  loop.standardMaterialShadowReceiverResources =
    nextFrameResources.standardMaterialShadowReceiverResources;
  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

async function publishFrameStatus(
  aperture,
  app,
  scene,
  loop,
  step,
  report,
  frame,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowFrame = await createOutdoorShadowFrame({
    aperture,
    app,
    report,
    reportJson,
    scene,
    appEnvironmentResourceCache,
  });
  const renderingSupported =
    scene.controls.receiverEnabled &&
    scene.controls.casterEnabled &&
    shadowFrame.commandBufferSubmissionReport.status === "submitted" &&
    shadowFrame.route !== null;
  const standardResources = report.resources?.resources?.standard?.[0] ?? null;

  publishStatus({
    example: "outdoor-scene",
    ok: report.ok,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    frame,
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    scene: {
      receiverMeshKeys: scene.receiverMeshKeys,
      casterMeshKeys: scene.casterMeshKeys,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step?.diagnostics ?? 0,
    },
    areaLight: {
      enabled: scene.controls.areaLightEnabled,
      kind: "rect-area",
      width: scene.areaLight.width,
      height: scene.areaLight.height,
      intensity: scene.areaLight.intensity,
      submitted: report.snapshot.lights.some(
        (light) => light.kind === "rect-area",
      ),
      lightGpuBuffers:
        standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
    },
    environment: {
      enabled: scene.controls.iblEnabled,
      activeKey: scene.environmentAssets.activeEnvironmentMapResourceKey,
      ready: scene.environmentAssets.active?.ready ?? false,
      diffuseTextureStatus:
        scene.environmentAssets.active?.diffuseTextureResource.status ?? null,
      specularTextureStatus:
        scene.environmentAssets.active?.specularTextureResource.status ?? null,
      samplerStatus:
        scene.environmentAssets.active?.samplerResources.status ?? null,
      bindGroupStatus:
        scene.environmentAssets.active?.bindGroupResource.status ?? null,
    },
    shadow: {
      controls: {
        receiverEnabled: scene.controls.receiverEnabled,
        casterEnabled: scene.controls.casterEnabled,
      },
      intent: {
        ...outdoorShadowIntent,
        kind: "directional",
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        cascadeCount: request.cascadeCount ?? 1,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      descriptor: shadowFrame.descriptor,
      textures: shadowFrame.textures,
      depthTextureResources: shadowFrame.depthTextureResources,
      samplerResource: shadowFrame.samplerResource,
      passPlan: shadowFrame.passPlan,
      passAttachments: shadowFrame.passAttachments,
      viewProjection: shadowFrame.viewProjection,
      matrixComputation: shadowFrame.matrixComputation,
      matrixBuffer: shadowFrame.matrixBuffer,
      matrixBufferResource: shadowFrame.matrixBufferResource,
      casterDrawList: shadowFrame.casterDrawList,
      commandPlan: shadowFrame.commandPlan,
      commandEncoding: shadowFrame.commandEncoding,
      pipelineDescriptor: shadowFrame.pipelineDescriptor,
      pipelineResource: shadowFrame.pipelineResource,
      matrixBindGroupResource: shadowFrame.matrixBindGroupResource,
      frameResources: shadowFrame.frameResources,
      commandRecords: shadowFrame.commandRecords,
      encoderAssembly: shadowFrame.encoderAssembly,
      commandBufferSubmission: shadowFrame.commandBufferSubmission,
      rendering: {
        supported: renderingSupported,
        mode: scene.controls.iblEnabled
          ? "directional-csm-depth-array-plus-ibl"
          : "directional-csm-depth-array-compare",
        cascadeCount: outdoorShadowIntent.cascadeCount,
        pipelineKey: shadowFrame.route?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      cascadedShadowRoute: shadowFrame.route,
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
    report: reportJson,
  });
  if (stopAfterReady && renderingSupported) {
    globalThis.__APERTURE_STOP_EXAMPLE__?.();
  }

  return {
    standardMaterialShadowReceiverResources:
      scene.controls.receiverEnabled && shadowFrame.receiverResources
        ? shadowFrame.receiverResources
        : null,
  };
}

function createOutdoorEnvironmentAssetInputs(environmentMap) {
  return [
    {
      handle: environmentMap,
      label: "outdoor-scene-sky-ibl",
      version: "outdoor-v1",
      diffuseResourceKey: "texture:outdoor-scene-sky-ibl:diffuse",
      specularResourceKey: "texture:outdoor-scene-sky-ibl:specular",
      diffuseSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [120, 174, 236, 255],
          [82, 132, 210, 255],
          [226, 244, 255, 255],
          [34, 58, 92, 255],
          [156, 206, 246, 255],
          [68, 108, 178, 255],
        ]),
        format: "rgba8unorm",
      },
      specularPmremSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [150, 198, 255, 255],
          [94, 148, 232, 255],
          [244, 252, 255, 255],
          [44, 70, 108, 255],
          [176, 222, 255, 255],
          [82, 126, 198, 255],
        ]),
        format: "rgba8unorm",
        mipLevelCount: 3,
      },
      standardMaterialCount: 1,
    },
  ];
}

function cubeFaces(faceSize, colors) {
  return colors.map((color, face) => {
    const data = new Uint8Array(faceSize * faceSize * 4);

    for (let index = 0; index < data.length; index += 4) {
      const shade = 1 - face * 0.025;

      data[index] = Math.round(color[0] * shade);
      data[index + 1] = Math.round(color[1] * shade);
      data[index + 2] = Math.round(color[2] * shade);
      data[index + 3] = color[3];
    }

    return data;
  });
}

async function createOutdoorShadowFrame(input) {
  const {
    aperture,
    app,
    report,
    reportJson,
    scene,
    appEnvironmentResourceCache,
  } = input;
  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === "directional",
  );
  const descriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: outdoorShadowIntent.mapSize,
        depthBias: outdoorShadowIntent.depthBias,
        normalBias: outdoorShadowIntent.normalBias,
        cascadeCount: outdoorShadowIntent.cascadeCount,
        viewDimension: "2d-array",
        resourceKey: outdoorShadowIntent.key,
      })),
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({
      descriptors: descriptor,
    }),
  );

  shadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });

  const depthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:outdoor-scene",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const samplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests,
      textures: shadowTextures,
      submission: "ready",
    }),
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      aperture.createShadowPassAttachmentDescriptorReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const viewProjection =
    aperture.directionalShadowViewProjectionPlanReportToJsonValue(
      aperture.createDirectionalShadowViewProjectionPlanReport({
        shadowRequests,
        lights: report.snapshot.lights,
        shadowPassPlan,
        computation: "ready",
      }),
    );
  const matrixComputation =
    aperture.directionalShadowMatrixComputationReportToJsonValue(
      aperture.createDirectionalShadowMatrixComputationReport({
        viewProjection,
        transforms: report.snapshot.transforms,
        center: outdoorShadowIntent.center,
        orthographicSize: outdoorShadowIntent.orthographicSize,
      }),
    );
  const matrixBuffer = aperture.shadowMatrixBufferDescriptorReportToJsonValue(
    aperture.createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
      resourceKey: "shadow-matrix-buffer:outdoor-scene",
      label: "OutdoorSceneShadowMatrices/storage",
    }),
  );
  const matrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: matrixBuffer,
      matrices: matrixComputation,
    });
  const matrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      matrixBufferResourceReport,
    );
  const casterMeshKeys = new Set(scene.casterMeshKeys);
  const shadowCasterMeshDraws = scene.controls.casterEnabled
    ? report.snapshot.meshDraws.filter((draw) =>
        casterMeshKeys.has(draw.sortKey.meshKey),
      )
    : [];
  const casterDrawList = aperture.shadowCasterDrawListPlanReportToJsonValue(
    aperture.createShadowCasterDrawListPlanReport({
      shadowRequests,
      meshDraws: shadowCasterMeshDraws,
      shadowPassPlan,
      commandEncoding: "ready",
    }),
  );
  const commandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection,
        matrixBuffer,
        casterDrawList,
        commandEncoding: "ready",
      }),
    );
  const commandEncoding = aperture.shadowPassCommandEncodingReportToJsonValue(
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: shadowDepthTextureResourceReport,
      matrixBufferResource: matrixBufferResourceReport,
      casterDrawList,
      commandPlan,
      commandEncoding: "ready",
    }),
  );
  const pipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding,
      }),
    );
  const pipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: pipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const pipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      pipelineResourceReport,
    );
  const matrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: matrixBufferResourceReport,
      layout: pipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const matrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      matrixBindGroupResourceReport,
    );
  const casterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const frameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList,
        preparedMeshes: casterMeshViews.preparedMeshes,
        matrixBufferResource: matrixBufferResourceReport,
        pipelineDescriptor,
      }),
    );
  const commandRecordPlan = aperture.createShadowCasterCommandRecordPlanReport({
    frameResources,
    commandPlan,
    pipelines:
      pipelineResourceReport.resource === null
        ? []
        : [
            {
              pipelineKey: pipelineResourceReport.resource.pipelineKey,
              resourceKey: pipelineResourceReport.resource.resourceKey,
              pipeline: pipelineResourceReport.resource.pipeline,
            },
          ],
    matrixBindGroups:
      matrixBindGroupResourceReport.resource === null
        ? []
        : [
            {
              matrixResourceKey:
                matrixBindGroupResourceReport.resource.matrixResourceKey,
              resourceKey: matrixBindGroupResourceReport.resource.resourceKey,
              group: matrixBindGroupResourceReport.resource.group,
              bindGroup: matrixBindGroupResourceReport.resource.bindGroup,
            },
          ],
    meshes: casterMeshViews.executableMeshes,
  });
  const commandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(commandRecordPlan);
  const encoderResource = aperture.createCommandEncoderResource({
    device: app.initialization.device,
    label: "shadow-pass:outdoor-scene",
  });
  const encoderAssemblyReport = aperture.createShadowPassEncoderAssemblyReport({
    attachments: shadowPassAttachments,
    frameResources,
    commandEncoding,
    commands: commandRecordPlan.commandRecords,
    encoder: encoderResource.resource?.encoder,
    resolveDepthView: (attachment) =>
      aperture.resolveShadowDepthTextureAttachmentView(
        shadowDepthTextureResourceReport,
        attachment,
      ),
  });
  const encoderAssembly = aperture.shadowPassEncoderAssemblyReportToJsonValue(
    encoderAssemblyReport,
  );
  const commandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: encoderAssemblyReport,
      encoder: encoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:outdoor-scene",
      submit: scene.controls.casterEnabled,
    });
  const commandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      commandBufferSubmissionReport,
    );
  const route = findCascadedShadowRoute(reportJson);
  const receiverResources =
    matrixBufferResourceReport.resource !== null &&
    shadowDepthTextureResourceReport.resources.some(
      (resource) => resource.allocation.resource !== null,
    ) &&
    shadowSamplerResourceReport.resource !== null
      ? {
          shadowKind: "directional-cascaded",
          matrixBufferResource: matrixBufferResourceReport,
          depthTextureResources: shadowDepthTextureResourceReport,
          samplerResource: shadowSamplerResourceReport,
        }
      : null;

  return {
    descriptor,
    textures: shadowTextures,
    depthTextureResources,
    samplerResource,
    passPlan: shadowPassPlan,
    passAttachments: shadowPassAttachments,
    viewProjection,
    matrixComputation,
    matrixBuffer,
    matrixBufferResource,
    casterDrawList,
    commandPlan,
    commandEncoding,
    pipelineDescriptor,
    pipelineResource,
    matrixBindGroupResource,
    frameResources,
    commandRecords,
    encoderAssembly,
    commandBufferSubmission,
    commandBufferSubmissionReport,
    route,
    receiverResources,
  };
}

function setupControls(controls) {
  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = controls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      controls.receiverEnabled = shadowReceiverToggle.checked;
    });
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = controls.casterEnabled;
    shadowCasterToggle.addEventListener("change", () => {
      controls.casterEnabled = shadowCasterToggle.checked;
    });
  }

  if (areaLightToggle instanceof HTMLInputElement) {
    areaLightToggle.checked = controls.areaLightEnabled;
    areaLightToggle.addEventListener("change", () => {
      const nextParams = new URLSearchParams(globalThis.location.search);

      if (areaLightToggle.checked) {
        nextParams.delete("disable-area-light");
      } else {
        nextParams.set("disable-area-light", "1");
      }

      globalThis.location.search = nextParams.toString();
    });
  }
}

function findCascadedShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find((pipeline) =>
      pipeline.pipelineKey.includes("cascadedShadowMap"),
    ) ?? null
  );
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

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? (status.phase ?? "ready") : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message, extra = {}) {
  return {
    example: "outdoor-scene",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
