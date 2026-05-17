const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const playButton = document.querySelector("#matcap-play");
const pauseButton = document.querySelector("#matcap-pause");
const clearColor = [0.78, 0.82, 0.86, 1];
const spinAxis = [0.2, 1, 0.35];
const spinRadiansPerSecond = 2.4;

const baseStatus = {
  example: "matcap-app",
  materialModel: "matcap-app-facade",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 12 },
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const scene = createMatcapAppScene(aperture, created.app, {
        width: canvas.width,
        height: canvas.height,
      });

      startAnimation(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

function createMatcapAppScene(aperture, app, canvasSize) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "MatcapAppCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "matcap-app-cube" },
  );
  const texture = aperture.createTextureHandle("matcap-app-studio");
  const sampler = aperture.createSamplerHandle("matcap-app-linear");

  app.assets.register(texture);
  app.assets.markReady(
    texture,
    aperture.createTextureAsset({
      label: "MatcapAppStudioTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 210, 245, 255, 190, 230, 255, 255, 110, 135, 180, 255, 40, 52,
          76, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(sampler);
  app.assets.markReady(
    sampler,
    aperture.createSamplerAsset({ label: "MatcapAppLinearSampler" }),
  );

  const materialAsset = aperture.createMatcapMaterialAsset({
    label: "MatcapAppMaterial",
    baseColorFactor: new Float32Array([0.92, 0.78, 1, 1]),
    matcapTexture: { texture, sampler },
  });
  const material = assets.materials.matcap.add(materialAsset, {
    id: "matcap-app-material",
  });

  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cube = app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: spinRadiansPerSecond,
      axis: spinAxis,
    }),
  );

  return {
    cube,
    mesh,
    material,
    materialAsset,
    texture,
    sampler,
  };
}

function startAnimation(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;
  let running = true;
  let animationRequest = null;
  let latestStatus = null;

  const scheduleNextFrame = () => {
    animationRequest = requestAnimationFrame((timestamp) => {
      void renderNextFrame(timestamp).catch((error) => {
        publishStatus(animationFailure(error));
      });
    });
  };

  const pause = () => {
    if (!running) {
      return;
    }

    running = false;
    previousTimestamp = null;

    if (animationRequest !== null) {
      cancelAnimationFrame(animationRequest);
      animationRequest = null;
    }

    publishStatus(pausedStatus(latestStatus));
  };

  const play = () => {
    if (running) {
      return;
    }

    running = true;
    previousTimestamp = null;
    updatePlaybackControls(running);
    scheduleNextFrame();
  };

  if (playButton !== null) {
    playButton.addEventListener("click", play);
  }

  if (pauseButton !== null) {
    pauseButton.addEventListener("click", pause);
  }

  updatePlaybackControls(running);

  const renderNextFrame = async (timestamp) => {
    animationRequest = null;

    if (!running) {
      return;
    }

    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
      previousTimestamp = timestamp;
    }

    frame += 1;

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const deltaSeconds =
      previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;

    previousTimestamp = timestamp;

    const step = app.step(deltaSeconds, elapsedSeconds);
    const report = await app.render({
      frame,
      clearColor,
      label: "matcap-app-facade",
    });
    const status = createFrameStatus(
      aperture,
      app,
      scene,
      step,
      report,
      frame,
      elapsedSeconds,
    );

    latestStatus = status;
    publishStatus(status);

    if (!status.ok || !running) {
      return;
    }

    scheduleNextFrame();
  };

  scheduleNextFrame();
}

function createFrameStatus(
  aperture,
  app,
  scene,
  step,
  report,
  frame,
  elapsedSeconds,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const matcapResources = firstFamilyResource(resources, "matcap");
  const boundary = report.boundary;
  const reason = firstFailureReason(report, firstDraw, resources);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: snapshotCounts(snapshot),
    material: {
      kind: scene.materialAsset.kind,
      key: aperture.assetHandleKey(scene.material),
      baseColorFactor: Array.from(scene.materialAsset.baseColorFactor),
      matcapTexture: aperture.assetHandleKey(scene.texture),
      matcapSampler: aperture.assetHandleKey(scene.sampler),
    },
    pipeline: {
      key: firstDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    resources: {
      materials: familyResourceCount(resources, "matcap", 1),
      bindGroups: resources?.bindGroups.length ?? 0,
      materialBindGroup:
        matcapResources?.materialBindGroup === undefined ? 0 : 1,
      reuse: report.resourceReuse,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    command: {
      commands: boundary?.execution?.commandCount ?? 0,
      drawCount: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCount: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    submission: {
      commandBuffers: boundary?.submit?.submitted ?? 0,
      drawCalls: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCalls: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    execution: {
      running: true,
      ecs: "stepping",
    },
    animation: {
      frames: frame,
      elapsedSeconds: Number(elapsedSeconds.toFixed(4)),
      rotationRadians: Number(
        (elapsedSeconds * spinRadiansPerSecond).toFixed(4),
      ),
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
      transformDiagnostics: step.transform.diagnostics.length,
    },
    report: reportJson,
  };
}

function firstFamilyResource(resources, family) {
  const list = resources?.[family];

  if (Array.isArray(list) && list.length > 0) {
    return list[0];
  }

  return resources;
}

function familyResourceCount(resources, family, fallback) {
  const list = resources?.[family];

  return Array.isArray(list) ? list.length : fallback;
}

function pausedStatus(status) {
  updatePlaybackControls(false);

  return {
    ...(status ?? { ...baseStatus, ok: true }),
    ok: true,
    phase: "paused",
    execution: {
      running: false,
      ecs: "paused",
    },
  };
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The Matcap app scene did not extract a drawable mesh.",
    };
  }

  if (resources === null) {
    return {
      reason: "matcap-resources-unavailable",
      message: "The Matcap app material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The Matcap app frame could not be rendered.",
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function animationFailure(error) {
  return failure(
    "animate",
    "animation-frame-failed",
    error instanceof Error
      ? error.message
      : "The Matcap app animation frame failed.",
  );
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent =
      status.phase === "paused" ? "paused" : status.ok ? "animating" : "failed";
    stateElement.dataset.state =
      status.phase === "paused" ? "paused" : status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function updatePlaybackControls(running) {
  if (playButton !== null) {
    playButton.disabled = running;
    playButton.setAttribute("aria-pressed", running ? "true" : "false");
  }

  if (pauseButton !== null) {
    pauseButton.disabled = !running;
    pauseButton.setAttribute("aria-pressed", running ? "false" : "true");
  }
}
