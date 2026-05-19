const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const sampleGlbUrl = new URL("./assets/cube.glb", globalThis.location.href);

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
      const scene = await createGlbViewerScene(aperture, created.app, canvas);

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

async function createGlbViewerScene(aperture, app, targetCanvas) {
  const loaded = await aperture.loadGlbFromUri(sampleGlbUrl.href, {
    keyPrefix: "viewer",
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const importReport = loaded.loader?.glbImportReport.importReport ?? null;

  if (!loaded.ok || importReport === null) {
    throw new Error(
      loaded.diagnostics[0]?.message ?? "Sample GLB did not load.",
    );
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error("Sample GLB did not produce renderable source assets.");
  }

  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
  const sourceRegistration = registration.sourceRegistration;
  const meshRegistration = registration.meshRegistration;

  if (sourceRegistration === null || meshRegistration === null) {
    throw new Error("Sample GLB source registration was not produced.");
  }

  const primitiveMaterials =
    aperture.createGltfPrimitiveMaterialResolutionReport({
      primitiveReport: importReport.meshPrimitive,
      registrationReport: sourceRegistration,
      keyPrefix: "viewer",
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

  return {
    loaded,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
    orbit,
    cameraEntity,
  };
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
    source: {
      url: sampleGlbUrl.pathname,
      ok: scene.loaded.ok,
      byteLength: scene.loaded.byteLength,
      status: scene.loaded.loader?.status ?? null,
      outputSummary: scene.loaded.loader?.outputSummary ?? null,
      diagnostics: scene.loaded.diagnostics,
    },
    gltf: {
      registration: {
        valid: scene.registration.valid,
        diagnostics: scene.registration.diagnostics.length,
      },
      primitiveMaterials: {
        valid: scene.primitiveMaterials.valid,
        resolved: scene.primitiveMaterials.resolved.length,
        diagnostics: scene.primitiveMaterials.diagnostics.length,
      },
      commandPlan: {
        valid: scene.commandPlan.valid,
        commands: scene.commandPlan.commands.length,
        dependencies: scene.commandPlan.dependencies.length,
      },
      replay: {
        valid: scene.replay.valid,
        created: scene.replay.created.length,
        diagnostics: scene.replay.diagnostics.length,
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
