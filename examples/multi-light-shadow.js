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
  mapSize: 512,
  directional: { key: "multi-shadow:directional:0", depthBias: 0.002 },
  spot: { key: "multi-shadow:spot:0", depthBias: 0.002 },
  point: { key: "multi-shadow:point:0", depthBias: 0.0001 },
  normalBias: 0.01,
};
const shadowDepthTextureReports = new Map();

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
      worldOptions: { entityCapacity: 24 },
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
      "multi-light-shadow-failed",
      error instanceof Error
        ? error.message
        : "Multi-light shadow example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "MultiShadowReceiverWall",
      width: 5.8,
      height: 2.8,
      depth: 0.06,
    }),
    { id: "multi-shadow-wall" },
  );
  const directionalCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DirectionalShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-directional-cube" },
  );
  const spotCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpotShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-spot-cube" },
  );
  const pointCubeMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "PointShadowCasterCube",
      width: 0.55,
      height: 0.55,
      depth: 0.55,
    }),
    { id: "multi-shadow-point-cube" },
  );
  const wallMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "MultiShadowReceiverStandard",
      baseColorFactor: new Float32Array([0.9, 0.94, 0.86, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.76,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-wall-standard" },
  );
  const directionalMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DirectionalShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.55, 0.34, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.45,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-directional-standard" },
  );
  const spotMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "SpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.35, 0.74, 1.0, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.48,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-spot-standard" },
  );
  const pointMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "PointShadowCasterStandard",
      baseColorFactor: new Float32Array([1.0, 0.8, 0.32, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.42,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "multi-shadow-point-standard" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0.08, 5.6] }),
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
    aperture.withTransform({ translation: [-1.45, -0.1, 0.05] }),
    aperture.withMesh(directionalCubeMesh),
    aperture.withMaterial(directionalMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, -0.02, 0.1] }),
    aperture.withMesh(spotCubeMesh),
    aperture.withMaterial(spotMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.45, -0.08, 0.05] }),
    aperture.withMesh(pointCubeMesh),
    aperture.withMaterial(pointMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.5, 0.56, 1],
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0, -0.258819, 0, 0.965926] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.45,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.directional.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 1.18, 2.15] }),
    aperture.withLight({
      kind: aperture.LightKind.Spot,
      color: [0.76, 0.9, 1, 1],
      intensity: 36,
      range: 7,
      innerConeAngle: 0.22,
      outerConeAngle: 0.5,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.spot.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.0, 1.05, 2.2] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.9, 0.7, 1],
      intensity: 40,
      range: 7,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.point.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    wallMeshKey: aperture.assetHandleKey(wallMesh),
    casterMeshKeys: {
      directional: aperture.assetHandleKey(directionalCubeMesh),
      spot: aperture.assetHandleKey(spotCubeMesh),
      point: aperture.assetHandleKey(pointCubeMesh),
    },
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
      label: "multi-light-shadow-app",
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
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const bundles = {
    directional: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "directional",
      casterMeshKey: scene.casterMeshKeys.directional,
      intent: shadowIntent.directional,
      appEnvironmentResourceCache,
    }),
    spot: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "spot",
      casterMeshKey: scene.casterMeshKeys.spot,
      intent: shadowIntent.spot,
      appEnvironmentResourceCache,
    }),
    point: await createShadowBundle({
      aperture,
      app,
      report,
      scene,
      kind: "point",
      casterMeshKey: scene.casterMeshKeys.point,
      intent: shadowIntent.point,
      appEnvironmentResourceCache,
    }),
  };
  const multiShadowRoute = findMultiShadowRoute(reportJson);
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    scene.shadowControls.casterEnabled &&
    Object.values(bundles).every(
      (bundle) => bundle.commandBufferSubmissionReport.status === "submitted",
    ) &&
    multiShadowRoute !== null;

  publishStatus({
    example: "multi-light-shadow",
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
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      bundles: shadowBundleStatus(bundles),
      rendering: {
        supported: renderingSupported,
        mode: "directional-spot-point-depth-compare",
        pipelineKey: multiShadowRoute?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      multiShadowRoute,
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
    standardMaterialShadowReceiverResources:
      scene.shadowControls.receiverEnabled &&
      bundles.directional.receiverResources !== null &&
      bundles.spot.receiverResources !== null &&
      bundles.point.receiverResources !== null
        ? {
            shadowKind: "multi",
            ...bundles.directional.receiverResources,
            spotShadowReceiverResources: bundles.spot.receiverResources,
            pointShadowReceiverResources: bundles.point.receiverResources,
          }
        : null,
  };
}

async function createShadowBundle(input) {
  const { aperture, app, report, scene, kind, intent } = input;
  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === kind,
  );
  const descriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: intent.depthBias,
        normalBias: shadowIntent.normalBias,
        faceCount: kind === "point" ? 6 : 1,
        viewDimension: kind === "point" ? "cube" : "2d",
        resourceKey: intent.key,
      })),
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({ descriptors: descriptor }),
  );
  const cacheKey = `${kind}:${shadowIntent.mapSize}`;

  if (!shadowDepthTextureReports.has(cacheKey)) {
    shadowDepthTextureReports.set(
      cacheKey,
      aperture.createShadowDepthTextureResourceReport({
        device: app.initialization.device,
        textures: shadowTextures,
      }),
    );
  }

  const shadowDepthTextureResourceReport =
    shadowDepthTextureReports.get(cacheKey);
  const depthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: `shadow-sampler:${kind}`,
      cache: input.appEnvironmentResourceCache.shadowSamplers,
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
  const viewProjection = createViewProjection(aperture, kind, {
    shadowRequests,
    lights: report.snapshot.lights,
    shadowPassPlan,
  });
  const matrixComputation = createMatrixComputation(aperture, kind, {
    viewProjection,
    transforms: report.snapshot.transforms,
  });
  const matrixBuffer = aperture.shadowMatrixBufferDescriptorReportToJsonValue(
    aperture.createShadowMatrixBufferDescriptorReport({
      viewProjection,
      upload: "ready",
      resourceKey: `shadow-matrix-buffer:${kind}`,
      label: `${kind}ShadowMatrices/storage`,
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
  const shadowCasterMeshDraws = scene.shadowControls.casterEnabled
    ? report.snapshot.meshDraws.filter(
        (draw) => draw.sortKey.meshKey === input.casterMeshKey,
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
      cache: input.appEnvironmentResourceCache.shadowCasterPipelines,
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
      cache: input.appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const matrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      matrixBindGroupResourceReport,
    );
  const frameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList,
        preparedMeshes: createShadowCasterPreparedMeshViews(report),
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
    meshes: createShadowCasterExecutableMeshViews(report),
  });
  const commandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(commandRecordPlan);
  const encoderResource = aperture.createCommandEncoderResource({
    device: app.initialization.device,
    label: `shadow-pass:${kind}`,
  });
  const encoderAssemblyReport = aperture.createShadowPassEncoderAssemblyReport({
    attachments: shadowPassAttachments,
    frameResources,
    commandEncoding,
    commands: commandRecordPlan.commandRecords,
    encoder: encoderResource.resource?.encoder,
    resolveDepthView: (attachment) =>
      resolveShadowDepthView(shadowDepthTextureResourceReport, attachment),
  });
  const encoderAssembly = aperture.shadowPassEncoderAssemblyReportToJsonValue(
    encoderAssemblyReport,
  );
  const commandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: encoderAssemblyReport,
      encoder: encoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: `shadow-pass:${kind}`,
      submit: scene.shadowControls.casterEnabled,
    });
  const commandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      commandBufferSubmissionReport,
    );

  return {
    kind,
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
    receiverResources:
      matrixBufferResourceReport.resource !== null &&
      shadowDepthTextureResourceReport.resources.some(
        (resource) => resource.allocation.resource !== null,
      ) &&
      shadowSamplerResourceReport.resource !== null
        ? {
            matrixBufferResource: matrixBufferResourceReport,
            depthTextureResources: shadowDepthTextureResourceReport,
            samplerResource: shadowSamplerResourceReport,
          }
        : null,
  };
}

function createViewProjection(aperture, kind, input) {
  if (kind === "point") {
    return aperture.pointShadowViewProjectionPlanReportToJsonValue(
      aperture.createPointShadowViewProjectionPlanReport({
        ...input,
        computation: "ready",
      }),
    );
  }

  if (kind === "spot") {
    return aperture.spotShadowViewProjectionPlanReportToJsonValue(
      aperture.createSpotShadowViewProjectionPlanReport({
        ...input,
        computation: "ready",
      }),
    );
  }

  return aperture.directionalShadowViewProjectionPlanReportToJsonValue(
    aperture.createDirectionalShadowViewProjectionPlanReport({
      ...input,
      computation: "ready",
    }),
  );
}

function createMatrixComputation(aperture, kind, input) {
  if (kind === "point") {
    return aperture.pointShadowMatrixComputationReportToJsonValue(
      aperture.createPointShadowMatrixComputationReport(input),
    );
  }

  if (kind === "spot") {
    return aperture.spotShadowMatrixComputationReportToJsonValue(
      aperture.createSpotShadowMatrixComputationReport(input),
    );
  }

  return aperture.directionalShadowMatrixComputationReportToJsonValue(
    aperture.createDirectionalShadowMatrixComputationReport(input),
  );
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

function resolveShadowDepthView(depthTextureResourceReport, attachment) {
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

    return resource.allocation.resource?.view ?? null;
  }

  return null;
}

function shadowBundleStatus(bundles) {
  return Object.fromEntries(
    Object.entries(bundles).map(([kind, bundle]) => [
      kind,
      {
        descriptor: bundle.descriptor,
        depthTextureResources: bundle.depthTextureResources,
        samplerResource: bundle.samplerResource,
        passPlan: bundle.passPlan,
        viewProjection: bundle.viewProjection,
        matrixComputation: bundle.matrixComputation,
        matrixBufferResource: bundle.matrixBufferResource,
        casterDrawList: bundle.casterDrawList,
        commandEncoding: bundle.commandEncoding,
        pipelineResource: bundle.pipelineResource,
        frameResources: bundle.frameResources,
        encoderAssembly: bundle.encoderAssembly,
        commandBufferSubmission: bundle.commandBufferSubmission,
      },
    ]),
  );
}

function findMultiShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find(
      (pipeline) =>
        pipeline.pipelineKey.includes("shadowMap") &&
        pipeline.pipelineKey.includes("pointShadowMap"),
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
    example: "multi-light-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
