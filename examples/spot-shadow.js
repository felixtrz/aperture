import { createExampleWebGpuApp } from "./example-renderer-app.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const shadowReceiverToggle = document.querySelector("#shadow-receiver-toggle");
const shadowCasterToggle = document.querySelector("#shadow-caster-toggle");
const exampleParams = new URLSearchParams(globalThis.location.search);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
};

const clearColor = [0.014, 0.019, 0.026, 1];
const shadowIntent = {
  key: "spot-shadow:2d:0",
  mapSize: 512,
  depthBias: 0.002,
  normalBias: 0.01,
};
let shadowDepthTextureResourceReport = null;

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await createExampleWebGpuApp(aperture, {
      canvas,
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas);

      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "spot-shadow-failed",
      error instanceof Error ? error.message : "Spot shadow example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpotShadowReceiverWall",
      width: 4.2,
      height: 2.6,
      depth: 0.06,
    }),
    { id: "spot-shadow-wall" },
  );
  const cubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpotShadowCasterCube",
      width: 0.9,
      height: 0.9,
      depth: 0.9,
    }),
    { id: "spot-shadow-cube" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpotShadowReceiverStandard",
      baseColorFactor: new Float32Array([0.9, 0.94, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.74,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "spot-shadow-wall-standard" },
  );
  const cubeMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpotShadowCasterStandard",
      baseColorFactor: new Float32Array([1.0, 0.54, 0.24, 1]),
      metallicFactor: 0.12,
      roughnessFactor: 0.42,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "spot-shadow-cube-standard" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0.05, 5.4] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, -0.95] }),
    aperture.withMesh(wallMesh),
    aperture.withMaterial(wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, -0.02, 0.03] }),
    aperture.withMesh(cubeMesh),
    aperture.withMaterial(cubeMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.5, 0.56, 1],
      intensity: 0.16,
      layerMask: 1,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 1.05, 2.15] }),
    aperture.withLight({
      kind: aperture.LightKind.Spot,
      color: [1, 0.94, 0.82, 1],
      intensity: 58,
      range: 7,
      innerConeAngle: 0.22,
      outerConeAngle: 0.5,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    cubeMeshKey: aperture.assetHandleKey(cubeMesh),
    wallMeshKey: aperture.assetHandleKey(wallMesh),
    cubeMaterialKey: aperture.assetHandleKey(cubeMaterial),
    wallMaterialKey: aperture.assetHandleKey(wallMaterial),
    shadowControls,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;
  let standardMaterialShadowReceiverResources = null;

  const render = async () => {
    frame += 1;
    const step = app.step(0, frame / 60);
    const report = await app.render({
      frame,
      clearColor,
      label: "spot-shadow-app",
      ...(!scene.shadowControls.receiverEnabled ||
      standardMaterialShadowReceiverResources === null
        ? {}
        : { standardMaterialShadowReceiverResources }),
    });
    const nextFrameResources = await publishFrameStatus(
      aperture,
      app,
      scene,
      step,
      report,
      frame,
    );

    standardMaterialShadowReceiverResources =
      nextFrameResources.standardMaterialShadowReceiverResources;
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

async function publishFrameStatus(aperture, app, scene, step, report, frame) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests: report.snapshot.shadowRequests,
      descriptors: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
        faceCount: 1,
        viewDimension: "2d",
      })),
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
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:spot",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowSamplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests: report.snapshot.shadowRequests,
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
  const shadowViewProjection =
    aperture.spotShadowViewProjectionPlanReportToJsonValue(
      aperture.createSpotShadowViewProjectionPlanReport({
        shadowRequests: report.snapshot.shadowRequests,
        lights: report.snapshot.lights,
        shadowPassPlan,
        computation: "ready",
      }),
    );
  const shadowMatrixComputation =
    aperture.spotShadowMatrixComputationReportToJsonValue(
      aperture.createSpotShadowMatrixComputationReport({
        viewProjection: shadowViewProjection,
        transforms: report.snapshot.transforms,
      }),
    );
  const shadowMatrixBuffer =
    aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      aperture.createShadowMatrixBufferDescriptorReport({
        viewProjection: shadowViewProjection,
        upload: "ready",
        resourceKey: "shadow-matrix-buffer:spot",
        label: "SpotShadowMatrices/storage",
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
  const shadowCasterMeshDraws = scene.shadowControls.casterEnabled
    ? report.snapshot.meshDraws.filter(
        (draw) => draw.sortKey.meshKey === scene.cubeMeshKey,
      )
    : [];
  const shadowCasterDrawList =
    aperture.shadowCasterDrawListPlanReportToJsonValue(
      aperture.createShadowCasterDrawListPlanReport({
        shadowRequests: report.snapshot.shadowRequests,
        meshDraws: shadowCasterMeshDraws,
        shadowPassPlan,
        commandEncoding: "ready",
      }),
    );
  const shadowCommandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection: shadowViewProjection,
        matrixBuffer: shadowMatrixBuffer,
        casterDrawList: shadowCasterDrawList,
        commandEncoding: "ready",
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
        commandEncoding: "ready",
      }),
    );
  const shadowCasterPipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding: shadowPassCommandEncoding,
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
  const shadowCasterFrameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList: shadowCasterDrawList,
        preparedMeshes: createShadowCasterPreparedMeshViews(report),
        matrixBufferResource: shadowMatrixBufferResourceReport,
        pipelineDescriptor: shadowCasterPipelineDescriptor,
      }),
    );
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: shadowCasterFrameResources,
      commandPlan: shadowCommandPlan,
      pipelines:
        shadowCasterPipelineResourceReport.resource === null
          ? []
          : [
              {
                pipelineKey:
                  shadowCasterPipelineResourceReport.resource.pipelineKey,
                resourceKey:
                  shadowCasterPipelineResourceReport.resource.resourceKey,
                pipeline: shadowCasterPipelineResourceReport.resource.pipeline,
              },
            ],
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
      meshes: createShadowCasterExecutableMeshViews(report),
    });
  const shadowCasterCommandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowCasterCommandRecordPlan,
    );
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:spot",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: shadowPassAttachments,
      frameResources: shadowCasterFrameResources,
      commandEncoding: shadowPassCommandEncoding,
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        resolveSpotShadowDepthView(
          shadowDepthTextureResourceReport,
          attachment,
        ),
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
      label: "shadow-pass:spot",
      submit: scene.shadowControls.casterEnabled,
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
  const spotShadowRoute = findSpotShadowRoute(reportJson);
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    scene.shadowControls.casterEnabled &&
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    spotShadowRoute !== null;

  publishStatus({
    example: "spot-shadow",
    ok: report.ok,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    frame,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    scene: {
      cubeMeshKey: scene.cubeMeshKey,
      wallMeshKey: scene.wallMeshKey,
      cubeMaterialKey: scene.cubeMaterialKey,
      wallMaterialKey: scene.wallMaterialKey,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step.transform.diagnostics.length,
    },
    shadow: {
      controls: {
        receiverEnabled: scene.shadowControls.receiverEnabled,
        casterEnabled: scene.shadowControls.casterEnabled,
      },
      intent: {
        ...shadowIntent,
        kind: "spot",
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      descriptor: shadowDescriptor,
      textures: shadowTextures,
      depthTextureResources: shadowDepthTextureResources,
      samplerResource: shadowSamplerResource,
      passPlan: shadowPassPlan,
      passAttachments: shadowPassAttachments,
      viewProjection: shadowViewProjection,
      matrixComputation: shadowMatrixComputation,
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
      rendering: {
        supported: renderingSupported,
        mode: "spot-depth-compare",
        faceCount: shadowPassPlan.passCount,
        pipelineKey: spotShadowRoute?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      spotShadowRoute,
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

  return {
    standardMaterialShadowReceiverResources: {
      shadowKind: "spot",
      matrixBufferResource: shadowMatrixBufferResourceReport,
      depthTextureResources: shadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
    },
  };
}

function setupShadowControls(controls) {
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
}

function createShadowCasterPreparedMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    });
  }

  return [...meshResourceByKey.values()];
}

function createShadowCasterExecutableMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    });
  }

  return [...meshResourceByKey.values()];
}

function resolveSpotShadowDepthView(depthTextureResourceReport, attachment) {
  for (const resource of depthTextureResourceReport.resources) {
    if (
      resource.shadowId !== attachment.shadowId ||
      resource.lightId !== attachment.lightId
    ) {
      continue;
    }

    const attachmentView = resource.attachmentViews.find(
      (view) => view.viewKey === attachment.viewKey,
    );

    if (attachmentView !== undefined) {
      return attachmentView.view;
    }
  }

  return null;
}

function findSpotShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find((pipeline) => pipeline.pipelineKey.includes("shadowMap")) ??
    null
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
    example: "spot-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
