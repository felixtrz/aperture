import {
  addContentShowcaseText,
  contentShowcaseClearColor,
  contentShowcaseSpriteProofs,
  registerContentShowcaseScene,
} from "./content-showcase-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The content showcase worker raised an error.",
    location: {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    },
  });
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-unhandled-rejection",
    message: messageFromError(event.reason),
  });
  event.preventDefault();
});

self.onmessage = (message) => {
  void handleMessage(message.data);
};

async function handleMessage(data) {
  try {
    const aperture = await loadAperture();

    if (data?.type === "init") {
      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
      );
      self.postMessage({
        type: "ready",
        scene: {
          blockedDraw: entityRef(scene.blockedDraw),
          uiTarget: entityRef(scene.uiTarget),
          particleEffectKey: scene.particles.effectKey,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Content showcase worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(1 / 60, frame / 60);

      const baseSnapshot = scene.app.extract(frame);
      const snapshot = addContentShowcaseText(aperture, scene, baseSnapshot);
      const message = {
        type: "snapshot",
        frame,
        clearColor: contentShowcaseClearColor,
        snapshot,
        workerStep: {
          views: snapshot.views.length,
          meshDraws: snapshot.meshDraws.length,
          spriteDraws: snapshot.spriteDraws?.length ?? 0,
          quadInstances:
            (snapshot.quads?.instanceFloats.length ?? 0) /
            (snapshot.quads?.instanceFloatStride ?? 1),
          quadBatches: snapshot.quadBatches?.length ?? 0,
          uiNodes: snapshot.uiNodes?.length ?? 0,
          uiHitRegions: snapshot.uiHitRegions?.length ?? 0,
          particleEmitters: snapshot.particleEmitters?.length ?? 0,
          diagnostics: snapshot.diagnostics.length,
        },
      };

      self.postMessage(
        message,
        aperture.renderSnapshotTransferList(message.snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= Promise.all([
    import("@aperture-engine/simulation"),
    import("@aperture-engine/render"),
    import("@aperture-engine/runtime"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 24 },
  });
  const registered = registerContentShowcaseScene(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      fovYDegrees: 55,
      near: 0.1,
      far: 100,
      clearColor: contentShowcaseClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [2.2, -0.2, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    }),
    aperture.withMesh(registered.mesh.mesh),
    aperture.withMaterial(registered.mesh.material),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
  );

  let blockedDraw = null;
  for (const [index, proof] of contentShowcaseSpriteProofs().entries()) {
    const sprite = app.spawn(
      aperture.withTransform({ translation: proof.translation }),
      aperture.withSprite({
        texture: registered.sprites.texture,
        sampler: registered.sprites.sampler,
        size: proof.size,
        color: [1, 1, 1, 1],
        uvRect: proof.uvRect,
        pivot: proof.pivot,
        rotation: proof.rotation,
        billboardMode: proof.billboardMode,
        sizeMode: proof.sizeMode,
      }),
      aperture.withRenderLayer(1),
      aperture.withRenderOrder(index + 1),
    );

    if (proof.id === "rotation-pivot") {
      blockedDraw = sprite;
    }
  }

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withParticleEmitter({
      effect: registered.particles.effect,
      capacity: registered.expected.particleCapacity,
      seed: 2026,
      resetEpoch: 0,
      timeScale: 1,
      simulationSpace: aperture.ParticleSimulationSpace.World,
      boundsRadius: 2.2,
    }),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(3),
  );

  const screen = app.spawn(
    aperture.withUiScreen({
      width: canvasSize.width,
      height: canvasSize.height,
      layerMask: 1,
    }),
  );
  const panel = app.spawn(
    aperture.withTransform({ parent: screen }),
    aperture.withUiNode({
      x: 610,
      y: 76,
      width: 230,
      height: 150,
      layoutMode: "absolute",
      zIndex: 8,
      clip: true,
    }),
    aperture.withUiPanel({ color: [0.11, 0.17, 0.25, 0.94] }),
    aperture.withUiHitTarget({
      blocksInput: true,
      cursor: "pointer",
      priority: 20,
    }),
  );

  app.spawn(
    aperture.withTransform({ parent: panel }),
    aperture.withUiNode({ x: 18, y: 24, width: 56, height: 56, zIndex: 1 }),
    aperture.withUiImage({
      texture: registered.ui.texture,
      sampler: registered.ui.sampler,
      color: [1, 1, 1, 1],
      uvRect: [0, 0, 1, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ parent: panel }),
    aperture.withUiNode({ x: 86, y: 42, width: 120, height: 52, zIndex: 2 }),
    aperture.withUiText({
      text: "AV",
      fontAtlas: registered.ui.font,
      fontSize: 42,
      maxWidth: 120,
      color: [0.95, 0.98, 1, 1],
    }),
  );

  return {
    ...registered,
    app,
    blockedDraw,
    uiTarget: panel,
    canvasSize,
  };
}

function entityRef(entity) {
  return {
    index: entity.index,
    generation: entity.generation,
  };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
