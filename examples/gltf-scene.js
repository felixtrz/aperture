const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exampleParams = new URLSearchParams(globalThis.location.search);
const enableShadowReceiver = !exampleParams.has("disable-shadow-receiver");
const enableIblSampling = !exampleParams.has("disable-ibl-sampling");
const enableSpecularIblSampling = !exampleParams.has(
  "disable-specular-ibl-sampling",
);

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
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 32 },
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
      "gltf-scene-failed",
      error instanceof Error ? error.message : "GLTF scene example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const glbFixture = createGltfSceneGlbFixture(aperture);
  const root = glbFixture.root;
  const meshConstruction = createMeshConstructionReport(aperture);
  const environmentHandle = aperture.createEnvironmentMapHandle(
    "gltf:environment:studio",
  );

  app.assets.register(environmentHandle, { label: "GltfSceneStudioIBL" });
  app.assets.markReady(environmentHandle, {
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
    registry: app.assets,
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

  const replay = aperture.replayGltfEcsAuthoringCommands({
    world: app.world,
    plan: contract.ecsCommandPlan,
  });

  app.spawn(
    aperture.withTransform({ translation: [0, 0.2, 5.2] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: cameraIntent.near,
      far: cameraIntent.far,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.42, 0.48, 0.58, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0, -0.258819, 0, 0.965926] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: directLightIntent.intensity,
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
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: environmentIntent.intensity,
      layerMask: 1,
      environmentMap: environmentHandle,
    }),
  );

  return {
    canvas: targetCanvas,
    contract,
    environmentHandle,
    glbFixture: glbFixture.status,
    registration,
    replay,
    root,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;
  let standardMaterialShadowReceiverResources = null;
  let standardMaterialIblResources = null;

  const render = async () => {
    frame += 1;
    const step = app.step(0, frame / 60);
    const report = await app.render({
      frame,
      clearColor,
      label: "gltf-scene-app",
      ...(!enableShadowReceiver ||
      standardMaterialShadowReceiverResources === null
        ? {}
        : { standardMaterialShadowReceiverResources }),
      ...(!enableIblSampling || standardMaterialIblResources === null
        ? {}
        : { standardMaterialIblResources }),
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
    standardMaterialIblResources =
      nextFrameResources.standardMaterialIblResources;
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

async function publishFrameStatus(aperture, app, scene, step, report, frame) {
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
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
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

  publishStatus({
    example: "gltf-scene",
    ok: report.ok && scene.contract.valid && scene.replay.valid,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    source: {
      glbFixture: scene.glbFixture,
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
      replay: {
        valid: scene.replay.valid,
        created: scene.replay.created.length,
        appliedComponents: scene.replay.appliedComponents.length,
        diagnostics: scene.replay.diagnostics.length,
      },
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step.transform.diagnostics.length,
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
        supported: false,
        diagnostic: {
          code: "gltfScene.shadowMapDeferred",
          severity: "warning",
          message:
            "GLTF scene shadow request is extracted, but shadow-map pass creation and StandardMaterial shadow sampling are not implemented yet.",
        },
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
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
    rendering: "deferred",
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
  const report = aperture.createGltfReportDrivenImportReportFromGlb({
    source,
  });
  const container = report.container.container;

  if (!report.valid || container === null || report.importReport === null) {
    throw new Error("GLTF scene GLB fixture did not produce a valid root.");
  }

  return {
    root: container.json,
    status: {
      valid: report.valid,
      byteLength: container.byteLength,
      chunks: container.chunks.map((chunk) => ({
        type: chunk.type,
        byteLength: chunk.byteLength,
      })),
      diagnostics: report.container.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
      })),
      importStages: report.importReport.orchestration.stages.map((stage) => ({
        stage: stage.stage,
        status: stage.status,
      })),
    },
  };
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
