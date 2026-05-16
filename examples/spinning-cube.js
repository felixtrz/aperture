const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const spinAxis = [0.35, 1, 0.2];
const spinRadiansPerSecond = 3;

const baseStatus = {
  example: "ecs-spinning-cube",
  materialModel: "standard-direct-lit",
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
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const scene = createLitSpinningCubeScene(aperture, created.app, {
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

function createLitSpinningCubeScene(aperture, app, canvasSize) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpinningCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "spinning-cube" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeStandard",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.08,
    roughnessFactor: 0.48,
    emissiveFactor: [0.015, 0.01, 0.005],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "spinning-cube-standard",
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

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );

  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 2.8,
      layerMask: 1,
    }),
  );

  return {
    cube,
    mesh,
    material,
    materialAsset,
    authoredLights: 2,
  };
}

function startAnimation(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;

  const renderNextFrame = async (timestamp) => {
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
      label: "ecs-spinning-cube-lit",
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

    publishStatus(status);

    if (!status.ok) {
      return;
    }

    requestAnimationFrame((nextTimestamp) => {
      void renderNextFrame(nextTimestamp).catch((error) => {
        publishStatus(animationFailure(error));
      });
    });
  };

  requestAnimationFrame((timestamp) => {
    void renderNextFrame(timestamp).catch((error) => {
      publishStatus(animationFailure(error));
    });
  });
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
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const boundary = report.boundary;
  const diagnostics = [
    ...step.transform.diagnostics,
    ...report.diagnostics,
  ].map(diagnosticToJson);
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
      metallicFactor: scene.materialAsset.metallicFactor,
      roughnessFactor: scene.materialAsset.roughnessFactor,
    },
    lighting: {
      authored: scene.authoredLights,
      extracted: snapshot.lights.length,
      kinds: snapshot.lights.map((light) => light.kind),
      gpuLights: resources?.lightGpuBuffers?.lightBuffer.count ?? 0,
    },
    pipeline: {
      key: firstDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    resources: {
      materials: 1,
      bindGroups: resources?.bindGroups.length ?? 0,
      lightBindGroup: resources?.lightBindGroup === undefined ? 0 : 1,
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
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      transform: step.transform.diagnostics.length,
      render: report.diagnostics.length,
      total: diagnostics.length,
    },
    diagnostics,
  };
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The lit spinning cube scene did not extract a drawable mesh.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message:
        "The lit spinning cube standard material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The lit spinning cube frame could not be rendered.",
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

function diagnosticToJson(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return {
      code: "unknown",
      message: String(diagnostic),
    };
  }

  return {
    code: typeof diagnostic.code === "string" ? diagnostic.code : "unknown",
    message:
      typeof diagnostic.message === "string"
        ? diagnostic.message
        : JSON.stringify(diagnostic),
    ...(typeof diagnostic.severity === "string"
      ? { severity: diagnostic.severity }
      : {}),
  };
}

function animationFailure(error) {
  return failure(
    "animate",
    "animation-frame-failed",
    error instanceof Error
      ? error.message
      : "The lit spinning cube animation frame failed.",
  );
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "animating" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
