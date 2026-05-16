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
const knownScenarios = new Set([
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
  "disabled-renderable",
  "disabled-visible-peer",
  "box-primitive",
  "sphere-primitive",
  "perspective-fov-camera",
  "orthographic-camera",
  "render-layer-filter",
  "render-order-overlap",
  "depth-overlap",
]);
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
      publishStatus(
        !knownScenarios.has(scenario)
          ? unknownScenarioStatus(aperture, initialized)
          : scenario === "missing-resource"
            ? renderMissingResourceScene(aperture, initialized, {
                width: canvas.width,
                height: canvas.height,
              })
            : scenario === "missing-mesh-resource"
              ? renderMissingMeshResourceScene(aperture, initialized, {
                  width: canvas.width,
                  height: canvas.height,
                })
              : scenario === "layer-mismatch"
                ? renderLayerMismatchScene(aperture, initialized, {
                    width: canvas.width,
                    height: canvas.height,
                  })
                : scenario === "missing-mesh-asset"
                  ? renderMissingMeshAssetScene(aperture, initialized, {
                      width: canvas.width,
                      height: canvas.height,
                    })
                  : scenario === "missing-material-asset"
                    ? renderMissingMaterialAssetScene(aperture, initialized, {
                        width: canvas.width,
                        height: canvas.height,
                      })
                    : scenario === "loading-mesh-asset"
                      ? renderMeshAssetStatusScene(
                          aperture,
                          initialized,
                          {
                            width: canvas.width,
                            height: canvas.height,
                          },
                          "loading",
                        )
                      : scenario === "failed-mesh-asset"
                        ? renderMeshAssetStatusScene(
                            aperture,
                            initialized,
                            {
                              width: canvas.width,
                              height: canvas.height,
                            },
                            "failed",
                          )
                        : scenario === "loading-material-asset"
                          ? renderMaterialAssetStatusScene(
                              aperture,
                              initialized,
                              {
                                width: canvas.width,
                                height: canvas.height,
                              },
                              "loading",
                            )
                          : scenario === "failed-material-asset"
                            ? renderMaterialAssetStatusScene(
                                aperture,
                                initialized,
                                {
                                  width: canvas.width,
                                  height: canvas.height,
                                },
                                "failed",
                              )
                            : scenario === "disabled-renderable"
                              ? renderDisabledRenderableScene(
                                  aperture,
                                  initialized,
                                  {
                                    width: canvas.width,
                                    height: canvas.height,
                                  },
                                )
                              : scenario === "disabled-visible-peer"
                                ? await renderMultiEntityScene(
                                    aperture,
                                    initialized,
                                    {
                                      width: canvas.width,
                                      height: canvas.height,
                                    },
                                    readbackUsage,
                                    createDisabledVisiblePeerWorld(aperture, {
                                      width: canvas.width,
                                      height: canvas.height,
                                    }),
                                  )
                                : scenario === "box-primitive"
                                  ? await renderMultiEntityScene(
                                      aperture,
                                      initialized,
                                      {
                                        width: canvas.width,
                                        height: canvas.height,
                                      },
                                      readbackUsage,
                                      createBoxPrimitiveWorld(aperture, {
                                        width: canvas.width,
                                        height: canvas.height,
                                      }),
                                    )
                                  : scenario === "sphere-primitive"
                                    ? await renderMultiEntityScene(
                                        aperture,
                                        initialized,
                                        {
                                          width: canvas.width,
                                          height: canvas.height,
                                        },
                                        readbackUsage,
                                        createSpherePrimitiveWorld(aperture, {
                                          width: canvas.width,
                                          height: canvas.height,
                                        }),
                                      )
                                    : scenario === "perspective-fov-camera"
                                      ? await renderMultiEntityScene(
                                          aperture,
                                          initialized,
                                          {
                                            width: canvas.width,
                                            height: canvas.height,
                                          },
                                          readbackUsage,
                                          createPerspectiveFovCameraWorld(
                                            aperture,
                                            {
                                              width: canvas.width,
                                              height: canvas.height,
                                            },
                                          ),
                                        )
                                      : scenario === "orthographic-camera"
                                        ? await renderMultiEntityScene(
                                            aperture,
                                            initialized,
                                            {
                                              width: canvas.width,
                                              height: canvas.height,
                                            },
                                            readbackUsage,
                                            createOrthographicCameraWorld(
                                              aperture,
                                              {
                                                width: canvas.width,
                                                height: canvas.height,
                                              },
                                            ),
                                          )
                                        : scenario === "render-layer-filter"
                                          ? await renderMultiEntityScene(
                                              aperture,
                                              initialized,
                                              {
                                                width: canvas.width,
                                                height: canvas.height,
                                              },
                                              readbackUsage,
                                              createRenderLayerFilterWorld(
                                                aperture,
                                                {
                                                  width: canvas.width,
                                                  height: canvas.height,
                                                },
                                              ),
                                            )
                                          : scenario === "render-order-overlap"
                                            ? await renderMultiEntityScene(
                                                aperture,
                                                initialized,
                                                {
                                                  width: canvas.width,
                                                  height: canvas.height,
                                                },
                                                readbackUsage,
                                                createRenderOrderOverlapWorld(
                                                  aperture,
                                                  {
                                                    width: canvas.width,
                                                    height: canvas.height,
                                                  },
                                                ),
                                              )
                                            : scenario === "depth-overlap"
                                              ? await renderMultiEntityScene(
                                                  aperture,
                                                  initialized,
                                                  {
                                                    width: canvas.width,
                                                    height: canvas.height,
                                                  },
                                                  readbackUsage,
                                                  createDepthOverlapWorld(
                                                    aperture,
                                                    {
                                                      width: canvas.width,
                                                      height: canvas.height,
                                                    },
                                                  ),
                                                )
                                              : await renderMultiEntityScene(
                                                  aperture,
                                                  initialized,
                                                  {
                                                    width: canvas.width,
                                                    height: canvas.height,
                                                  },
                                                  readbackUsage,
                                                ),
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

  const pipelineResource = await aperture.createUnlitRenderPipelineResource({
    device: initialized.device,
    colorFormat: initialized.format,
    ...(scene.depthFormat === undefined
      ? {}
      : { depthFormat: scene.depthFormat }),
    batchKey: firstDraw.batchKey,
  });

  if (!pipelineResource.valid || pipelineResource.resource === null) {
    return {
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The unlit render pipeline could not be created.",
      ),
      diagnostics: pipelineResource.diagnostics,
      extraction: snapshotCounts(snapshot),
    };
  }

  const pipeline = pipelineResource.resource.pipeline;

  if (typeof pipeline.getBindGroupLayout !== "function") {
    return failure(
      "pipeline-layouts",
      "pipeline-layouts-unavailable",
      "The unlit pipeline does not expose bind group layouts.",
    );
  }

  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = aperture.createMultiMaterialUnlitFrameGpuResources({
    device: initialized.device,
    mesh: scene.mesh,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    materials: scene.materials.map((entry) => entry.asset),
    layouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `unlit/pipeline-layout-${group}`,
      layout: pipeline.getBindGroupLayout(group),
    })),
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The ECS multi-entity frame resources could not be uploaded.",
      ),
      diagnostics: frameResources.diagnostics,
      extraction: snapshotCounts(snapshot),
    };
  }

  const meshResourceKey = frameResources.resources.mesh.resourceKey;
  const materialResourceKeys = new Map(
    scene.materials.map((entry, index) => [
      aperture.assetHandleKey(entry.handle),
      frameResources.resources.materials[index]?.resourceKey ?? null,
    ]),
  );
  const pipelineResult = {
    ok: true,
    status: "miss",
    key: firstDraw.batchKey.pipelineKey,
    pipeline,
    diagnostics: [],
  };
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
    pipelines: [pipelineResult],
    bindGroups: frameResources.resources.bindGroups,
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
      bindGroups: frameResources.resources.bindGroups.length,
    },
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
    geometry: primitiveMeshStatus(scene),
    ...(scene.camera === undefined ? {} : { camera: scene.camera }),
    ...(scene.renderOrder === undefined
      ? {}
      : { renderOrder: scene.renderOrder }),
    ...(scene.depthFormat === undefined
      ? {}
      : { depth: { format: scene.depthFormat } }),
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
      resources: frameResources.diagnostics.length,
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
    availableScenarios: [...knownScenarios],
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

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
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
