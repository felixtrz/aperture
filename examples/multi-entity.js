import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  initializeWebGpuWithOptionalReadbackUsage,
  mapCurrentTextureReadbackSamples,
  markReadbackClearOk,
} from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const hiddenMaterialColor = [1, 0, 1, 1];
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "default";
const knownScenarioIds = [
  "default",
  "missing-resource",
  "missing-mesh-resource",
  "layer-mismatch",
  "missing-mesh-asset",
  "missing-material-asset",
  "loading-mesh-asset",
  "failed-mesh-asset",
  "loading-material-asset",
  "failed-material-asset",
  "missing-texture-asset",
  "missing-sampler-asset",
  "loading-texture-asset",
  "failed-texture-asset",
  "loading-sampler-asset",
  "failed-sampler-asset",
  "multi-textured-missing-texture-asset",
  "multi-textured-missing-sampler-asset",
  "shared-sampler-missing-texture-asset",
  "shared-sampler-missing-sampler-asset",
  "shared-texture-missing-texture-asset",
  "shared-texture-missing-sampler-asset",
  "shared-texture-missing-texture-sampler-assets",
  "missing-texture-sampler-resources",
  "invalid-texture-upload",
  "short-texture-upload",
  "invalid-texture-rows-per-image",
  "disabled-renderable",
  "disabled-visible-peer",
  "box-primitive",
  "sphere-primitive",
  "cylinder-primitive",
  "cone-primitive",
  "capsule-primitive",
  "torus-primitive",
  "perspective-fov-camera",
  "orthographic-camera",
  "directional-light-extraction",
  "ambient-light-extraction",
  "environment-light-extraction",
  "missing-environment-map",
  "loading-environment-map",
  "failed-environment-map",
  "malformed-environment-map",
  "environment-map-handle",
  "point-light-extraction",
  "spot-light-extraction",
  "missing-light-transform",
  "invalid-light-extraction",
  "directional-shadow-request",
  "invalid-shadow-settings",
  "unsupported-shadow-request",
  "render-layer-filter",
  "render-order-overlap",
  "depth-overlap",
  "textured-unlit",
  "sampler-filter-address",
  "textured-unlit-tint",
  "sampler-v-address",
  "multi-textured-unlit",
  "shared-sampler-multi-textured",
  "shared-texture-tinted-unlit",
  "shared-texture-missing-texture-resource",
  "shared-texture-missing-sampler-resource",
  "shared-texture-missing-texture-sampler-resources",
  "multi-textured-missing-texture-resource",
  "multi-textured-missing-sampler-resource",
  "multi-textured-missing-texture-sampler-resources",
  "shared-sampler-missing-sampler-resource",
  "shared-sampler-missing-texture-resource",
  "shared-sampler-missing-texture-sampler-resources",
  "mixed-unlit-pipelines",
];
const knownScenarios = new Set(knownScenarioIds);
const readbackSamplePoints = [
  { id: "left-upper", x: 0.31, y: 0.48 },
  { id: "left-center", x: 0.34, y: 0.5 },
  { id: "left-lower", x: 0.37, y: 0.52 },
  { id: "center-upper", x: 0.48, y: 0.48 },
  { id: "center", x: 0.5, y: 0.5 },
  { id: "center-lower", x: 0.52, y: 0.52 },
  { id: "right-upper", x: 0.63, y: 0.48 },
  { id: "right-center", x: 0.66, y: 0.5 },
  { id: "right-lower", x: 0.69, y: 0.52 },
];
const boxReadbackSamplePoints = [{ id: "center", x: 0.5, y: 0.5 }];

const baseStatus = {
  example: "ecs-multi-entity",
  scenario,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

const scenarioRenderers = {
  default: renderDefaultMultiEntityScenario,
  "missing-resource": renderStatusScene(renderMissingResourceScene),
  "missing-mesh-resource": renderStatusScene(renderMissingMeshResourceScene),
  "layer-mismatch": renderStatusScene(renderLayerMismatchScene),
  "missing-mesh-asset": renderStatusScene(renderMissingMeshAssetScene),
  "missing-material-asset": renderStatusScene(renderMissingMaterialAssetScene),
  "loading-mesh-asset": renderMeshAssetStatusScenario("loading"),
  "failed-mesh-asset": renderMeshAssetStatusScenario("failed"),
  "loading-material-asset": renderMaterialAssetStatusScenario("loading"),
  "failed-material-asset": renderMaterialAssetStatusScenario("failed"),
  "missing-texture-asset": renderTextureAssetStatusScenario(
    "texture",
    "missing",
  ),
  "missing-sampler-asset": renderTextureAssetStatusScenario(
    "sampler",
    "missing",
  ),
  "loading-texture-asset": renderTextureAssetStatusScenario(
    "texture",
    "loading",
  ),
  "failed-texture-asset": renderTextureAssetStatusScenario("texture", "failed"),
  "loading-sampler-asset": renderTextureAssetStatusScenario(
    "sampler",
    "loading",
  ),
  "failed-sampler-asset": renderTextureAssetStatusScenario("sampler", "failed"),
  "multi-textured-missing-texture-asset": renderStatusScene(
    renderMultiTexturedMissingTextureAssetScene,
  ),
  "multi-textured-missing-sampler-asset": renderStatusScene(
    renderMultiTexturedMissingSamplerAssetScene,
  ),
  "shared-sampler-missing-texture-asset": renderStatusScene(
    renderSharedSamplerMissingTextureAssetScene,
  ),
  "shared-sampler-missing-sampler-asset": renderStatusScene(
    renderSharedSamplerMissingSamplerAssetScene,
  ),
  "shared-texture-missing-texture-asset": renderStatusScene(
    renderSharedTextureMissingTextureAssetScene,
  ),
  "shared-texture-missing-sampler-asset": renderStatusScene(
    renderSharedTextureMissingSamplerAssetScene,
  ),
  "shared-texture-missing-texture-sampler-assets": renderStatusScene(
    renderSharedTextureMissingTextureSamplerAssetScene,
  ),
  "missing-texture-sampler-resources": renderWorldScene(
    createMissingTextureSamplerResourceWorld,
  ),
  "invalid-texture-upload": renderWorldScene(createInvalidTextureUploadWorld),
  "short-texture-upload": renderWorldScene(createShortTextureUploadWorld),
  "invalid-texture-rows-per-image": renderWorldScene(
    createInvalidTextureRowsPerImageWorld,
  ),
  "disabled-renderable": renderStatusScene(renderDisabledRenderableScene),
  "disabled-visible-peer": renderWorldScene(createDisabledVisiblePeerWorld),
  "box-primitive": renderWorldScene(createBoxPrimitiveWorld),
  "sphere-primitive": renderWorldScene(createSpherePrimitiveWorld),
  "cylinder-primitive": renderWorldScene(createCylinderPrimitiveWorld),
  "cone-primitive": renderWorldScene(createConePrimitiveWorld),
  "capsule-primitive": renderWorldScene(createCapsulePrimitiveWorld),
  "torus-primitive": renderWorldScene(createTorusPrimitiveWorld),
  "perspective-fov-camera": renderWorldScene(createPerspectiveFovCameraWorld),
  "orthographic-camera": renderWorldScene(createOrthographicCameraWorld),
  "directional-light-extraction": renderWorldScene(createDirectionalLightWorld),
  "ambient-light-extraction": renderWorldScene(createAmbientLightWorld),
  "environment-light-extraction": renderWorldScene(createEnvironmentLightWorld),
  "missing-environment-map": renderWorldScene(createMissingEnvironmentMapWorld),
  "loading-environment-map": renderWorldScene((aperture, canvasSize) =>
    createEnvironmentMapAssetStatusWorld(aperture, canvasSize, "loading"),
  ),
  "failed-environment-map": renderWorldScene((aperture, canvasSize) =>
    createEnvironmentMapAssetStatusWorld(aperture, canvasSize, "failed"),
  ),
  "malformed-environment-map": renderWorldScene(
    createMalformedEnvironmentMapWorld,
  ),
  "environment-map-handle": renderWorldScene(createEnvironmentMapHandleWorld),
  "point-light-extraction": renderWorldScene(createPointLightWorld),
  "spot-light-extraction": renderWorldScene(createSpotLightWorld),
  "missing-light-transform": renderWorldScene(createMissingLightTransformWorld),
  "invalid-light-extraction": renderWorldScene(createInvalidLightWorld),
  "directional-shadow-request": renderWorldScene(
    createDirectionalShadowRequestWorld,
  ),
  "invalid-shadow-settings": renderWorldScene(createInvalidShadowSettingsWorld),
  "unsupported-shadow-request": renderWorldScene(
    createUnsupportedShadowRequestWorld,
  ),
  "render-layer-filter": renderWorldScene(createRenderLayerFilterWorld),
  "render-order-overlap": renderWorldScene(createRenderOrderOverlapWorld),
  "depth-overlap": renderWorldScene(createDepthOverlapWorld),
  "textured-unlit": renderWorldScene(createTexturedUnlitWorld),
  "sampler-filter-address": renderWorldScene(createSamplerFilterAddressWorld),
  "textured-unlit-tint": renderWorldScene(createTexturedUnlitTintWorld),
  "sampler-v-address": renderWorldScene(createSamplerVAddressWorld),
  "multi-textured-unlit": renderWorldScene(createMultiTexturedUnlitWorld),
  "shared-sampler-multi-textured": renderWorldScene((aperture, canvasSize) =>
    createMultiTexturedUnlitWorld(aperture, canvasSize, {
      sharedSampler: true,
    }),
  ),
  "shared-texture-tinted-unlit": renderWorldScene(
    createSharedTextureTintedWorld,
  ),
  "shared-texture-missing-texture-resource": renderWorldScene(
    createSharedTextureMissingTextureResourceWorld,
  ),
  "shared-texture-missing-sampler-resource": renderWorldScene(
    createSharedTextureMissingSamplerResourceWorld,
  ),
  "shared-texture-missing-texture-sampler-resources": renderWorldScene(
    createSharedTextureMissingTextureSamplerResourceWorld,
  ),
  "multi-textured-missing-texture-resource": renderWorldScene(
    createMultiTexturedMissingTextureResourceWorld,
  ),
  "multi-textured-missing-sampler-resource": renderWorldScene(
    createMultiTexturedMissingSamplerResourceWorld,
  ),
  "multi-textured-missing-texture-sampler-resources": renderWorldScene(
    createMultiTexturedMissingTextureSamplerResourceWorld,
  ),
  "shared-sampler-missing-sampler-resource": renderWorldScene(
    createSharedSamplerMissingSamplerResourceWorld,
  ),
  "shared-sampler-missing-texture-resource": renderWorldScene(
    createSharedSamplerMissingTextureResourceWorld,
  ),
  "shared-sampler-missing-texture-sampler-resources": renderWorldScene(
    createSharedSamplerMissingTextureSamplerResourceWorld,
  ),
  "mixed-unlit-pipelines": renderWorldScene(createMixedUnlitPipelineWorld),
};

try {
  const aperture = await import("/dist/index.js");

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const initialization = await initializeWebGpuWithOptionalReadbackUsage({
      aperture,
      canvas,
    });
    const { initialized, readbackUsage } = initialization;

    if (!initialized.ok) {
      publishStatus({
        ...failure(
          "initialize-webgpu",
          initialized.reason,
          initialized.message,
        ),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const canvasSize = { width: canvas.width, height: canvas.height };
      const renderScenario = scenarioRenderers[scenario];

      publishStatus(
        !knownScenarios.has(scenario) || renderScenario === undefined
          ? unknownScenarioStatus(aperture, initialized)
          : await renderScenario({
              aperture,
              initialized,
              canvasSize,
              readbackUsage,
            }),
      );
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture package could not be imported from /dist.",
    ),
  );
}

function renderDefaultMultiEntityScenario(context) {
  return renderMultiEntityScene(
    context.aperture,
    context.initialized,
    context.canvasSize,
    context.readbackUsage,
  );
}

function renderStatusScene(renderScene) {
  return ({ aperture, initialized, canvasSize }) =>
    renderScene(aperture, initialized, canvasSize);
}

function renderWorldScene(createWorld) {
  return ({ aperture, initialized, canvasSize, readbackUsage }) =>
    renderMultiEntityScene(
      aperture,
      initialized,
      canvasSize,
      readbackUsage,
      createWorld(aperture, canvasSize),
    );
}

function renderMeshAssetStatusScenario(assetStatus) {
  return ({ aperture, initialized, canvasSize }) =>
    renderMeshAssetStatusScene(aperture, initialized, canvasSize, assetStatus);
}

function renderMaterialAssetStatusScenario(assetStatus) {
  return ({ aperture, initialized, canvasSize }) =>
    renderMaterialAssetStatusScene(
      aperture,
      initialized,
      canvasSize,
      assetStatus,
    );
}

function renderTextureAssetStatusScenario(dependencyKind, assetStatus) {
  return ({ aperture, initialized, canvasSize }) =>
    renderTextureDependencyAssetStatusScene(
      aperture,
      initialized,
      canvasSize,
      dependencyKind,
      assetStatus,
    );
}

async function renderMultiEntityScene(
  aperture,
  initialized,
  canvasSize,
  readbackUsage,
  inputScene,
) {
  const scene = inputScene ?? createMultiEntityWorld(aperture, canvasSize);
  const expectedDrawCount = scene.expectedDrawCount ?? 3;
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (
    firstDraw === undefined ||
    firstView === undefined ||
    snapshot.meshDraws.length !== expectedDrawCount
  ) {
    return {
      ...failure(
        "extract",
        "unexpected-snapshot",
        `The ECS multi-entity scene did not extract exactly ${expectedDrawCount} drawable mesh packet(s).`,
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: snapshot.diagnostics,
    };
  }

  const pipelineResources = await createScenePipelineResources(
    aperture,
    initialized,
    scene,
    snapshot,
  );

  if (!pipelineResources.valid || pipelineResources.resources.length === 0) {
    return {
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The unlit render pipeline could not be created.",
      ),
      diagnostics: pipelineResources.diagnostics,
      extraction: snapshotCounts(snapshot),
    };
  }

  const pipelinesWithLayouts = pipelineResources.resources.map((resource) => ({
    ...resource,
    layouts: unlitPipelineLayouts(resource.pipeline),
  }));
  const pipelineLayoutUnavailable = pipelinesWithLayouts.some(
    (resource) => resource.layouts === null,
  );

  if (pipelineLayoutUnavailable) {
    return failure(
      "pipeline-layouts",
      "pipeline-layouts-unavailable",
      "An unlit pipeline does not expose bind group layouts.",
    );
  }

  const fallbackLayouts = pipelinesWithLayouts[0].layouts;
  const pipelineLayoutsByKey = new Map(
    pipelinesWithLayouts.map((resource) => [
      resource.pipelineKey,
      resource.layouts ?? [],
    ]),
  );
  const materialPipelineKeys = new Map(
    snapshot.meshDraws.map((draw) => [
      aperture.assetHandleKey(draw.material),
      draw.batchKey.pipelineKey,
    ]),
  );
  const materialLayouts = scene.materials.map((entry) => {
    const pipelineKey = materialPipelineKeys.get(
      aperture.assetHandleKey(entry.handle),
    );

    return pipelineLayoutsByKey.get(pipelineKey) ?? fallbackLayouts ?? [];
  });

  const textureResources = createSceneTextureResources(
    aperture,
    initialized.device,
    scene,
  );

  if (!textureResources.valid) {
    return {
      ...failure(
        "resources",
        "texture-resources-unavailable",
        "The ECS multi-entity texture or sampler resources could not be uploaded.",
      ),
      diagnostics: textureResources.diagnostics,
      extraction: snapshotCounts(snapshot),
      ...(scene.texture === undefined ? {} : { texture: scene.texture }),
      ...(scene.invalidTextureUpload === undefined
        ? {}
        : { invalidTextureUpload: scene.invalidTextureUpload }),
      diagnosticCounts: {
        extraction: snapshot.diagnostics.length,
        resources: textureResources.diagnostics.length,
        binding: 0,
        draw: 0,
        submission: 0,
        readback: 0,
      },
    };
  }

  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = aperture.createMultiMaterialUnlitFrameGpuResources({
    device: initialized.device,
    mesh: scene.mesh,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    materials: scene.materials.map((entry) => entry.asset),
    layouts: fallbackLayouts ?? [],
    materialLayouts,
    textures: textureResources.textures,
    samplers: textureResources.samplers,
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The ECS multi-entity frame resources could not be uploaded.",
      ),
      ...runtimeStatus(aperture, initialized),
      clearColor,
      diagnostics: [
        ...textureResources.diagnostics,
        ...frameResources.diagnostics,
      ],
      extraction: snapshotCounts(snapshot),
      resources: {
        materials: 0,
        textures: textureResources.textures.length,
        samplers: textureResources.samplers.length,
        bindGroups: 0,
        missing: "texture/sampler",
      },
      ...(scene.texture === undefined ? {} : { texture: scene.texture }),
      ...(scene.multiTextured === undefined
        ? {}
        : { multiTextured: scene.multiTextured }),
      ...(scene.sharedTextureTinted === undefined
        ? {}
        : { sharedTextureTinted: scene.sharedTextureTinted }),
      ...(scene.missingTextureResource === undefined
        ? {}
        : { missingTextureResource: scene.missingTextureResource }),
      ...(scene.missingSamplerResource === undefined
        ? {}
        : { missingSamplerResource: scene.missingSamplerResource }),
      diagnosticCounts: {
        extraction: snapshot.diagnostics.length,
        resources:
          textureResources.diagnostics.length +
          frameResources.diagnostics.length,
        binding: 0,
        draw: 0,
        submission: 0,
        readback: 0,
      },
    };
  }

  const sharedBindGroups = createPipelineScopedSharedBindGroups(
    aperture,
    initialized.device,
    pipelinesWithLayouts,
    frameResources.resources,
  );

  if (!sharedBindGroups.valid) {
    return {
      ...failure(
        "resources",
        "shared-bind-groups-unavailable",
        "The ECS multi-entity shared bind groups could not be created for each pipeline layout.",
      ),
      ...runtimeStatus(aperture, initialized),
      clearColor,
      diagnostics: sharedBindGroups.diagnostics,
      extraction: snapshotCounts(snapshot),
      resources: {
        materials: frameResources.resources.materials.length,
        textures: textureResources.textures.length,
        samplers: textureResources.samplers.length,
        bindGroups: frameResources.resources.bindGroups.length,
        missing: "bind-group",
      },
      ...(scene.texture === undefined ? {} : { texture: scene.texture }),
    };
  }

  const bindGroups = [
    ...sharedBindGroups.resources,
    ...frameResources.resources.bindGroups.filter(
      (bindGroup) => bindGroup.group === 2,
    ),
  ];

  const meshResourceKey = frameResources.resources.mesh.resourceKey;
  const materialResourceKeys = new Map(
    scene.materials.map((entry, index) => [
      aperture.assetHandleKey(entry.handle),
      frameResources.resources.materials[index]?.resourceKey ?? null,
    ]),
  );
  const pipelineResults = pipelineResources.resources.map((resource) => ({
    ok: true,
    status: "miss",
    key: resource.pipelineKey,
    pipeline: resource.pipeline,
    diagnostics: [],
  }));
  const renderWorld = new aperture.RenderWorld();
  const framePlan = aperture.planRenderFrameFromSnapshot({
    snapshot,
    renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      aperture.assetHandleKey(draw.mesh) ===
      aperture.assetHandleKey(scene.meshHandle)
        ? meshResourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      materialResourceKeys.get(aperture.assetHandleKey(draw.material)) ?? null,
    meshResources: [frameResources.resources.mesh],
    pipelines: pipelineResults,
    bindGroups,
  });
  const {
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    packages,
    drawCommands,
    drawList,
    resources,
    commandPlan,
  } = framePlan;

  if (!framePlan.summary.ready || commandPlan.drawCount !== expectedDrawCount) {
    return {
      ...failure(
        "draw-plan",
        "draw-plan-unavailable",
        `The ECS multi-entity draw plan did not produce ${expectedDrawCount} drawable command(s).`,
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: framePlan.summary.diagnostics,
    };
  }

  const submitted = await submitMultiEntityFrame(
    aperture,
    initialized,
    commandPlan,
    canvasSize,
    readbackUsage,
    scene.readbackSamplePoints ?? readbackSamplePoints,
    { depthFormat: scene.depthFormat },
  );

  if (!submitted.ok) {
    return {
      ...failure("submit", submitted.reason, submitted.message),
      extraction: snapshotCounts(snapshot),
      diagnostics: submitted.diagnostics,
    };
  }

  const lightingResources = aperture.snapshotLightingResourcePlanToJsonValue(
    aperture.planSnapshotLightingResources(snapshot),
  );

  return {
    ...baseStatus,
    ok: true,
    phase: "submit",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: initialized.format,
    clearColor,
    extraction: snapshotCounts(snapshot),
    resources: {
      materials: frameResources.resources.materials.length,
      textures: textureResources.textures.length,
      samplers: textureResources.samplers.length,
      bindGroups: bindGroups.length,
    },
    lightingResources,
    binding: {
      planned: bindingPlan.bindings.length,
      applied: bindingResults.filter((result) => result.ok).length,
      ready: readiness.ready.length,
      diagnostics: bindingPlan.diagnostics.length,
    },
    renderWorld: {
      active: apply.active,
      ready: readiness.ready.length,
      blocked: readiness.blocked.length,
    },
    draw: {
      packages: packages.packages.length,
      descriptors: drawCommands.descriptors.length,
      drawList: drawList.draws.length,
      resolved: resources.draws.length,
      renderIds: packages.packages.map((drawPackage) => drawPackage.renderId),
    },
    pipelines: {
      count: pipelineResults.length,
      keys: pipelineResults.map((pipelineResult) => pipelineResult.key),
    },
    geometry: primitiveMeshStatus(scene),
    ...(scene.camera === undefined ? {} : { camera: scene.camera }),
    ...(scene.light === undefined
      ? {}
      : { light: lightStatus(scene, snapshot) }),
    ...(scene.environment === undefined
      ? {}
      : { environment: environmentStatus(scene, snapshot) }),
    ...(scene.shadow === undefined
      ? {}
      : { shadow: shadowStatus(scene, snapshot) }),
    ...(scene.renderOrder === undefined
      ? {}
      : { renderOrder: scene.renderOrder }),
    ...(scene.depthFormat === undefined
      ? {}
      : { depth: { format: scene.depthFormat } }),
    ...(scene.texture === undefined ? {} : { texture: scene.texture }),
    ...(scene.sampler === undefined ? {} : { sampler: scene.sampler }),
    ...(scene.texturedTint === undefined
      ? {}
      : { texturedTint: scene.texturedTint }),
    ...(scene.samplerVAddress === undefined
      ? {}
      : { samplerVAddress: scene.samplerVAddress }),
    ...(scene.multiTextured === undefined
      ? {}
      : { multiTextured: scene.multiTextured }),
    ...(scene.sharedTextureTinted === undefined
      ? {}
      : { sharedTextureTinted: scene.sharedTextureTinted }),
    ...(scene.mixedPipelines === undefined
      ? {}
      : { mixedPipelines: scene.mixedPipelines }),
    ...(scene.layerFiltering === undefined
      ? {}
      : { layerFiltering: layerFilteringStatus(scene, snapshot) }),
    ...(scene.disabled === undefined
      ? {}
      : { disabled: disabledStatus(scene, snapshot) }),
    ...(scene.authoredRenderableCount === undefined
      ? {}
      : { visibility: visibilityStatus(scene, snapshot) }),
    command: {
      commands: commandPlan.commands.length,
      drawCount: commandPlan.drawCount,
      indexedDrawCount: commandPlan.indexedDrawCount,
      nonIndexedDrawCount: commandPlan.nonIndexedDrawCount,
      firstInstances: commandPlan.commands.flatMap((command) =>
        command.kind === "draw" || command.kind === "drawIndexed"
          ? [command.firstInstance]
          : [],
      ),
    },
    submission: submitted.summary,
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      resources:
        textureResources.diagnostics.length +
        frameResources.diagnostics.length +
        sharedBindGroups.diagnostics.length,
      binding: bindingPlan.diagnostics.length,
      draw:
        packages.diagnostics.length +
        drawCommands.diagnostics.length +
        drawList.diagnostics.length +
        resources.diagnostics.length +
        commandPlan.diagnostics.length,
      submission: submitted.diagnosticCount,
      readback: submitted.readback.ok ? 0 : 1,
    },
    ...(snapshot.diagnostics.length === 0
      ? {}
      : { diagnostics: jsonSafeDiagnostics(snapshot.diagnostics) }),
    readback: submitted.readback,
  };
}

function renderDisabledRenderableScene(aperture, initialized, canvasSize) {
  const scene = createDisabledRenderableWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "disabled-renderable",
    message:
      "The ECS renderable is intentionally disabled with Enabled.value=false; no draw submission was attempted.",
    missing: "none",
    extra: {
      disabled: {
        authored: 1,
        extracted: snapshot.meshDraws.length,
        diagnostics: diagnosticCodes(snapshot.diagnostics),
      },
    },
  });
}

function renderMaterialAssetStatusScene(
  aperture,
  initialized,
  canvasSize,
  assetStatus,
) {
  const scene = createMaterialAssetStatusWorld(
    aperture,
    canvasSize,
    assetStatus,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: `material-asset-${assetStatus}`,
    message: `The ECS renderable intentionally references a ${assetStatus} material asset; no draw submission was attempted.`,
    missing: "material",
    extra: {
      assetStatus: {
        material: assetStatus,
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.materialHandle,
        ),
      },
    },
  });
}

function renderTextureDependencyAssetStatusScene(
  aperture,
  initialized,
  canvasSize,
  dependencyKind,
  assetStatus,
) {
  const scene = createTextureDependencyAssetStatusWorld(
    aperture,
    canvasSize,
    dependencyKind,
    assetStatus,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: `${dependencyKind}-asset-${assetStatus}`,
    message: `The ECS renderable intentionally references a ${assetStatus} ${dependencyKind} dependency; no draw submission was attempted.`,
    missing: dependencyKind,
    extra: {
      assetStatus: {
        [dependencyKind]: assetStatus,
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          dependencyKind === "texture"
            ? scene.textureHandle
            : scene.samplerHandle,
        ),
      },
      textureDependency: {
        dependencyKind,
        assetStatus,
        textureKey: aperture.assetHandleKey(scene.textureHandle),
        samplerKey: aperture.assetHandleKey(scene.samplerHandle),
      },
    },
  });
}

function renderMultiTexturedMissingTextureAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createMultiTexturedMissingTextureAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "multi-textured-missing-texture-asset",
    message:
      "One of two texture-backed materials intentionally references an unavailable texture asset; no resource creation or draw submission was attempted.",
    missing: "texture",
    extra: {
      assetStatus: {
        texture: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingTextureAsset.textureHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "texture",
        assetStatus: "missing",
        textureKey: scene.missingTextureAsset.textureKey,
        samplerKey: scene.missingTextureAsset.samplerKey,
      },
      multiTextured: scene.multiTextured,
      missingTextureAsset: {
        materialKey: scene.missingTextureAsset.materialKey,
        textureKey: scene.missingTextureAsset.textureKey,
        samplerKey: scene.missingTextureAsset.samplerKey,
        expectedDiagnostic: "render.texture.missing",
      },
    },
  });
}

function renderMultiTexturedMissingSamplerAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createMultiTexturedMissingSamplerAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "multi-textured-missing-sampler-asset",
    message:
      "One of two texture-backed materials intentionally references an unavailable sampler asset; no resource creation or draw submission was attempted.",
    missing: "sampler",
    extra: {
      assetStatus: {
        sampler: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingSamplerAsset.samplerHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "sampler",
        assetStatus: "missing",
        textureKey: scene.missingSamplerAsset.textureKey,
        samplerKey: scene.missingSamplerAsset.samplerKey,
      },
      multiTextured: scene.multiTextured,
      missingSamplerAsset: {
        materialKey: scene.missingSamplerAsset.materialKey,
        textureKey: scene.missingSamplerAsset.textureKey,
        samplerKey: scene.missingSamplerAsset.samplerKey,
        expectedDiagnostic: "render.sampler.missing",
      },
    },
  });
}

function renderSharedSamplerMissingTextureAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createSharedSamplerMissingTextureAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "shared-sampler-missing-texture-asset",
    message:
      "One of two texture-backed materials using a shared sampler intentionally references an unavailable texture asset; no resource creation or draw submission was attempted.",
    missing: "texture",
    extra: {
      assetStatus: {
        texture: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingTextureAsset.textureHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "texture",
        assetStatus: "missing",
        textureKey: scene.missingTextureAsset.textureKey,
        samplerKey: scene.missingTextureAsset.samplerKey,
      },
      multiTextured: scene.multiTextured,
      missingTextureAsset: {
        materialKey: scene.missingTextureAsset.materialKey,
        textureKey: scene.missingTextureAsset.textureKey,
        samplerKey: scene.missingTextureAsset.samplerKey,
        expectedDiagnostic: "render.texture.missing",
      },
    },
  });
}

function renderSharedSamplerMissingSamplerAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createSharedSamplerMissingSamplerAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "shared-sampler-missing-sampler-asset",
    message:
      "Two texture-backed materials intentionally share an unavailable sampler asset; no resource creation or draw submission was attempted.",
    missing: "sampler",
    extra: {
      assetStatus: {
        sampler: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingSharedSamplerAsset.samplerHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "sampler",
        assetStatus: "missing",
        textureKey: scene.multiTextured.left.textureKey,
        samplerKey: scene.missingSharedSamplerAsset.samplerKey,
      },
      multiTextured: scene.multiTextured,
      missingSharedSamplerAsset: {
        samplerKey: scene.missingSharedSamplerAsset.samplerKey,
        expectedDiagnostic: "render.sampler.missing",
      },
    },
  });
}

function renderSharedTextureMissingTextureAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createSharedTextureMissingTextureAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "shared-texture-missing-texture-asset",
    message:
      "Two texture-backed materials intentionally share an unavailable texture asset; no resource creation or draw submission was attempted.",
    missing: "texture",
    extra: {
      assetStatus: {
        texture: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingSharedTextureAsset.textureHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "texture",
        assetStatus: "missing",
        textureKey: scene.missingSharedTextureAsset.textureKey,
        samplerKey: scene.missingSharedTextureAsset.samplerKey,
      },
      sharedTextureTinted: scene.sharedTextureTinted,
      missingSharedTextureAsset: {
        textureKey: scene.missingSharedTextureAsset.textureKey,
        samplerKey: scene.missingSharedTextureAsset.samplerKey,
        expectedDiagnostic: "render.texture.missing",
      },
    },
  });
}

function renderSharedTextureMissingSamplerAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createSharedTextureMissingSamplerAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "shared-texture-missing-sampler-asset",
    message:
      "Two texture-backed materials intentionally share an unavailable sampler asset; no resource creation or draw submission was attempted.",
    missing: "sampler",
    extra: {
      assetStatus: {
        sampler: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.missingSharedSamplerAsset.samplerHandle,
        ),
      },
      textureDependency: {
        dependencyKind: "sampler",
        assetStatus: "missing",
        textureKey: scene.sharedTextureTinted.textureKey,
        samplerKey: scene.missingSharedSamplerAsset.samplerKey,
      },
      sharedTextureTinted: scene.sharedTextureTinted,
      missingSharedSamplerAsset: {
        samplerKey: scene.missingSharedSamplerAsset.samplerKey,
        expectedDiagnostic: "render.sampler.missing",
      },
    },
  });
}

function renderSharedTextureMissingTextureSamplerAssetScene(
  aperture,
  initialized,
  canvasSize,
) {
  const scene = createSharedTextureMissingTextureSamplerAssetWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "shared-texture-missing-texture-sampler-assets",
    message:
      "Two texture-backed materials intentionally share unavailable texture and sampler assets; no resource creation or draw submission was attempted.",
    missing: "texture/sampler",
    extra: {
      assetStatus: {
        texture: "missing",
        sampler: "missing",
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: [
          ...assetRegistryDiagnostics(
            scene.assets,
            scene.missingSharedTextureAsset.textureHandle,
          ),
          ...assetRegistryDiagnostics(
            scene.assets,
            scene.missingSharedSamplerAsset.samplerHandle,
          ),
        ],
      },
      sharedTextureTinted: scene.sharedTextureTinted,
      missingSharedTextureAsset: {
        textureKey: scene.missingSharedTextureAsset.textureKey,
        samplerKey: scene.missingSharedTextureAsset.samplerKey,
        expectedDiagnostic: "render.texture.missing",
      },
      missingSharedSamplerAsset: {
        samplerKey: scene.missingSharedSamplerAsset.samplerKey,
        expectedDiagnostic: "render.sampler.missing",
      },
    },
  });
}

function renderMeshAssetStatusScene(
  aperture,
  initialized,
  canvasSize,
  assetStatus,
) {
  const scene = createMeshAssetStatusWorld(aperture, canvasSize, assetStatus);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: `mesh-asset-${assetStatus}`,
    message: `The ECS renderable intentionally references a ${assetStatus} mesh asset; no draw submission was attempted.`,
    missing: "mesh",
    extra: {
      assetStatus: {
        mesh: assetStatus,
        diagnostics: diagnosticCodes(snapshot.diagnostics),
        registryDiagnostics: assetRegistryDiagnostics(
          scene.assets,
          scene.meshHandle,
        ),
      },
    },
  });
}

function unknownScenarioStatus(aperture, initialized) {
  return {
    ...baseStatus,
    ok: false,
    phase: "scenario",
    reason: "unknown-scenario",
    message: `Unknown multi-entity browser scenario '${scenario}'.`,
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: initialized.format,
    availableScenarios: knownScenarioIds,
    extraction: { frame: 0, views: 0, meshDraws: 0, diagnostics: 0 },
    resources: { materials: 0, bindGroups: 0, missing: "none" },
    binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
    draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
    command: {
      commands: 0,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 0,
      commands: 0,
      drawCalls: 0,
      indexedDrawCalls: 0,
    },
    diagnosticCounts: {
      extraction: 0,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
      readback: 0,
    },
    diagnostics: [],
  };
}

function renderMissingMaterialAssetScene(aperture, initialized, canvasSize) {
  const scene = createMissingMaterialAssetWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "missing-material-asset",
    message:
      "The ECS renderable intentionally references an unavailable material asset; no draw submission was attempted.",
    missing: "material",
  });
}

function renderMissingMeshResourceScene(aperture, initialized, canvasSize) {
  const scene = createMissingResourceWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });
  const renderWorld = new aperture.RenderWorld();
  const apply = renderWorld.applySnapshot(snapshot);
  const bindingPlan = aperture.planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: () => null,
    resolveMaterialResourceKey: (draw) =>
      aperture.assetHandleKey(draw.material) ===
      aperture.assetHandleKey(scene.materialHandle)
        ? `browser-smoke:${aperture.assetHandleKey(scene.materialHandle)}`
        : null,
  });
  const bindingResults = bindingPlan.bindings.map((binding) =>
    renderWorld.updateResourceBindings(binding.renderId, binding.update),
  );
  const readiness = renderWorld.createDrawReadinessReport();
  const diagnostics = [...bindingPlan.diagnostics, ...readiness.diagnostics];

  return resourceBindingFailureStatus(aperture, initialized, {
    snapshot,
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    diagnostics,
    reason: "missing-mesh-resource",
    message:
      "A renderer-side mesh resource binding was intentionally withheld; no draw submission was attempted.",
    missing: "mesh",
  });
}

function renderMissingMeshAssetScene(aperture, initialized, canvasSize) {
  const scene = createMissingMeshAssetWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "missing-mesh-asset",
    message:
      "The ECS renderable intentionally references an unavailable mesh asset; no draw submission was attempted.",
    missing: "mesh",
  });
}

function renderLayerMismatchScene(aperture, initialized, canvasSize) {
  const scene = createLayerMismatchWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });

  return extractionFailureStatus(aperture, initialized, {
    snapshot,
    reason: "layer-mismatch",
    message:
      "The renderable was intentionally authored on a layer outside the camera mask; no draw submission was attempted.",
    missing: "none",
    extra: {
      layerFiltering: {
        cameraLayerMask: scene.cameraLayerMask,
        renderableLayerMask: scene.renderableLayerMask,
        diagnostics: diagnosticCodes(snapshot.diagnostics),
      },
    },
  });
}

function renderMissingResourceScene(aperture, initialized, canvasSize) {
  const scene = createMissingResourceWorld(aperture, canvasSize);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 1,
  });
  const renderWorld = new aperture.RenderWorld();
  const apply = renderWorld.applySnapshot(snapshot);
  const bindingPlan = aperture.planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: (draw) =>
      aperture.assetHandleKey(draw.mesh) ===
      aperture.assetHandleKey(scene.meshHandle)
        ? `browser-smoke:${aperture.assetHandleKey(scene.meshHandle)}`
        : null,
    resolveMaterialResourceKey: () => null,
  });
  const bindingResults = bindingPlan.bindings.map((binding) =>
    renderWorld.updateResourceBindings(binding.renderId, binding.update),
  );
  const readiness = renderWorld.createDrawReadinessReport();
  const diagnostics = [...bindingPlan.diagnostics, ...readiness.diagnostics];

  return resourceBindingFailureStatus(aperture, initialized, {
    snapshot,
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    diagnostics,
    reason: "missing-material-resource",
    message:
      "A renderer-side material resource binding was intentionally withheld; no draw submission was attempted.",
    missing: "material",
  });
}

function extractionFailureStatus(
  aperture,
  initialized,
  { snapshot, reason, message, missing, extra = {} },
) {
  const renderWorld = new aperture.RenderWorld();
  const apply = renderWorld.applySnapshot(snapshot);
  const readiness = renderWorld.createDrawReadinessReport();

  return {
    ...baseStatus,
    ok: false,
    phase: "extract",
    reason,
    message,
    ...runtimeStatus(aperture, initialized),
    clearColor,
    extraction: snapshotCounts(snapshot),
    ...extra,
    resources: zeroResourcesStatus(missing),
    binding: zeroBindingStatus(),
    renderWorld: renderWorldStatus(apply, readiness, []),
    draw: zeroDrawStatus(),
    command: zeroCommandStatus(),
    submission: zeroSubmissionStatus(),
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      resources: 0,
      binding: 0,
      draw: 0,
      submission: 0,
      readback: 0,
    },
    diagnostics: jsonSafeDiagnostics(snapshot.diagnostics),
  };
}

function resourceBindingFailureStatus(
  aperture,
  initialized,
  {
    snapshot,
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    diagnostics,
    reason,
    message,
    missing,
  },
) {
  return {
    ...baseStatus,
    ok: false,
    phase: "resource-bindings",
    reason,
    message,
    ...runtimeStatus(aperture, initialized),
    clearColor,
    extraction: snapshotCounts(snapshot),
    resources: zeroResourcesStatus(missing),
    binding: {
      planned: bindingPlan.bindings.length,
      applied: bindingResults.filter((result) => result.ok).length,
      ready: readiness.ready.length,
      diagnostics: bindingPlan.diagnostics.length,
      diagnosticCodes: diagnosticCodes(bindingPlan.diagnostics),
    },
    renderWorld: renderWorldStatus(
      apply,
      readiness,
      readiness.blocked.flatMap((blocked) => blocked.missing),
    ),
    draw: zeroDrawStatus(),
    command: zeroCommandStatus(),
    submission: zeroSubmissionStatus(),
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      resources: 0,
      binding: bindingPlan.diagnostics.length,
      draw: readiness.diagnostics.length,
      submission: 0,
      readback: 0,
    },
    diagnostics: jsonSafeDiagnostics(diagnostics),
  };
}

function runtimeStatus(aperture, initialized) {
  return {
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: initialized.format,
  };
}

function assetRegistryDiagnostics(assets, handle) {
  if (handle === undefined) {
    return [];
  }

  return assets.collectDiagnostics(handle).map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    ...(typeof diagnostic.severity === "string"
      ? { severity: diagnostic.severity }
      : {}),
  }));
}

function zeroResourcesStatus(missing) {
  return {
    materials: 0,
    bindGroups: 0,
    missing,
  };
}

function zeroBindingStatus() {
  return {
    planned: 0,
    applied: 0,
    ready: 0,
    diagnostics: 0,
    diagnosticCodes: [],
  };
}

function renderWorldStatus(apply, readiness, blockedReasons) {
  return {
    active: apply.active,
    ready: readiness.ready.length,
    blocked: readiness.blocked.length,
    blockedReasons,
    diagnostics: diagnosticCodes(readiness.diagnostics),
  };
}

function zeroDrawStatus() {
  return {
    packages: 0,
    descriptors: 0,
    drawList: 0,
    resolved: 0,
  };
}

function zeroCommandStatus() {
  return {
    commands: 0,
    drawCount: 0,
    indexedDrawCount: 0,
    nonIndexedDrawCount: 0,
  };
}

function zeroSubmissionStatus() {
  return {
    commandBuffers: 0,
    commands: 0,
    drawCalls: 0,
    indexedDrawCalls: 0,
  };
}

async function createScenePipelineResources(
  aperture,
  initialized,
  scene,
  snapshot,
) {
  const batchKeysByPipelineKey = new Map(
    snapshot.meshDraws.map((draw) => [
      draw.batchKey.pipelineKey,
      draw.batchKey,
    ]),
  );
  const pipelineResults = await Promise.all(
    [...batchKeysByPipelineKey.entries()].map(async ([pipelineKey, batchKey]) =>
      aperture
        .createUnlitRenderPipelineResource({
          device: initialized.device,
          colorFormat: initialized.format,
          ...(scene.depthFormat === undefined
            ? {}
            : { depthFormat: scene.depthFormat }),
          batchKey,
        })
        .then((result) => ({ pipelineKey, result })),
    ),
  );
  const diagnostics = pipelineResults.flatMap(
    (pipelineResult) => pipelineResult.result.diagnostics,
  );
  const resources = pipelineResults.flatMap((pipelineResult) =>
    pipelineResult.result.resource === null
      ? []
      : [
          {
            pipelineKey: pipelineResult.pipelineKey,
            pipeline: pipelineResult.result.resource.pipeline,
          },
        ],
  );

  return {
    valid:
      diagnostics.length === 0 && resources.length === pipelineResults.length,
    resources,
    diagnostics,
  };
}

function unlitPipelineLayouts(pipeline) {
  if (typeof pipeline.getBindGroupLayout !== "function") {
    return null;
  }

  return [0, 1, 2].map((group) => ({
    group,
    layoutKey: `unlit/pipeline-layout-${group}`,
    layout: pipeline.getBindGroupLayout(group),
  }));
}

function createPipelineScopedSharedBindGroups(
  aperture,
  device,
  pipelinesWithLayouts,
  frameResources,
) {
  const results = pipelinesWithLayouts.map((pipelineResource) => {
    const result = aperture.createUnlitBindGroupsFromGpuResources({
      device,
      plan: {
        valid: true,
        entries: [
          {
            group: 0,
            binding: 0,
            resourceKey: frameResources.viewUniform.resourceKey,
            resourceKind: "buffer",
          },
          {
            group: 1,
            binding: 0,
            resourceKey: frameResources.worldTransforms.resourceKey,
            resourceKind: "buffer",
          },
        ],
        diagnostics: [],
      },
      layouts: pipelineResource.layouts ?? [],
      buffers: [
        {
          resourceKey: frameResources.viewUniform.resourceKey,
          buffer: frameResources.viewUniform.buffer,
        },
        {
          resourceKey: frameResources.worldTransforms.resourceKey,
          buffer: frameResources.worldTransforms.buffer,
        },
      ],
    });

    return {
      ...result,
      resources: result.resources.map((resource) => ({
        ...resource,
        resourceKey: `${resource.resourceKey}/pipeline:${pipelineResource.pipelineKey}`,
        entryResourceKeys: [
          ...resource.entryResourceKeys,
          pipelineResource.pipelineKey,
        ],
      })),
    };
  });
  const diagnostics = results.flatMap((result) => result.diagnostics);

  return {
    valid: diagnostics.length === 0 && results.every((result) => result.valid),
    resources: results.flatMap((result) => result.resources),
    diagnostics,
  };
}

function createSceneTextureResources(aperture, device, scene) {
  const textureResults = (scene.textures ?? []).map((texture) =>
    aperture.createTextureGpuResource({
      device,
      resourceKey: texture.resourceKey,
      descriptor: texture.descriptor,
      upload: texture.upload,
    }),
  );
  const samplerResults = (scene.samplers ?? []).map((sampler) =>
    aperture.createSamplerGpuResource({
      device,
      resourceKey: sampler.resourceKey,
      sampler: sampler.asset,
    }),
  );
  const textures = textureResults.flatMap((result) =>
    result.resource === null ? [] : [result.resource],
  );
  const samplers = samplerResults.flatMap((result) =>
    result.resource === null ? [] : [result.resource],
  );
  const diagnostics = [
    ...textureResults.flatMap((result) => result.diagnostics),
    ...samplerResults.flatMap((result) => result.diagnostics),
  ];

  return {
    valid: diagnostics.length === 0,
    textures,
    samplers,
    diagnostics,
  };
}

async function submitMultiEntityFrame(
  aperture,
  initialized,
  commandPlan,
  canvasSize,
  readbackUsage,
  samples,
  options = {},
) {
  const colorTarget = createCurrentTextureColorTargetWithTexture({
    context: initialized.context,
    clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
  });

  if (!colorTarget.valid || colorTarget.target === null) {
    return stepFailure(
      "current-texture-unavailable",
      "The WebGPU context did not provide a current texture view.",
      colorTarget.diagnostics,
    );
  }

  const depthTarget =
    options.depthFormat === undefined
      ? null
      : createDepthTarget(initialized.device, canvasSize, options.depthFormat);
  const attachments = aperture.createRenderPassAttachmentPlan({
    colorTargets: [colorTarget.target],
    ...(depthTarget === null
      ? {}
      : { depthTarget: { view: depthTarget.view, depthClearValue: 1 } }),
  });

  if (!attachments.valid || attachments.plan === null) {
    return stepFailure(
      "attachments-unavailable",
      "The render pass attachments could not be planned.",
      attachments.diagnostics,
    );
  }

  const encoderResource = aperture.createCommandEncoderResource({
    device: initialized.device,
    label: "ecs-multi-entity",
  });

  if (!encoderResource.valid || encoderResource.resource === null) {
    return stepFailure(
      "encoder-unavailable",
      "The WebGPU command encoder could not be created.",
      encoderResource.diagnostics,
    );
  }

  const begin = aperture.beginPlannedRenderPass({
    encoder: encoderResource.resource.encoder,
    plan: attachments.plan,
  });

  if (!begin.valid || begin.pass === null) {
    return stepFailure(
      "render-pass-unavailable",
      "The render pass could not begin.",
      begin.diagnostics,
    );
  }

  const execution = aperture.executeRenderPassCommands({
    pass: begin.pass,
    commands: commandPlan.commands,
  });
  const end = aperture.endPlannedRenderPass(begin.pass);
  const readbackPlan = readbackUsage.ok
    ? copyCurrentTextureReadbackSamples({
        device: initialized.device,
        encoder: encoderResource.resource.encoder,
        texture: colorTarget.texture,
        format: initialized.format,
        width: canvasSize.width,
        height: canvasSize.height,
        samples,
      })
    : readbackUsage;
  const finished = aperture.finishCommandEncoder({
    encoder: encoderResource.resource.encoder,
    label: "ecs-multi-entity",
  });

  if (!execution.valid || !end.valid || !finished.valid) {
    return stepFailure(
      "commands-unavailable",
      "The render pass commands could not be submitted.",
      [...execution.diagnostics, ...end.diagnostics, ...finished.diagnostics],
    );
  }

  const submitted = aperture.submitCommandBuffers({
    queue: initialized.device.queue,
    commandBuffers: [finished.resource],
  });

  if (!submitted.valid) {
    return stepFailure(
      "queue-submit-unavailable",
      "The command buffer could not be submitted.",
      submitted.diagnostics,
    );
  }

  await waitForSubmittedWork(initialized.device);
  const readback = readbackPlan.ok
    ? await mapCurrentTextureReadbackSamples(readbackPlan)
    : markReadbackClearOk(readbackPlan, true);

  return {
    ok: true,
    summary: {
      commandBuffers: submitted.submitted,
      commands: commandPlan.commands.length,
      drawCalls: execution.drawCalls,
      indexedDrawCalls: execution.indexedDrawCalls,
    },
    diagnosticCount:
      attachments.diagnostics.length +
      encoderResource.diagnostics.length +
      begin.diagnostics.length +
      execution.diagnostics.length +
      end.diagnostics.length +
      finished.diagnostics.length +
      submitted.diagnostics.length,
    readback,
  };
}

function createDepthTarget(device, canvasSize, format) {
  if (typeof device.createTexture !== "function") {
    return null;
  }

  const usage = globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 0x10;
  const texture = device.createTexture({
    size: [canvasSize.width, canvasSize.height, 1],
    format,
    usage,
  });

  return { texture, view: texture.createView() };
}

function createDisabledRenderableWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("disabled-plane");
  const materialHandle = aperture.createMaterialHandle("disabled-unlit");
  const mesh = aperture.createPlaneMeshAsset({
    label: "DisabledPlane",
    width: 0.85,
    height: 0.85,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "DisabledMaterial",
    baseColorFactor: new Float32Array([1, 0.8, 0, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0], {
    enabled: false,
  });

  return { world, assets };
}

function createDisabledVisiblePeerWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("disabled-visible-peer-plane");
  const visibleHandle = aperture.createMaterialHandle("enabled-peer-green");
  const disabledHandle = aperture.createMaterialHandle("disabled-peer-red");
  const mesh = aperture.createPlaneMeshAsset({
    label: "DisabledVisiblePeerPlane",
    width: 1.05,
    height: 1.05,
  });
  const visibleMaterial = aperture.createUnlitMaterialAsset({
    label: "EnabledPeerGreenMaterial",
    baseColorFactor: new Float32Array([0.18, 0.78, 1, 1]),
  });
  const disabledMaterial = aperture.createUnlitMaterialAsset({
    label: "DisabledPeerRedMaterial",
    baseColorFactor: new Float32Array([1, 0.08, 0.08, 1]),
  });
  const disabledMaterialColor = [1, 0.08, 0.08, 1];

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(visibleHandle);
  assets.register(disabledHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(visibleHandle, visibleMaterial);
  assets.markReady(disabledHandle, disabledMaterial);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, visibleHandle, [0, 0, 0]);
  addPrimitiveEntity(aperture, world, meshHandle, disabledHandle, [0, 0, 0], {
    enabled: false,
    renderOrder: 10,
  });

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    disabled: {
      authored: 2,
      enabled: 1,
      disabled: 1,
      disabledMaterialKey: aperture.assetHandleKey(disabledHandle),
      disabledMaterialColor,
    },
    materials: [{ handle: visibleHandle, asset: visibleMaterial }],
  };
}

function createMaterialAssetStatusWorld(aperture, canvasSize, assetStatus) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle(`${assetStatus}-material-plane`);
  const materialHandle = aperture.createMaterialHandle(`${assetStatus}-unlit`);
  const mesh = aperture.createPlaneMeshAsset({
    label: `${assetStatus}MaterialPlane`,
    width: 0.85,
    height: 0.85,
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);

  if (assetStatus === "loading") {
    assets.markLoading(materialHandle);
  } else {
    assets.markFailed(materialHandle, [
      {
        code: "browser.fixture.failedMaterial",
        message: "Intentional browser fixture failed material asset.",
        severity: "error",
      },
    ]);
  }

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return { world, assets, materialHandle };
}

function createTextureDependencyAssetStatusWorld(
  aperture,
  canvasSize,
  dependencyKind,
  assetStatus,
) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle(
    `${assetStatus}-${dependencyKind}-dependency-plane`,
  );
  const materialHandle = aperture.createMaterialHandle(
    `${assetStatus}-${dependencyKind}-dependency-unlit`,
  );
  const textureHandle = aperture.createTextureHandle(
    `${assetStatus}-dependency-albedo`,
  );
  const samplerHandle = aperture.createSamplerHandle(
    `${assetStatus}-dependency-sampler`,
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: `${assetStatus}${dependencyKind}DependencyPlane`,
    width: 0.85,
    height: 0.85,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: `${assetStatus}${dependencyKind}DependencyMaterial`,
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  if (!(dependencyKind === "texture" && assetStatus === "missing")) {
    assets.register(textureHandle);
    if (dependencyKind === "texture" && assetStatus === "loading") {
      assets.markLoading(textureHandle);
    } else if (dependencyKind === "texture" && assetStatus === "failed") {
      assets.markFailed(textureHandle, [
        {
          code: "browser.fixture.failedTexture",
          message: "Intentional browser fixture failed texture asset.",
          severity: "error",
        },
      ]);
    } else {
      assets.markReady(textureHandle, textureDependencyAsset(aperture));
    }
  }

  if (!(dependencyKind === "sampler" && assetStatus === "missing")) {
    assets.register(samplerHandle);
    if (dependencyKind === "sampler" && assetStatus === "loading") {
      assets.markLoading(samplerHandle);
    } else if (dependencyKind === "sampler" && assetStatus === "failed") {
      assets.markFailed(samplerHandle, [
        {
          code: "browser.fixture.failedSampler",
          message: "Intentional browser fixture failed sampler asset.",
          severity: "error",
        },
      ]);
    } else {
      assets.markReady(samplerHandle, aperture.createSamplerAsset());
    }
  }

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    textureHandle,
    samplerHandle,
  };
}

function textureDependencyAsset(aperture) {
  return aperture.createTextureAsset({
    label: "DependencyAlbedo",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "srgb",
    semantic: "base-color",
  });
}

function createMeshAssetStatusWorld(aperture, canvasSize, assetStatus) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle(`${assetStatus}-plane`);
  const materialHandle = aperture.createMaterialHandle(`${assetStatus}-unlit`);
  const material = aperture.createUnlitMaterialAsset({
    label: `${assetStatus}Material`,
    baseColorFactor: new Float32Array([1, 0.8, 0, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);

  if (assetStatus === "loading") {
    assets.markLoading(meshHandle);
  } else {
    assets.markFailed(meshHandle, [
      {
        code: "browser.fixture.failedMesh",
        message: "Intentional browser fixture failed mesh asset.",
        severity: "error",
      },
    ]);
  }

  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return { world, assets, meshHandle };
}

function createMissingMaterialAssetWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("missing-material-plane");
  const materialHandle = aperture.createMaterialHandle("unavailable-material");
  const mesh = aperture.createPlaneMeshAsset({
    label: "MissingMaterialPlane",
    width: 0.85,
    height: 0.85,
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.markReady(meshHandle, mesh);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return { world, assets };
}

function createMissingMeshAssetWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("unavailable-plane");
  const materialHandle = aperture.createMaterialHandle("missing-mesh-unlit");
  const material = aperture.createUnlitMaterialAsset({
    label: "MissingMeshMaterial",
    baseColorFactor: new Float32Array([1, 0.8, 0, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(materialHandle);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return { world, assets };
}

function createLayerMismatchWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("layer-mismatch-plane");
  const materialHandle = aperture.createMaterialHandle("layer-mismatch-unlit");
  const mesh = aperture.createPlaneMeshAsset({
    label: "LayerMismatchPlane",
    width: 0.85,
    height: 0.85,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "LayerMismatchMaterial",
    baseColorFactor: new Float32Array([1, 0.8, 0, 1]),
  });
  const cameraLayerMask = 1;
  const renderableLayerMask = 2;

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: cameraLayerMask,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0], {
    layerMask: renderableLayerMask,
  });

  return {
    world,
    assets,
    cameraLayerMask,
    renderableLayerMask,
  };
}

function createMissingResourceWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("missing-resource-plane");
  const materialHandle = aperture.createMaterialHandle("unbound-material");
  const mesh = aperture.createPlaneMeshAsset({
    label: "MissingResourcePlane",
    width: 0.85,
    height: 0.85,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "UnboundMaterial",
    baseColorFactor: new Float32Array([1, 0.8, 0, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return { world, assets, meshHandle, materialHandle };
}

function createBoxPrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("box-primitive");
  const materialHandle = aperture.createMaterialHandle("box-unlit");
  const mesh = aperture.createBoxMeshAsset({
    label: "BoxPrimitive",
    width: 0.95,
    height: 0.95,
    depth: 0.95,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "BoxUnlitMaterial",
    baseColorFactor: new Float32Array([1, 0.64, 0.08, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "box",
      source: "aperture.createBoxMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createSpherePrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("sphere-primitive");
  const materialHandle = aperture.createMaterialHandle("sphere-unlit");
  const mesh = aperture.createSphereMeshAsset({
    label: "SpherePrimitive",
    radius: 0.7,
    widthSegments: 16,
    heightSegments: 8,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "SphereUnlitMaterial",
    baseColorFactor: new Float32Array([0.86, 0.28, 0.95, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "sphere",
      source: "aperture.createSphereMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createCylinderPrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("cylinder-primitive");
  const materialHandle = aperture.createMaterialHandle("cylinder-unlit");
  const mesh = aperture.createCylinderMeshAsset({
    label: "CylinderPrimitive",
    radius: 0.72,
    height: 1.25,
    radialSegments: 8,
    heightSegments: 2,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "CylinderUnlitMaterial",
    baseColorFactor: new Float32Array([0.12, 0.72, 0.9, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "cylinder",
      source: "aperture.createCylinderMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createConePrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("cone-primitive");
  const materialHandle = aperture.createMaterialHandle("cone-unlit");
  const mesh = aperture.createConeMeshAsset({
    label: "ConePrimitive",
    radius: 0.82,
    height: 1.35,
    radialSegments: 8,
    heightSegments: 2,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "ConeUnlitMaterial",
    baseColorFactor: new Float32Array([0.94, 0.42, 0.22, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "cone",
      source: "aperture.createConeMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createCapsulePrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("capsule-primitive");
  const materialHandle = aperture.createMaterialHandle("capsule-unlit");
  const mesh = aperture.createCapsuleMeshAsset({
    label: "CapsulePrimitive",
    radius: 0.45,
    height: 1.5,
    radialSegments: 8,
    capSegments: 4,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "CapsuleUnlitMaterial",
    baseColorFactor: new Float32Array([0.78, 0.86, 0.24, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "capsule",
      source: "aperture.createCapsuleMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createTorusPrimitiveWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("torus-primitive");
  const materialHandle = aperture.createMaterialHandle("torus-unlit");
  const mesh = aperture.createTorusMeshAsset({
    label: "TorusPrimitive",
    majorRadius: 0.55,
    tubeRadius: 0.18,
    radialSegments: 8,
    tubeSegments: 4,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "TorusUnlitMaterial",
    baseColorFactor: new Float32Array([0.36, 0.52, 1, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "torus",
      source: "aperture.createTorusMeshAsset",
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createPerspectiveFovCameraWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("perspective-fov-plane");
  const materialHandle = aperture.createMaterialHandle("perspective-fov-unlit");
  const mesh = aperture.createPlaneMeshAsset({
    label: "PerspectiveFovPlane",
    width: 1.1,
    height: 1.1,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "PerspectiveFovUnlitMaterial",
    baseColorFactor: new Float32Array([0.72, 0.28, 1, 1]),
  });
  const fovYRadians = Math.PI / 4;

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      projection: aperture.CameraProjection.Perspective,
      fovYRadians,
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    camera: {
      projection: "perspective",
      fovYRadians,
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createOrthographicCameraWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("orthographic-plane");
  const materialHandle = aperture.createMaterialHandle("orthographic-unlit");
  const mesh = aperture.createPlaneMeshAsset({
    label: "OrthographicPlane",
    width: 1.2,
    height: 1.2,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "OrthographicUnlitMaterial",
    baseColorFactor: new Float32Array([0.2, 0.95, 0.75, 1]),
  });
  const orthographicHeight = 2.2;

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      projection: aperture.CameraProjection.Orthographic,
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      orthographicHeight,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    camera: {
      projection: "orthographic",
      orthographicHeight,
    },
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createDirectionalLightWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 5 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("directional-light-plane");
  const materialHandle = aperture.createMaterialHandle(
    "directional-light-unlit",
  );
  const mesh = aperture.createPlaneMeshAsset({
    label: "DirectionalLightPlane",
    width: 0.9,
    height: 0.9,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "DirectionalLightUnlitMaterial",
    baseColorFactor: new Float32Array([0.96, 0.78, 0.18, 1]),
  });
  const light = {
    authored: 1,
    kind: "directional",
    intensity: 1.75,
    layerMask: 1,
  };

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.25],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  const lightEntity = world.createEntity();
  const lightTransform = aperture.createRootTransform({
    translation: [-0.25, 0.75, 1.5],
  });

  lightEntity.addComponent(aperture.WorldTransform, lightTransform.world);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.72, 1],
      intensity: light.intensity,
      layerMask: light.layerMask,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    light,
    lightEntity,
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createInvalidLightWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Spot,
      color: [1, 0.25, 0.1, 1],
      intensity: -1,
      range: 0,
      innerConeAngle: 2,
      outerConeAngle: 1,
      layerMask: 0,
    }),
  );

  return {
    ...scene,
    light: {
      authored: 1,
      kind: "spot",
      intensity: -1,
      layerMask: 0,
      expectedDiagnostics: [
        "render.light.invalidIntensity",
        "render.light.invalidRange",
        "render.light.invalidSpotCone",
        "render.light.zeroLayerMask",
      ],
    },
  };
}

function createAmbientLightWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.WorldTransform);
  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Ambient,
      color: [0.8, 0.9, 1, 1],
      intensity: 0.25,
      layerMask: 1,
    }),
  );

  return {
    ...scene,
    light: {
      authored: 1,
      kind: "ambient",
      intensity: 0.25,
      layerMask: 1,
      expectedDiagnostics: [],
      transformless: true,
    },
  };
}

function createEnvironmentLightWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.WorldTransform);
  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Environment,
      color: [0.6, 0.72, 1, 1],
      intensity: 0.5,
      layerMask: 1,
    }),
  );

  return {
    ...scene,
    light: undefined,
    environment: {
      authored: 1,
      kind: "environment",
      intensity: 0.5,
      layerMask: 1,
      expectedDiagnostics: [],
      transformless: true,
    },
  };
}

function createMissingEnvironmentMapWorld(aperture, canvasSize) {
  const scene = createEnvironmentLightWorld(aperture, canvasSize);
  const environmentMap = aperture.createEnvironmentMapHandle("missing-studio");
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Environment,
      color: [0.6, 0.72, 1, 1],
      intensity: 0.5,
      layerMask: 1,
      environmentMap,
    }),
  );

  return {
    ...scene,
    environment: {
      ...scene.environment,
      expectedDiagnostics: ["render.environment.missing"],
      expectedHandleKey: aperture.assetHandleKey(environmentMap),
    },
  };
}

function createEnvironmentMapHandleWorld(aperture, canvasSize) {
  const scene = createEnvironmentLightWorld(aperture, canvasSize);
  const environmentMap = aperture.createEnvironmentMapHandle("studio-ready");
  const lightEntity = scene.lightEntity;

  scene.assets.register(environmentMap);
  scene.assets.markReady(environmentMap, {
    label: "Ready studio environment map",
  });
  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Environment,
      color: [0.6, 0.72, 1, 1],
      intensity: 0.5,
      layerMask: 1,
      environmentMap,
    }),
  );

  return {
    ...scene,
    environment: {
      ...scene.environment,
      expectedHandleKey: aperture.assetHandleKey(environmentMap),
    },
  };
}

function createEnvironmentMapAssetStatusWorld(
  aperture,
  canvasSize,
  assetStatus,
) {
  const scene = createEnvironmentLightWorld(aperture, canvasSize);
  const environmentMap = aperture.createEnvironmentMapHandle(
    `${assetStatus}-studio`,
  );
  const lightEntity = scene.lightEntity;

  scene.assets.register(environmentMap);

  if (assetStatus === "loading") {
    scene.assets.markLoading(environmentMap);
  } else {
    scene.assets.markFailed(environmentMap, [
      {
        code: "environment.failed",
        message: "Environment map intentionally failed for browser routing.",
        severity: "error",
      },
    ]);
  }

  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Environment,
      color: [0.6, 0.72, 1, 1],
      intensity: 0.5,
      layerMask: 1,
      environmentMap,
    }),
  );

  return {
    ...scene,
    environment: {
      ...scene.environment,
      expectedDiagnostics: [`render.environment.${assetStatus}`],
      expectedHandleKey: aperture.assetHandleKey(environmentMap),
    },
  };
}

function createMalformedEnvironmentMapWorld(aperture, canvasSize) {
  const scene = createEnvironmentLightWorld(aperture, canvasSize);

  scene.lightEntity.setValue(
    aperture.Light,
    "environmentMapId",
    "texture:not-an-environment-map",
  );

  return {
    ...scene,
    environment: {
      ...scene.environment,
      expectedDiagnostics: ["render.environment.invalidHandle"],
    },
  };
}

function createSpotLightWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Spot,
      color: [1, 0.78, 0.42, 1],
      intensity: 2.5,
      range: 4,
      innerConeAngle: 0.25,
      outerConeAngle: 0.5,
      layerMask: 1,
    }),
  );

  return {
    ...scene,
    light: {
      authored: 1,
      kind: "spot",
      intensity: 2.5,
      range: 4,
      innerConeAngle: 0.25,
      outerConeAngle: 0.5,
      layerMask: 1,
      expectedDiagnostics: [],
    },
  };
}

function createPointLightWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);
  const lightEntity = scene.lightEntity;

  lightEntity.removeComponent(aperture.Light);
  lightEntity.addComponent(
    aperture.Light,
    aperture.createLight({
      kind: aperture.LightKind.Point,
      color: [0.4, 0.72, 1, 1],
      intensity: 2,
      range: 5,
      layerMask: 1,
    }),
  );

  return {
    ...scene,
    light: {
      authored: 1,
      kind: "point",
      intensity: 2,
      range: 5,
      layerMask: 1,
      expectedDiagnostics: [],
    },
  };
}

function createMissingLightTransformWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);

  scene.lightEntity.removeComponent(aperture.WorldTransform);

  return {
    ...scene,
    light: {
      authored: 1,
      kind: "directional",
      intensity: 1.75,
      layerMask: 1,
      expectedDiagnostics: ["render.lightMissingTransform"],
      transformless: true,
    },
  };
}

function createUnsupportedShadowRequestWorld(aperture, canvasSize) {
  const scene = createAmbientLightWorld(aperture, canvasSize);

  scene.lightEntity.addComponent(
    aperture.LightShadowSettings,
    aperture.createLightShadowSettings({
      enabled: true,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return {
    ...scene,
    shadow: {
      expectedRequests: 0,
      expectedDiagnostics: ["render.shadowUnsupportedLightKind.ambient"],
    },
  };
}

function createDirectionalShadowRequestWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);

  scene.lightEntity.addComponent(
    aperture.LightShadowSettings,
    aperture.createLightShadowSettings({
      enabled: true,
      mapSize: 2048,
      bias: 0.001,
      normalBias: 0.01,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );

  return {
    ...scene,
    shadow: {
      expectedRequests: 1,
      expectedCasterLayerMasks: [1],
      expectedReceiverLayerMasks: [1],
      expectedDiagnostics: [],
    },
  };
}

function createInvalidShadowSettingsWorld(aperture, canvasSize) {
  const scene = createDirectionalLightWorld(aperture, canvasSize);

  scene.lightEntity.addComponent(
    aperture.LightShadowSettings,
    aperture.createLightShadowSettings({
      enabled: true,
      mapSize: 0,
      bias: -0.001,
      normalBias: -0.01,
      casterLayerMask: 0,
      receiverLayerMask: 0,
    }),
  );

  return {
    ...scene,
    shadow: {
      expectedRequests: 0,
      expectedCasterLayerMasks: [],
      expectedReceiverLayerMasks: [],
      expectedDiagnostics: [
        "render.shadow.invalidMapSize",
        "render.shadow.invalidBias",
        "render.shadow.zeroLayerMask",
      ],
    },
  };
}

function createTexturedUnlitWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("textured-unlit-plane");
  const materialHandle = aperture.createMaterialHandle("textured-unlit");
  const textureHandle = aperture.createTextureHandle("checker-albedo");
  const samplerHandle = aperture.createSamplerHandle("nearest-clamp");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const mesh = aperture.createPlaneMeshAsset({
    label: "TexturedUnlitPlane",
    width: 1.75,
    height: 1.05,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "TexturedUnlitMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });
  const textureAsset = aperture.createTextureAsset({
    label: "CheckerAlbedo",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "srgb",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "NearestClampSampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
  const lowerLeftColor = [1, 0.125, 0.0625, 1];
  const lowerRightColor = [0.09375, 0.5, 1, 1];
  const upperLeftColor = [0.09375, 0.875, 0.3125, 1];
  const upperRightColor = [1, 0.90625, 0.09375, 1];
  const expectedQuadrants = [
    { sampleId: "upper-left-green", expectedColor: upperLeftColor },
    { sampleId: "upper-right-yellow", expectedColor: upperRightColor },
    { sampleId: "lower-left-red", expectedColor: lowerLeftColor },
    { sampleId: "lower-right-blue", expectedColor: lowerRightColor },
  ];
  const textureBytes = new Uint8Array([
    255, 32, 16, 255, 24, 128, 255, 255, 24, 224, 80, 255, 255, 232, 24, 255,
  ]);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: [
      { id: "upper-left-green", x: 0.38, y: 0.42 },
      { id: "upper-right-yellow", x: 0.62, y: 0.42 },
      { id: "lower-left-red", x: 0.38, y: 0.58 },
      { id: "lower-right-blue", x: 0.62, y: 0.58 },
    ],
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    texture: {
      materialKey: aperture.assetHandleKey(materialHandle),
      textureKey,
      samplerKey,
      expectedLeftColor: lowerLeftColor,
      expectedRightColor: lowerRightColor,
      expectedQuadrants,
    },
    textures: [
      {
        resourceKey: textureKey,
        descriptor: {
          label: "CheckerAlbedo",
          size: [2, 2, 1],
          format: "rgba8unorm",
          usage:
            (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
            (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
        },
        upload: {
          data: textureBytes,
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ],
    samplers: [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createMissingTextureSamplerResourceWorld(aperture, canvasSize) {
  const scene = createTexturedUnlitWorld(aperture, canvasSize);

  return {
    ...scene,
    textures: [],
    samplers: [],
  };
}

function createInvalidTextureUploadWorld(aperture, canvasSize) {
  const scene = createTexturedUnlitWorld(aperture, canvasSize);
  const texture = scene.textures[0];

  return {
    ...scene,
    textures:
      texture === undefined
        ? []
        : [
            {
              ...texture,
              upload: {
                ...texture.upload,
                bytesPerRow: 7,
              },
            },
          ],
    invalidTextureUpload: {
      textureKey: scene.texture.textureKey,
      expectedDiagnostic: "textureResource.invalidBytesPerRow",
      bytesPerRow: 7,
    },
  };
}

function createShortTextureUploadWorld(aperture, canvasSize) {
  const scene = createTexturedUnlitWorld(aperture, canvasSize);
  const texture = scene.textures[0];

  return {
    ...scene,
    textures:
      texture === undefined
        ? []
        : [
            {
              ...texture,
              upload: {
                ...texture.upload,
                data: texture.upload.data.slice(0, 15),
              },
            },
          ],
    invalidTextureUpload: {
      textureKey: scene.texture.textureKey,
      expectedDiagnostic: "textureResource.uploadDataTooSmall",
      bytesPerRow: texture?.upload.bytesPerRow ?? 0,
      dataBytes: 15,
    },
  };
}

function createInvalidTextureRowsPerImageWorld(aperture, canvasSize) {
  const scene = createTexturedUnlitWorld(aperture, canvasSize);
  const texture = scene.textures[0];

  return {
    ...scene,
    textures:
      texture === undefined
        ? []
        : [
            {
              ...texture,
              upload: {
                ...texture.upload,
                rowsPerImage: 1,
              },
            },
          ],
    invalidTextureUpload: {
      textureKey: scene.texture.textureKey,
      expectedDiagnostic: "textureResource.invalidRowsPerImage",
      bytesPerRow: texture?.upload.bytesPerRow ?? 0,
      rowsPerImage: 1,
    },
  };
}

function createSamplerFilterAddressWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("sampler-filter-plane");
  const materialHandle = aperture.createMaterialHandle(
    "sampler-filter-address-unlit",
  );
  const textureHandle = aperture.createTextureHandle(
    "sampler-filter-address-strip",
  );
  const samplerHandle = aperture.createSamplerHandle("mirror-linear");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const expectedColor = [0.75, 0, 0.25, 1];
  const mesh = createUvRangePlaneMeshAsset({
    label: "SamplerFilterAddressPlane",
    width: 1.75,
    height: 1.05,
    uMin: 1.25,
    uMax: 2,
    v: 0.5,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "SamplerFilterAddressMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });
  const textureAsset = aperture.createTextureAsset({
    label: "SamplerFilterAddressStrip",
    dimension: "2d",
    width: 2,
    height: 1,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "MirrorLinearSampler",
    addressModeU: "mirror-repeat",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "nearest",
  });
  const textureBytes = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: [{ id: "mirror-linear-blend", x: 0.5, y: 0.5 }],
    geometry: {
      primitive: "plane",
      source: "custom mirror-repeat UV plane",
    },
    texture: {
      materialKey: aperture.assetHandleKey(materialHandle),
      textureKey,
      samplerKey,
      expectedLeftColor: [1, 0, 0, 1],
      expectedRightColor: [0, 0, 1, 1],
    },
    sampler: {
      samplerKey,
      textureKey,
      addressModeU: samplerAsset.addressModeU,
      addressModeV: samplerAsset.addressModeV,
      addressModeW: samplerAsset.addressModeW,
      magFilter: samplerAsset.magFilter,
      minFilter: samplerAsset.minFilter,
      mipmapFilter: samplerAsset.mipmapFilter,
      expectedSampleIds: ["mirror-linear-blend"],
      expectedColor,
      rejectedColors: {
        nearestMirror: [1, 0, 0, 1],
        repeatLinear: [0.25, 0, 0.75, 1],
        clamp: [0, 0, 1, 1],
      },
    },
    textures: [
      {
        resourceKey: textureKey,
        descriptor: {
          label: "SamplerFilterAddressStrip",
          size: [2, 1, 1],
          format: "rgba8unorm",
          usage:
            (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
            (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
        },
        upload: {
          data: textureBytes,
          bytesPerRow: 8,
          rowsPerImage: 1,
        },
      },
    ],
    samplers: [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createTexturedUnlitTintWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("textured-unlit-tint-plane");
  const materialHandle = aperture.createMaterialHandle("textured-unlit-tint");
  const textureHandle = aperture.createTextureHandle("tint-albedo");
  const samplerHandle = aperture.createSamplerHandle("tint-nearest-clamp");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const textureColor = [0.8, 0.6, 0.4, 1];
  const tintFactor = [0.5, 0.25, 0.75, 1];
  const expectedColor = [0.4, 0.15, 0.3, 1];
  const mesh = aperture.createPlaneMeshAsset({
    label: "TexturedUnlitTintPlane",
    width: 1.2,
    height: 1.2,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "TexturedUnlitTintMaterial",
    baseColorFactor: new Float32Array(tintFactor),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });
  const textureAsset = aperture.createTextureAsset({
    label: "TintAlbedo",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "TintNearestClampSampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
  const textureBytes = new Uint8Array([
    204, 153, 102, 255, 204, 153, 102, 255, 204, 153, 102, 255, 204, 153, 102,
    255,
  ]);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: [{ id: "tinted-texture", x: 0.5, y: 0.5 }],
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    texture: {
      materialKey: aperture.assetHandleKey(materialHandle),
      textureKey,
      samplerKey,
      expectedLeftColor: textureColor,
      expectedRightColor: textureColor,
    },
    texturedTint: {
      materialKey: aperture.assetHandleKey(materialHandle),
      textureKey,
      samplerKey,
      sampleId: "tinted-texture",
      textureColor,
      tintFactor,
      expectedColor,
    },
    textures: [
      {
        resourceKey: textureKey,
        descriptor: {
          label: "TintAlbedo",
          size: [2, 2, 1],
          format: "rgba8unorm",
          usage:
            (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
            (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
        },
        upload: {
          data: textureBytes,
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ],
    samplers: [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createSamplerVAddressWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 4 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("sampler-v-address-plane");
  const materialHandle = aperture.createMaterialHandle(
    "sampler-v-address-unlit",
  );
  const textureHandle = aperture.createTextureHandle("sampler-v-address-strip");
  const samplerHandle = aperture.createSamplerHandle("mirror-v-linear");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const expectedColor = [0.75, 0, 0.25, 1];
  const mesh = createUvRangePlaneMeshAsset({
    label: "SamplerVAddressPlane",
    width: 1.2,
    height: 1.2,
    uMin: 0.5,
    uMax: 0.5,
    vMin: 1.25,
    vMax: 2,
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "SamplerVAddressMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });
  const textureAsset = aperture.createTextureAsset({
    label: "SamplerVAddressStrip",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "MirrorVLinearSampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "mirror-repeat",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "nearest",
  });
  const textureBytes = new Uint8Array([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
  ]);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, materialHandle, [0, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: [{ id: "mirror-v-linear-blend", x: 0.5, y: 0.5 }],
    geometry: {
      primitive: "plane",
      source: "custom mirror-repeat V UV plane",
    },
    texture: {
      materialKey: aperture.assetHandleKey(materialHandle),
      textureKey,
      samplerKey,
      expectedLeftColor: [1, 0, 0, 1],
      expectedRightColor: [0, 0, 1, 1],
    },
    samplerVAddress: {
      samplerKey,
      textureKey,
      addressModeU: samplerAsset.addressModeU,
      addressModeV: samplerAsset.addressModeV,
      addressModeW: samplerAsset.addressModeW,
      magFilter: samplerAsset.magFilter,
      minFilter: samplerAsset.minFilter,
      mipmapFilter: samplerAsset.mipmapFilter,
      expectedSampleIds: ["mirror-v-linear-blend"],
      expectedColor,
      rejectedColors: {
        nearestMirror: [1, 0, 0, 1],
        repeatLinear: [0.25, 0, 0.75, 1],
        clamp: [0, 0, 1, 1],
      },
    },
    textures: [
      {
        resourceKey: textureKey,
        descriptor: {
          label: "SamplerVAddressStrip",
          size: [2, 2, 1],
          format: "rgba8unorm",
          usage:
            (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
            (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
        },
        upload: {
          data: textureBytes,
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ],
    samplers: [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [{ handle: materialHandle, asset: material }],
  };
}

function createMultiTexturedUnlitWorld(aperture, canvasSize, options = {}) {
  const sharedSampler = options.sharedSampler === true;
  const missingRightTextureAsset = options.missingRightTextureAsset === true;
  const missingRightSamplerAsset = options.missingRightSamplerAsset === true;
  const missingSharedSamplerAsset = options.missingSharedSamplerAsset === true;
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("multi-textured-plane");
  const leftMaterialHandle =
    aperture.createMaterialHandle("multi-textured-red");
  const rightMaterialHandle = aperture.createMaterialHandle(
    "multi-textured-cyan",
  );
  const leftTextureHandle = aperture.createTextureHandle("multi-red-albedo");
  const rightTextureHandle = aperture.createTextureHandle("multi-cyan-albedo");
  const leftSamplerHandle = aperture.createSamplerHandle("multi-red-nearest");
  const rightSamplerHandle = sharedSampler
    ? leftSamplerHandle
    : aperture.createSamplerHandle("multi-cyan-nearest");
  const leftColor = [0.95, 0.1, 0.08, 1];
  const rightColor = [0.05, 0.85, 0.95, 1];
  const mesh = aperture.createPlaneMeshAsset({
    label: "MultiTexturedPlane",
    width: 0.78,
    height: 0.9,
  });
  const leftMaterial = aperture.createUnlitMaterialAsset({
    label: "MultiTexturedRedMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: leftTextureHandle,
      sampler: leftSamplerHandle,
    },
  });
  const rightMaterial = aperture.createUnlitMaterialAsset({
    label: "MultiTexturedCyanMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: rightTextureHandle,
      sampler: rightSamplerHandle,
    },
  });
  const textureAsset = (label) =>
    aperture.createTextureAsset({
      label,
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
    });
  const samplerAsset = (label) =>
    aperture.createSamplerAsset({
      label,
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    });
  const leftSampler = samplerAsset("MultiRedNearestSampler");
  const rightSampler = samplerAsset("MultiCyanNearestSampler");
  const leftTextureBytes = solidTextureBytes([242, 26, 20, 255]);
  const rightTextureBytes = solidTextureBytes([13, 217, 242, 255]);
  const leftTextureKey = aperture.assetHandleKey(leftTextureHandle);
  const rightTextureKey = aperture.assetHandleKey(rightTextureHandle);
  const leftSamplerKey = aperture.assetHandleKey(leftSamplerHandle);
  const rightSamplerKey = aperture.assetHandleKey(rightSamplerHandle);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(leftMaterialHandle);
  assets.register(rightMaterialHandle);
  assets.register(leftTextureHandle);
  if (!missingRightTextureAsset) {
    assets.register(rightTextureHandle);
  }
  if (!missingSharedSamplerAsset) {
    assets.register(leftSamplerHandle);
  }
  if (!sharedSampler && !missingRightSamplerAsset) {
    assets.register(rightSamplerHandle);
  }
  assets.markReady(meshHandle, mesh);
  assets.markReady(leftMaterialHandle, leftMaterial);
  assets.markReady(rightMaterialHandle, rightMaterial);
  assets.markReady(leftTextureHandle, textureAsset("MultiRedAlbedo"));
  if (!missingRightTextureAsset) {
    assets.markReady(rightTextureHandle, textureAsset("MultiCyanAlbedo"));
  }
  if (!missingSharedSamplerAsset) {
    assets.markReady(leftSamplerHandle, leftSampler);
  }
  if (!sharedSampler && !missingRightSamplerAsset) {
    assets.markReady(rightSamplerHandle, rightSampler);
  }

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(
    aperture,
    world,
    meshHandle,
    leftMaterialHandle,
    [-0.52, 0, 0],
  );
  addPrimitiveEntity(
    aperture,
    world,
    meshHandle,
    rightMaterialHandle,
    [0.52, 0, 0],
  );

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 2,
    readbackSamplePoints: [
      { id: "left-texture-red", x: 0.34, y: 0.5 },
      { id: "right-texture-cyan", x: 0.66, y: 0.5 },
    ],
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    multiTextured: {
      ...(sharedSampler ? { sharedSamplerKey: leftSamplerKey } : {}),
      left: {
        sampleId: "left-texture-red",
        materialKey: aperture.assetHandleKey(leftMaterialHandle),
        textureKey: leftTextureKey,
        samplerKey: leftSamplerKey,
        expectedColor: leftColor,
      },
      right: {
        sampleId: "right-texture-cyan",
        materialKey: aperture.assetHandleKey(rightMaterialHandle),
        textureKey: rightTextureKey,
        samplerKey: rightSamplerKey,
        expectedColor: rightColor,
      },
    },
    textures: [
      textureUpload(leftTextureKey, "MultiRedAlbedo", leftTextureBytes),
      ...(missingRightTextureAsset
        ? []
        : [
            textureUpload(
              rightTextureKey,
              "MultiCyanAlbedo",
              rightTextureBytes,
            ),
          ]),
    ],
    samplers: [
      ...(missingSharedSamplerAsset
        ? []
        : [{ resourceKey: leftSamplerKey, asset: leftSampler }]),
      ...(sharedSampler || missingRightSamplerAsset
        ? []
        : [{ resourceKey: rightSamplerKey, asset: rightSampler }]),
    ],
    materials: [
      { handle: leftMaterialHandle, asset: leftMaterial },
      { handle: rightMaterialHandle, asset: rightMaterial },
    ],
    ...(missingRightTextureAsset
      ? {
          missingTextureAsset: {
            materialKey: aperture.assetHandleKey(rightMaterialHandle),
            textureHandle: rightTextureHandle,
            textureKey: rightTextureKey,
            samplerKey: rightSamplerKey,
          },
        }
      : {}),
    ...(missingRightSamplerAsset
      ? {
          missingSamplerAsset: {
            materialKey: aperture.assetHandleKey(rightMaterialHandle),
            textureKey: rightTextureKey,
            samplerHandle: rightSamplerHandle,
            samplerKey: rightSamplerKey,
          },
        }
      : {}),
    ...(missingSharedSamplerAsset
      ? {
          missingSharedSamplerAsset: {
            samplerHandle: leftSamplerHandle,
            samplerKey: leftSamplerKey,
          },
        }
      : {}),
  };
}

function createMultiTexturedMissingTextureAssetWorld(aperture, canvasSize) {
  return createMultiTexturedUnlitWorld(aperture, canvasSize, {
    missingRightTextureAsset: true,
  });
}

function createMultiTexturedMissingSamplerAssetWorld(aperture, canvasSize) {
  return createMultiTexturedUnlitWorld(aperture, canvasSize, {
    missingRightSamplerAsset: true,
  });
}

function createSharedSamplerMissingTextureAssetWorld(aperture, canvasSize) {
  return createMultiTexturedUnlitWorld(aperture, canvasSize, {
    sharedSampler: true,
    missingRightTextureAsset: true,
  });
}

function createSharedSamplerMissingSamplerAssetWorld(aperture, canvasSize) {
  return createMultiTexturedUnlitWorld(aperture, canvasSize, {
    sharedSampler: true,
    missingSharedSamplerAsset: true,
  });
}

function createMultiTexturedMissingTextureResourceWorld(aperture, canvasSize) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize);
  const missingTextureKey = scene.multiTextured.right.textureKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
  };
}

function createMultiTexturedMissingSamplerResourceWorld(aperture, canvasSize) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize);
  const missingSamplerKey = scene.multiTextured.right.samplerKey;

  return {
    ...scene,
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createMultiTexturedMissingTextureSamplerResourceWorld(
  aperture,
  canvasSize,
) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize);
  const missingTextureKey = scene.multiTextured.right.textureKey;
  const missingSamplerKey = scene.multiTextured.right.samplerKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createSharedSamplerMissingSamplerResourceWorld(aperture, canvasSize) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize, {
    sharedSampler: true,
  });
  const missingSamplerKey = scene.multiTextured.sharedSamplerKey;

  return {
    ...scene,
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createSharedSamplerMissingTextureResourceWorld(aperture, canvasSize) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize, {
    sharedSampler: true,
  });
  const missingTextureKey = scene.multiTextured.right.textureKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
  };
}

function createSharedSamplerMissingTextureSamplerResourceWorld(
  aperture,
  canvasSize,
) {
  const scene = createMultiTexturedUnlitWorld(aperture, canvasSize, {
    sharedSampler: true,
  });
  const missingTextureKey = scene.multiTextured.right.textureKey;
  const missingSamplerKey = scene.multiTextured.sharedSamplerKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createSharedTextureTintedWorld(aperture, canvasSize, options = {}) {
  const missingTextureAsset = options.missingTextureAsset === true;
  const missingSamplerAsset = options.missingSamplerAsset === true;
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("shared-texture-tinted-plane");
  const leftMaterialHandle = aperture.createMaterialHandle("shared-tint-warm");
  const rightMaterialHandle = aperture.createMaterialHandle("shared-tint-cool");
  const textureHandle = aperture.createTextureHandle("shared-tint-albedo");
  const samplerHandle = aperture.createSamplerHandle("shared-tint-nearest");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const textureColor = [0.8, 0.6, 0.4, 1];
  const leftTint = [1, 0.5, 0.5, 1];
  const rightTint = [0.25, 1, 0.5, 1];
  const mesh = aperture.createPlaneMeshAsset({
    label: "SharedTextureTintedPlane",
    width: 0.78,
    height: 0.9,
  });
  const material = (label, tint) =>
    aperture.createUnlitMaterialAsset({
      label,
      baseColorFactor: new Float32Array(tint),
      baseColorTexture: { texture: textureHandle, sampler: samplerHandle },
    });
  const textureAsset = aperture.createTextureAsset({
    label: "SharedTintAlbedo",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "SharedTintNearestSampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(leftMaterialHandle);
  assets.register(rightMaterialHandle);
  if (!missingTextureAsset) {
    assets.register(textureHandle);
  }
  if (!missingSamplerAsset) {
    assets.register(samplerHandle);
  }
  assets.markReady(meshHandle, mesh);
  assets.markReady(
    leftMaterialHandle,
    material("SharedTintWarmMaterial", leftTint),
  );
  assets.markReady(
    rightMaterialHandle,
    material("SharedTintCoolMaterial", rightTint),
  );
  if (!missingTextureAsset) {
    assets.markReady(textureHandle, textureAsset);
  }
  if (!missingSamplerAsset) {
    assets.markReady(samplerHandle, samplerAsset);
  }

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(
    aperture,
    world,
    meshHandle,
    leftMaterialHandle,
    [-0.52, 0, 0],
  );
  addPrimitiveEntity(
    aperture,
    world,
    meshHandle,
    rightMaterialHandle,
    [0.52, 0, 0],
  );

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 2,
    readbackSamplePoints: [
      { id: "left-shared-tint", x: 0.34, y: 0.5 },
      { id: "right-shared-tint", x: 0.66, y: 0.5 },
    ],
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    sharedTextureTinted: {
      textureKey,
      samplerKey,
      textureColor,
      left: {
        sampleId: "left-shared-tint",
        materialKey: aperture.assetHandleKey(leftMaterialHandle),
        tintFactor: leftTint,
        expectedColor: [0.8, 0.3, 0.2, 1],
      },
      right: {
        sampleId: "right-shared-tint",
        materialKey: aperture.assetHandleKey(rightMaterialHandle),
        tintFactor: rightTint,
        expectedColor: [0.2, 0.6, 0.2, 1],
      },
    },
    textures: missingTextureAsset
      ? []
      : [
          textureUpload(
            textureKey,
            "SharedTintAlbedo",
            solidTextureBytes([204, 153, 102, 255]),
          ),
        ],
    samplers: missingSamplerAsset
      ? []
      : [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [
      {
        handle: leftMaterialHandle,
        asset: material("SharedTintWarmMaterial", leftTint),
      },
      {
        handle: rightMaterialHandle,
        asset: material("SharedTintCoolMaterial", rightTint),
      },
    ],
    ...(missingTextureAsset
      ? {
          missingSharedTextureAsset: {
            textureHandle,
            textureKey,
            samplerKey,
          },
        }
      : {}),
    ...(missingSamplerAsset
      ? {
          missingSharedSamplerAsset: {
            samplerHandle,
            samplerKey,
          },
        }
      : {}),
  };
}

function createSharedTextureMissingTextureAssetWorld(aperture, canvasSize) {
  return createSharedTextureTintedWorld(aperture, canvasSize, {
    missingTextureAsset: true,
  });
}

function createSharedTextureMissingSamplerAssetWorld(aperture, canvasSize) {
  return createSharedTextureTintedWorld(aperture, canvasSize, {
    missingSamplerAsset: true,
  });
}

function createSharedTextureMissingTextureSamplerAssetWorld(
  aperture,
  canvasSize,
) {
  return createSharedTextureTintedWorld(aperture, canvasSize, {
    missingTextureAsset: true,
    missingSamplerAsset: true,
  });
}

function createSharedTextureMissingTextureResourceWorld(aperture, canvasSize) {
  const scene = createSharedTextureTintedWorld(aperture, canvasSize);
  const missingTextureKey = scene.sharedTextureTinted.textureKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
  };
}

function createSharedTextureMissingSamplerResourceWorld(aperture, canvasSize) {
  const scene = createSharedTextureTintedWorld(aperture, canvasSize);
  const missingSamplerKey = scene.sharedTextureTinted.samplerKey;

  return {
    ...scene,
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createSharedTextureMissingTextureSamplerResourceWorld(
  aperture,
  canvasSize,
) {
  const scene = createSharedTextureTintedWorld(aperture, canvasSize);
  const missingTextureKey = scene.sharedTextureTinted.textureKey;
  const missingSamplerKey = scene.sharedTextureTinted.samplerKey;

  return {
    ...scene,
    textures: scene.textures.filter(
      (texture) => texture.resourceKey !== missingTextureKey,
    ),
    samplers: scene.samplers.filter(
      (sampler) => sampler.resourceKey !== missingSamplerKey,
    ),
    missingTextureResource: {
      textureKey: missingTextureKey,
      expectedDiagnostic: "unlitBindGroupResource.missingTextureResource",
    },
    missingSamplerResource: {
      samplerKey: missingSamplerKey,
      expectedDiagnostic: "unlitBindGroupResource.missingSamplerResource",
    },
  };
}

function createMixedUnlitPipelineWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("mixed-unlit-plane");
  const factorHandle = aperture.createMaterialHandle("mixed-factor-unlit");
  const texturedHandle = aperture.createMaterialHandle("mixed-textured-unlit");
  const textureHandle = aperture.createTextureHandle("mixed-checker-albedo");
  const samplerHandle = aperture.createSamplerHandle("mixed-nearest-clamp");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const factorColor = [0.12, 0.88, 0.42, 1];
  const texturedColor = [0.09375, 0.5, 1, 1];
  const mesh = aperture.createPlaneMeshAsset({
    label: "MixedUnlitPlane",
    width: 0.78,
    height: 0.9,
  });
  const factorMaterial = aperture.createUnlitMaterialAsset({
    label: "MixedFactorUnlitMaterial",
    baseColorFactor: new Float32Array(factorColor),
  });
  const texturedMaterial = aperture.createUnlitMaterialAsset({
    label: "MixedTexturedUnlitMaterial",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });
  const textureAsset = aperture.createTextureAsset({
    label: "MixedCheckerAlbedo",
    dimension: "2d",
    width: 2,
    height: 2,
    format: "rgba8unorm",
    colorSpace: "srgb",
    semantic: "base-color",
    usage: ["sampled", "copy-dst"],
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "MixedNearestClampSampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
  const textureBytes = new Uint8Array([
    255, 32, 16, 255, 24, 128, 255, 255, 255, 32, 16, 255, 24, 128, 255, 255,
  ]);

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(factorHandle);
  assets.register(texturedHandle);
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(factorHandle, factorMaterial);
  assets.markReady(texturedHandle, texturedMaterial);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, factorHandle, [-0.52, 0, 0]);
  addPrimitiveEntity(aperture, world, meshHandle, texturedHandle, [0.52, 0, 0]);

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 2,
    readbackSamplePoints: [
      { id: "factor-green", x: 0.34, y: 0.5 },
      { id: "texture-blue", x: 0.62, y: 0.5 },
    ],
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    texture: {
      materialKey: aperture.assetHandleKey(texturedHandle),
      textureKey,
      samplerKey,
      expectedLeftColor: [1, 0.125, 0.0625, 1],
      expectedRightColor: texturedColor,
    },
    mixedPipelines: {
      factorMaterialKey: aperture.assetHandleKey(factorHandle),
      texturedMaterialKey: aperture.assetHandleKey(texturedHandle),
      expectedFactorColor: factorColor,
      expectedTexturedColor: texturedColor,
    },
    textures: [
      {
        resourceKey: textureKey,
        descriptor: {
          label: "MixedCheckerAlbedo",
          size: [2, 2, 1],
          format: "rgba8unorm",
          usage:
            (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
            (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
        },
        upload: {
          data: textureBytes,
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      },
    ],
    samplers: [{ resourceKey: samplerKey, asset: samplerAsset }],
    materials: [
      { handle: factorHandle, asset: factorMaterial },
      { handle: texturedHandle, asset: texturedMaterial },
    ],
  };
}

function createRenderLayerFilterWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("render-layer-filter-plane");
  const visibleHandle = aperture.createMaterialHandle("layer-visible-green");
  const skippedHandle = aperture.createMaterialHandle("layer-skipped-red");
  const mesh = aperture.createPlaneMeshAsset({
    label: "RenderLayerFilterPlane",
    width: 1.05,
    height: 1.05,
  });
  const visibleMaterial = aperture.createUnlitMaterialAsset({
    label: "LayerVisibleGreenMaterial",
    baseColorFactor: new Float32Array([0.12, 0.9, 0.36, 1]),
  });
  const skippedMaterial = aperture.createUnlitMaterialAsset({
    label: "LayerSkippedRedMaterial",
    baseColorFactor: new Float32Array([1, 0.06, 0.06, 1]),
  });
  const cameraLayerMask = 1;
  const visibleLayerMask = 1;
  const skippedLayerMask = 2;
  const skippedMaterialColor = [1, 0.06, 0.06, 1];

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(visibleHandle);
  assets.register(skippedHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(visibleHandle, visibleMaterial);
  assets.markReady(skippedHandle, skippedMaterial);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: cameraLayerMask,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, visibleHandle, [0, 0, 0], {
    layerMask: visibleLayerMask,
  });
  addPrimitiveEntity(aperture, world, meshHandle, skippedHandle, [0, 0, 0], {
    layerMask: skippedLayerMask,
    renderOrder: 10,
  });

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 1,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    layerFiltering: {
      cameraLayerMask,
      visibleLayerMask,
      skippedLayerMask,
      skippedMaterialKey: aperture.assetHandleKey(skippedHandle),
      skippedMaterialColor,
    },
    materials: [{ handle: visibleHandle, asset: visibleMaterial }],
  };
}

function createDepthOverlapWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("depth-overlap-plane");
  const nearHandle = aperture.createMaterialHandle("depth-near-green");
  const farHandle = aperture.createMaterialHandle("depth-far-red");
  const mesh = aperture.createPlaneMeshAsset({
    label: "DepthOverlapPlane",
    width: 1.05,
    height: 1.05,
  });
  const nearMaterial = aperture.createUnlitMaterialAsset({
    label: "DepthNearGreenMaterial",
    baseColorFactor: new Float32Array([0.16, 0.9, 0.32, 1]),
  });
  const farMaterial = aperture.createUnlitMaterialAsset({
    label: "DepthFarRedMaterial",
    baseColorFactor: new Float32Array([1, 0.08, 0.04, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(nearHandle);
  assets.register(farHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(nearHandle, nearMaterial);
  assets.markReady(farHandle, farMaterial);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, nearHandle, [0, 0, 0.3], {
    renderOrder: 0,
  });
  addPrimitiveEntity(aperture, world, meshHandle, farHandle, [0, 0, -0.3], {
    renderOrder: 10,
  });

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 2,
    readbackSamplePoints: boxReadbackSamplePoints,
    depthFormat: "depth24plus",
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    renderOrder: {
      back: 10,
      front: 0,
      expectedTopMaterial: "depth-near-green",
    },
    materials: [
      { handle: nearHandle, asset: nearMaterial },
      { handle: farHandle, asset: farMaterial },
    ],
  };
}

function createRenderOrderOverlapWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 6 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("render-order-plane");
  const backHandle = aperture.createMaterialHandle("order-back-red");
  const frontHandle = aperture.createMaterialHandle("order-front-blue");
  const mesh = aperture.createPlaneMeshAsset({
    label: "RenderOrderPlane",
    width: 1.05,
    height: 1.05,
  });
  const backMaterial = aperture.createUnlitMaterialAsset({
    label: "OrderBackRedMaterial",
    baseColorFactor: new Float32Array([1, 0.1, 0.06, 1]),
  });
  const frontMaterial = aperture.createUnlitMaterialAsset({
    label: "OrderFrontBlueMaterial",
    baseColorFactor: new Float32Array([0.08, 0.35, 1, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(backHandle);
  assets.register(frontHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(backHandle, backMaterial);
  assets.markReady(frontHandle, frontMaterial);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, backHandle, [0, 0, 0], {
    renderOrder: 0,
  });
  addPrimitiveEntity(aperture, world, meshHandle, frontHandle, [0, 0, 0], {
    renderOrder: 10,
  });

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 2,
    readbackSamplePoints: boxReadbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    renderOrder: {
      back: 0,
      front: 10,
      expectedTopMaterial: "order-front-blue",
    },
    materials: [
      { handle: backHandle, asset: backMaterial },
      { handle: frontHandle, asset: frontMaterial },
    ],
  };
}

function createMultiEntityWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 12 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("shared-primitive-plane");
  const redHandle = aperture.createMaterialHandle("red-plane");
  const greenHandle = aperture.createMaterialHandle("green-plane");
  const blueHandle = aperture.createMaterialHandle("blue-plane");
  const hiddenHandle = aperture.createMaterialHandle("hidden-magenta-plane");
  const mesh = aperture.createPlaneMeshAsset({
    label: "SharedPrimitivePlane",
    width: 0.78,
    height: 0.9,
  });
  const redMaterial = aperture.createUnlitMaterialAsset({
    label: "RedPlaneMaterial",
    baseColorFactor: new Float32Array([1, 0.16, 0.06, 1]),
  });
  const greenMaterial = aperture.createUnlitMaterialAsset({
    label: "GreenPlaneMaterial",
    baseColorFactor: new Float32Array([0.1, 0.9, 0.24, 1]),
  });
  const blueMaterial = aperture.createUnlitMaterialAsset({
    label: "BluePlaneMaterial",
    baseColorFactor: new Float32Array([0.05, 0.48, 1, 1]),
  });
  const hiddenMaterial = aperture.createUnlitMaterialAsset({
    label: "HiddenMagentaPlaneMaterial",
    baseColorFactor: new Float32Array(hiddenMaterialColor),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(redHandle);
  assets.register(greenHandle);
  assets.register(blueHandle);
  assets.register(hiddenHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(redHandle, redMaterial);
  assets.markReady(greenHandle, greenMaterial);
  assets.markReady(blueHandle, blueMaterial);
  assets.markReady(hiddenHandle, hiddenMaterial);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  addPrimitiveEntity(aperture, world, meshHandle, redHandle, [-0.82, 0, 0]);
  addPrimitiveEntity(aperture, world, meshHandle, greenHandle, [0, 0, 0]);
  addPrimitiveEntity(aperture, world, meshHandle, blueHandle, [0.82, 0, 0]);
  addPrimitiveEntity(aperture, world, meshHandle, hiddenHandle, [0, 0, 0], {
    visible: false,
  });

  return {
    world,
    assets,
    meshHandle,
    mesh,
    expectedDrawCount: 3,
    readbackSamplePoints,
    geometry: {
      primitive: "plane",
      source: "aperture.createPlaneMeshAsset",
    },
    authoredRenderableCount: 4,
    hiddenMaterialKey: aperture.assetHandleKey(hiddenHandle),
    hiddenMaterialColor,
    materials: [
      { handle: redHandle, asset: redMaterial },
      { handle: greenHandle, asset: greenMaterial },
      { handle: blueHandle, asset: blueMaterial },
    ],
  };
}

function addPrimitiveEntity(
  aperture,
  world,
  meshHandle,
  materialHandle,
  translation,
  options = {},
) {
  const entity = world.createEntity();
  const transform = aperture.createRootTransform({ translation });

  entity.addComponent(aperture.WorldTransform, transform.world);
  entity.addComponent(aperture.MeshRenderer, {
    meshId: aperture.assetHandleKey(meshHandle),
    material0Id: aperture.assetHandleKey(materialHandle),
  });
  if (options.enabled !== undefined) {
    entity.addComponent(aperture.Enabled, { value: options.enabled });
  }
  entity.addComponent(aperture.RenderLayer, { mask: options.layerMask ?? 1 });
  if (options.renderOrder !== undefined) {
    entity.addComponent(aperture.RenderOrder, { value: options.renderOrder });
  }
  entity.addComponent(aperture.Visibility, {
    visible: options.visible ?? true,
  });
}

function createUvRangePlaneMeshAsset(options) {
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const hx = width * 0.5;
  const hy = height * 0.5;
  const uMin = options.uMin ?? 0;
  const uMax = options.uMax ?? 1;
  const vMin = options.vMin ?? options.v ?? 0.5;
  const vMax = options.vMax ?? options.v ?? 0.5;
  const vertices = new Float32Array([
    -hx,
    -hy,
    0,
    0,
    0,
    1,
    uMin,
    vMin,
    hx,
    -hy,
    0,
    0,
    0,
    1,
    uMax,
    vMin,
    hx,
    hy,
    0,
    0,
    0,
    1,
    uMax,
    vMax,
    -hx,
    hy,
    0,
    0,
    0,
    1,
    uMin,
    vMax,
  ]);

  return {
    kind: "mesh",
    label: options.label ?? "UvRangePlane",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: vertices,
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2, 0, 2, 3]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "default", material: null }],
    localAabb: { min: [-hx, -hy, 0], max: [hx, hy, 0] },
    localSphere: { center: [0, 0, 0], radius: Math.hypot(hx, hy) },
  };
}

function solidTextureBytes(color) {
  return new Uint8Array([...color, ...color, ...color, ...color]);
}

function textureUpload(resourceKey, label, data) {
  return {
    resourceKey,
    descriptor: {
      label,
      size: [2, 2, 1],
      format: "rgba8unorm",
      usage:
        (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
        (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
    },
    upload: {
      data,
      bytesPerRow: 8,
      rowsPerImage: 2,
    },
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    environments: snapshot.environments.length,
    shadowRequests: snapshot.shadowRequests.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function primitiveMeshStatus(scene) {
  const mesh = scene.mesh;
  const stream = mesh.vertexStreams[0];
  const submesh = mesh.submeshes[0];

  return {
    primitive: scene.geometry?.primitive ?? "unknown",
    meshLabel: mesh.label,
    vertexStreams: mesh.vertexStreams.length,
    vertexCount: stream?.vertexCount ?? 0,
    indexCount: mesh.indexBuffer?.data.length ?? 0,
    topology: submesh?.topology ?? "unknown",
    source: scene.geometry?.source ?? "unknown",
  };
}

function visibilityStatus(scene, snapshot) {
  const skipped = snapshot.diagnostics.filter(
    (diagnostic) => diagnostic.code === "render.invisible",
  );

  return {
    authored: scene.authoredRenderableCount,
    extracted: snapshot.meshDraws.length,
    skipped: scene.authoredRenderableCount - snapshot.meshDraws.length,
    hiddenMaterialKey: scene.hiddenMaterialKey,
    hiddenMaterialColor: scene.hiddenMaterialColor,
    diagnostics: skipped.map((diagnostic) => diagnostic.code),
  };
}

function lightStatus(scene, snapshot) {
  return {
    authored: scene.light.authored,
    extracted: snapshot.lights.length,
    expectedKind: scene.light.kind,
    kinds: snapshot.lights.map((light) => light.kind),
    intensities: snapshot.lights.map((light) => light.intensity),
    ranges: snapshot.lights.map((light) => light.range),
    innerConeAngles: snapshot.lights.map((light) => light.innerConeAngle),
    outerConeAngles: snapshot.lights.map((light) => light.outerConeAngle),
    layerMasks: snapshot.lights.map((light) => light.layerMask),
    expectedDiagnostics: scene.light.expectedDiagnostics ?? [],
    diagnostics: diagnosticCodes(snapshot.diagnostics),
    ...(scene.light.transformless === undefined
      ? {}
      : { transformless: scene.light.transformless }),
  };
}

function environmentStatus(scene, snapshot) {
  return {
    authored: scene.environment.authored,
    extracted: snapshot.environments.length,
    expectedKind: scene.environment.kind,
    intensities: snapshot.environments.map(
      (environment) => environment.intensity,
    ),
    layerMasks: snapshot.environments.map(
      (environment) => environment.layerMask,
    ),
    handles: snapshot.environments.map((environment) => environment.handle),
    handleKeys: snapshot.environments.map((environment) =>
      environment.handle === null
        ? null
        : `${environment.handle.kind}:${environment.handle.id}`,
    ),
    expectedDiagnostics: scene.environment.expectedDiagnostics ?? [],
    diagnostics: diagnosticCodes(snapshot.diagnostics),
    diagnosticAssetKeys: snapshot.diagnostics
      .filter((diagnostic) => diagnostic.code.startsWith("render.environment."))
      .map((diagnostic) => diagnostic.assetKey ?? null),
    ...(scene.environment.expectedHandleKey === undefined
      ? {}
      : { expectedHandleKey: scene.environment.expectedHandleKey }),
    ...(scene.environment.transformless === undefined
      ? {}
      : { transformless: scene.environment.transformless }),
  };
}

function shadowStatus(scene, snapshot) {
  return {
    expectedRequests: scene.shadow.expectedRequests,
    requests: snapshot.shadowRequests.length,
    shadowIds: snapshot.shadowRequests.map((request) => request.shadowId),
    lightIds: snapshot.shadowRequests.map((request) => request.lightId),
    casterLayerMasks: snapshot.shadowRequests.map(
      (request) => request.casterLayerMask,
    ),
    receiverLayerMasks: snapshot.shadowRequests.map(
      (request) => request.receiverLayerMask,
    ),
    expectedCasterLayerMasks: scene.shadow.expectedCasterLayerMasks ?? [],
    expectedReceiverLayerMasks: scene.shadow.expectedReceiverLayerMasks ?? [],
    expectedDiagnostics: scene.shadow.expectedDiagnostics ?? [],
    diagnostics: diagnosticCodes(snapshot.diagnostics),
  };
}

function layerFilteringStatus(scene, snapshot) {
  const skipped = snapshot.diagnostics.filter(
    (diagnostic) => diagnostic.code === "render.layerMismatch",
  );

  return {
    ...scene.layerFiltering,
    extracted: snapshot.meshDraws.length,
    skipped: skipped.length,
    diagnostics: skipped.map((diagnostic) => diagnostic.code),
  };
}

function disabledStatus(scene, snapshot) {
  const diagnostics = snapshot.diagnostics.filter(
    (diagnostic) => diagnostic.code === "render.disabled",
  );

  return {
    ...scene.disabled,
    extracted: snapshot.meshDraws.length,
    diagnostics: diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function diagnosticCodes(diagnostics) {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

function jsonSafeDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    ...(diagnostic.assetKey === undefined
      ? {}
      : { assetKey: diagnostic.assetKey }),
    ...(diagnostic.entity === undefined ? {} : { entity: diagnostic.entity }),
  }));
}

function stepFailure(reason, message, diagnostics) {
  return { ok: false, reason, message, diagnostics };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}
