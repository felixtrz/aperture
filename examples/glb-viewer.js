const canvas = document.querySelector("#aperture-canvas");
const assetSelect = document.querySelector("#glb-asset-select");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const sampleAssets = [
  {
    id: "cube",
    label: "Mint cube",
    url: new URL("./assets/cube.glb", globalThis.location.href),
  },
  {
    id: "slab",
    label: "Amber slab",
    url: new URL("./assets/amber-slab.glb", globalThis.location.href),
  },
  {
    id: "pillar",
    label: "Sapphire pillar",
    url: new URL("./assets/sapphire-pillar.glb", globalThis.location.href),
  },
];

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
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = createGlbViewerScene(aperture, created.app, canvas);

      await loadSelectedAsset(aperture, created.app, scene);
      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "glb-viewer-failed",
      error instanceof Error ? error.message : "GLB viewer failed.",
    ),
  );
}

function createGlbViewerScene(aperture, app, targetCanvas) {
  const orbit = createOrbitControls(targetCanvas);
  const cameraEntity = app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.4] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  updateOrbitCamera(aperture, cameraEntity, orbit);

  const scene = {
    asset: sampleAssets[0],
    loadState: null,
    loadSequence: 0,
    active: null,
    orbit,
    cameraEntity,
  };

  if (assetSelect !== null) {
    for (const asset of sampleAssets) {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = asset.label;
      assetSelect.append(option);
    }

    assetSelect.addEventListener("change", () => {
      loadSelectedAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB asset load failed.",
        );
      });
    });
  }

  return scene;
}

async function loadSelectedAsset(aperture, app, scene) {
  const asset =
    sampleAssets.find((entry) => entry.id === assetSelect?.value) ??
    sampleAssets[0];
  const loadSequence = scene.loadSequence + 1;
  const keyPrefix = `viewer-${asset.id}-${loadSequence}`;

  scene.loadSequence = loadSequence;
  scene.asset = asset;
  scene.loadState = {
    ok: true,
    phase: "loading",
    asset: {
      id: asset.id,
      label: asset.label,
      url: asset.url.pathname,
    },
  };
  destroyActiveScene(scene);

  const loaded = await aperture.loadGlbFromUri(asset.url.href, {
    keyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const importReport = loaded.loader?.glbImportReport.importReport ?? null;

  if (scene.loadSequence !== loadSequence) {
    return;
  }

  if (!loaded.ok || importReport === null) {
    throw new Error(loaded.diagnostics[0]?.message ?? "GLB did not load.");
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error("GLB did not produce renderable source assets.");
  }

  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
  const sourceRegistration = registration.sourceRegistration;
  const meshRegistration = registration.meshRegistration;

  if (sourceRegistration === null || meshRegistration === null) {
    throw new Error("GLB source registration was not produced.");
  }

  const primitiveMaterials =
    aperture.createGltfPrimitiveMaterialResolutionReport({
      primitiveReport: importReport.meshPrimitive,
      registrationReport: sourceRegistration,
      keyPrefix,
    });
  const commandPlan = aperture.createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
  });
  const replay = aperture.applyGltfEcsCommandPlanToApp({
    app,
    plan: commandPlan,
  });

  scene.active = {
    asset,
    keyPrefix,
    loaded,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
  };
  scene.loadState = null;
}

function destroyActiveScene(scene) {
  if (scene.active === null) {
    return;
  }

  for (const entity of scene.active.replay.entitiesByKey.values()) {
    entity.destroy();
  }

  scene.active = null;
}

function startRendering(aperture, app, scene) {
  let frame = 0;

  const render = async () => {
    try {
      frame += 1;
      updateOrbitCamera(aperture, scene.cameraEntity, scene.orbit);
      const step = app.step(0, frame / 60);
      const report = await app.render({
        frame,
        clearColor,
        label: "glb-viewer-app",
      });

      publishStatus(createStatus(aperture, app, scene, step, report, frame));
      requestAnimationFrame(render);
    } catch (error) {
      publishStatus(
        failure(
          "glb-viewer-render-failed",
          error instanceof Error ? error.message : "GLB viewer render failed.",
        ),
      );
    }
  };

  requestAnimationFrame(render);
}

function createStatus(aperture, app, scene, step, report, frame) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const active = scene.active;

  return {
    example: "glb-viewer",
    ok: report.ok,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    frame,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    selectedAsset: {
      id: scene.asset.id,
      label: scene.asset.label,
      url: scene.asset.url.pathname,
      loading: scene.loadState?.phase === "loading",
    },
    source: {
      url: active?.asset.url.pathname ?? scene.asset.url.pathname,
      ok: active?.loaded.ok ?? false,
      byteLength: active?.loaded.byteLength ?? null,
      status: active?.loaded.loader?.status ?? null,
      outputSummary: active?.loaded.loader?.outputSummary ?? null,
      diagnostics: active?.loaded.diagnostics ?? [],
    },
    gltf: {
      registration: {
        valid: active?.registration.valid ?? false,
        diagnostics: active?.registration.diagnostics.length ?? 0,
      },
      primitiveMaterials: {
        valid: active?.primitiveMaterials.valid ?? false,
        resolved: active?.primitiveMaterials.resolved.length ?? 0,
        diagnostics: active?.primitiveMaterials.diagnostics.length ?? 0,
      },
      commandPlan: {
        valid: active?.commandPlan.valid ?? false,
        commands: active?.commandPlan.commands.length ?? 0,
        dependencies: active?.commandPlan.dependencies.length ?? 0,
      },
      replay: {
        valid: active?.replay.valid ?? false,
        created: active?.replay.created.length ?? 0,
        diagnostics: active?.replay.diagnostics.length ?? 0,
      },
    },
    orbit: {
      yaw: Number(scene.orbit.yaw.toFixed(4)),
      distance: Number(scene.orbit.distance.toFixed(3)),
      dragging: scene.orbit.dragging,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    draw: {
      packages: report.counts.drawPackages,
      drawCalls: reportJson.counts.drawCalls,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    report: reportJson,
    step,
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
  };
}

function createOrbitControls(targetCanvas) {
  const state = {
    yaw: 0,
    distance: 3.4,
    dragging: false,
    lastX: 0,
  };

  targetCanvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    targetCanvas.setPointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }

    const deltaX = event.clientX - state.lastX;
    state.lastX = event.clientX;
    state.yaw = wrapRadians(state.yaw - deltaX * 0.006);
  });
  targetCanvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    targetCanvas.releasePointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });
  globalThis.addEventListener("pointerup", () => {
    state.dragging = false;
  });
  targetCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.distance = clamp(state.distance + event.deltaY * 0.004, 1.8, 6);
    },
    { passive: false },
  );

  return state;
}

function updateOrbitCamera(aperture, cameraEntity, orbit) {
  const x = Math.sin(orbit.yaw) * orbit.distance;
  const z = Math.cos(orbit.yaw) * orbit.distance;
  const halfYaw = orbit.yaw * 0.5;

  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set([x, 0, z]);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set([0, Math.sin(halfYaw), 0, Math.cos(halfYaw)]);
}

function wrapRadians(value) {
  const twoPi = Math.PI * 2;
  return ((((value + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    example: "glb-viewer",
    ok: false,
    phase: "initialize",
    reason,
    message,
  };
}
