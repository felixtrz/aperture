const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.015, 0.02, 0.027, 1];
const materialNames = ["unlit", "standard-pbr", "matcap"];
const spinAxis = [0.35, 1, 0.2];

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
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas);

      startAnimation(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "showcase-failed",
      error instanceof Error ? error.message : "Material showcase failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "ShowcaseCube" }),
    { id: "showcase-cube" },
  );
  const unlit = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "ShowcaseUnlit",
      baseColorFactor: new Float32Array([1, 0.42, 0.18, 1]),
    }),
    { id: "showcase-unlit" },
  );
  const standardBaseColorTexture = aperture.createTextureHandle(
    "showcase-standard-base-color",
  );
  const standardBaseColorSampler = aperture.createSamplerHandle(
    "showcase-standard-base-color-linear",
  );

  app.assets.register(standardBaseColorTexture);
  app.assets.markReady(
    standardBaseColorTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardBaseColorTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          92, 255, 148, 255, 30, 204, 220, 255, 190, 255, 116, 255, 42, 124,
          255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(standardBaseColorSampler);
  app.assets.markReady(
    standardBaseColorSampler,
    aperture.createSamplerAsset({ label: "ShowcaseStandardBaseColorSampler" }),
  );

  const standard = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ShowcaseStandard",
      baseColorFactor: new Float32Array([0.85, 1, 0.9, 1]),
      baseColorTexture: {
        texture: standardBaseColorTexture,
        sampler: standardBaseColorSampler,
      },
      metallicFactor: 0.18,
      roughnessFactor: 0.36,
      emissiveFactor: [0.01, 0.035, 0.018],
    }),
    { id: "showcase-standard" },
  );
  const matcapTexture = aperture.createTextureHandle("showcase-matcap");
  const matcapSampler = aperture.createSamplerHandle("showcase-matcap-linear");

  app.assets.register(matcapTexture);
  app.assets.markReady(
    matcapTexture,
    aperture.createTextureAsset({
      label: "ShowcaseMatcapTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48, 72,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(matcapSampler);
  app.assets.markReady(
    matcapSampler,
    aperture.createSamplerAsset({ label: "ShowcaseMatcapSampler" }),
  );

  const matcap = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "ShowcaseMatcap",
      baseColorFactor: new Float32Array([1, 0.54, 0.95, 1]),
      matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
    }),
    { id: "showcase-matcap" },
  );

  app.registerSystem(aperture.SpinSystem);
  app.spawn(
    aperture.withTransform({ translation: [0, 0.16, 4.9] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cubes = [
    spawnCube(aperture, app, mesh, unlit, [-1.45, 0, 0], 0.74),
    spawnCube(aperture, app, mesh, standard, [0, 0, 0], 0.92),
    spawnCube(aperture, app, mesh, matcap, [1.45, 0, 0], 0.82),
  ];

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
    canvas: targetCanvas,
    cubes,
    mesh,
    materials: { unlit, standard, matcap },
    standardBaseColorTexture,
    standardBaseColorSampler,
    matcapTexture,
    matcapSampler,
  };
}

function spawnCube(aperture, app, mesh, material, translation, speed) {
  return app.spawn(
    aperture.withTransform({ translation }),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: speed,
      axis: spinAxis,
    }),
  );
}

function startAnimation(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;

  const render = async (timestamp) => {
    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
      previousTimestamp = timestamp;
    }

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const deltaSeconds =
      previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;

    previousTimestamp = timestamp;
    frame += 1;
    app.step(deltaSeconds, elapsedSeconds);

    const report = await app.render({
      frame,
      clearColor,
      label: "materials-showcase-app",
    });

    publishFrameStatus(aperture, app, scene, report, frame, elapsedSeconds);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

function publishFrameStatus(
  aperture,
  app,
  scene,
  report,
  frame,
  elapsedSeconds,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  publishStatus({
    example: "materials-showcase",
    ok: report.ok,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    materialModel: "app-facade-built-ins",
    materialModels: materialNames,
    frame,
    animation: {
      elapsedSeconds,
      spinningCubes: scene.cubes.length,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    resources: {
      materials: scene.cubes.length,
      bindGroups:
        report.resources?.resources === null ||
        report.resources?.resources === undefined
          ? 0
          : report.resources.resources.bindGroups.length,
      reuse: report.resourceReuse,
    },
    draw: {
      cubes: scene.cubes.length,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
      indexCount: 36,
    },
    report: reportJson,
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
  });
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
    example: "materials-showcase",
    ok: false,
    phase: "initialize",
    reason,
    message,
    ...extra,
  };
}
