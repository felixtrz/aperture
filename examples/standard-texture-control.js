const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const textureColor = [0.09375, 0.5, 1, 1];
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "ready";

const baseStatus = {
  example: "standard-texture-control",
  scenario,
  materialModel: "standard-direct-lit-texture-control",
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
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 12 },
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas, scenario);
      const report = await created.app.render({
        frame: 1,
        clearColor,
        label: "standard-texture-control-app",
      });

      publishStatus(createStatus(aperture, created.app, scene, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-texture-control-failed",
      error instanceof Error
        ? error.message
        : "Standard texture control example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas, selectedScenario) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardTextureControlPlane",
      width: 0.78,
      height: 0.9,
    }),
    { id: "standard-texture-control-plane" },
  );
  const texture = aperture.createTextureHandle("standard-control-base-color");
  const sampler = aperture.createSamplerHandle("standard-control-nearest");
  const textureKey = aperture.assetHandleKey(texture);
  const samplerKey = aperture.assetHandleKey(sampler);

  if (selectedScenario !== "missing-texture") {
    app.assets.register(texture);
    app.assets.markReady(
      texture,
      aperture.createTextureAsset({
        label: "StandardControlBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: solidTextureBytes([24, 128, 255, 255]),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
  }
  app.assets.register(sampler);
  app.assets.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: "StandardControlNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    }),
  );

  const scalar = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlScalar",
      baseColorFactor: new Float32Array(scalarColor),
      metallicFactor: 0,
      roughnessFactor: 0.8,
    }),
    { id: "standard-control-scalar" },
  );
  const textured = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlTextured",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      baseColorTexture: { texture, sampler },
      metallicFactor: 0,
      roughnessFactor: 0.8,
    }),
    { id: "standard-control-textured" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.5] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.2, 0.8, 1.5] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: 1.15,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.52, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(scalar),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.52, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(textured),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    mesh,
    scalar,
    textured,
    texture,
    sampler,
    textureKey,
    samplerKey,
    expectedFailure:
      selectedScenario === "missing-texture"
        ? {
            diagnostic: "render.standardMaterialTexture.textureNotReady",
          }
        : null,
  };
}

function createStatus(aperture, app, scene, report) {
  const snapshot = report.snapshot;
  const pipelineKeys = snapshot.meshDraws.map(
    (draw) => draw.batchKey.pipelineKey,
  );

  return {
    ...baseStatus,
    ok: scene.expectedFailure === null ? report.ok : !report.ok,
    phase:
      scene.expectedFailure === null
        ? report.ok
          ? "rendered"
          : "render"
        : "expected-failure",
    ...(scene.expectedFailure === null
      ? {}
      : {
          expectedFailure: true,
          expectedDiagnostic: scene.expectedFailure.diagnostic,
        }),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
    standardTexture: {
      scalarMaterialKey: aperture.assetHandleKey(scene.scalar),
      texturedMaterialKey: aperture.assetHandleKey(scene.textured),
      textureKey: scene.textureKey,
      samplerKey: scene.samplerKey,
      expectedScalarColor: scalarColor,
      expectedTextureColor: textureColor,
      samples: {
        scalar: { x: 0.34, y: 0.5 },
        textured: { x: 0.62, y: 0.5 },
      },
    },
    resources: {
      textureResourcesCreated: report.resourceReuse.textureResourcesCreated,
      samplerResourcesCreated: report.resourceReuse.samplerResourcesCreated,
      materialBuffersCreated: report.resourceReuse.materialBuffersCreated,
      bindGroupsCreated: report.resourceReuse.materialBindGroupsCreated,
    },
    pipelines: {
      keys: pipelineKeys,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    diagnosticCodes: [...snapshot.diagnostics, ...report.diagnostics].map(
      (diagnostic) => diagnostic.code,
    ),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
    })),
  };
}

function solidTextureBytes(color) {
  return new Uint8Array([...color, ...color, ...color, ...color]);
}

function failure(reason, message, extra = {}) {
  return {
    ...baseStatus,
    ok: false,
    reason,
    message,
    ...extra,
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
