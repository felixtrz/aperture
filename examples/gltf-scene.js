const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

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
  const root = createGltfSceneRoot();
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
    aperture.withTransform(),
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
    registration,
    replay,
    root,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;

  const render = async () => {
    frame += 1;
    const step = app.step(0, frame / 60);
    const report = await app.render({
      frame,
      clearColor,
      label: "gltf-scene-app",
    });

    publishFrameStatus(aperture, app, scene, step, report, frame);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

function publishFrameStatus(aperture, app, scene, step, report, frame) {
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
  const standardMaterialIblBindGroupResource =
    aperture.standardMaterialIblBindGroupResourceReportToJsonValue(
      aperture.createStandardMaterialIblBindGroupResourceReport({
        device: app.initialization.device,
        standardMaterialCount,
        descriptor: standardMaterialIblBindGroupDescriptor,
        diffuseTextureResource: diffuseIblTextureResourceReport,
        specularTextureResource: specularIblTextureResourceReport,
        samplers: iblSamplerResourceReport,
        cache: environmentResourceCache.standardIblBindGroups,
      }),
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
      label: "shadow-pass:directional",
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
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
      shaderBinding: standardMaterialIblShadowBinding,
      pipelineKey: standardMaterialIblShadowPipelineKey,
      standardMaterial: standardMaterialIbl,
      sampling: {
        supported: false,
        diagnostic: {
          code: "gltfScene.iblSamplingDeferred",
          severity: "warning",
          message:
            "GLTF scene environment map is extracted and resource-ready, but StandardMaterial IBL shader sampling is not implemented yet.",
        },
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
    shaderBinding: normalizeStatus(
      input.standardMaterialIblShadowBinding.status,
    ),
    pipelineKey: input.standardMaterialIblShadowPipelineKey.status,
    shaderSampling: "deferred",
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

function createGltfSceneRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0, translation: [-1.45, -0.15, 0] },
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
