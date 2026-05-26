const meshId = "sab-cube";
const materialId = "sab-cube-debug-normal";
const clearColor = [0.018, 0.024, 0.034, 1];
const spinAxis = [0.45, 1, 0.15];
const spinRadiansPerSecond = 2.7;

let apertureModulePromise = null;
let scene = null;
let sharedTransport = null;
let packetRegistry = null;
let frameTimer = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
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
  void handleMessage(message);
};

async function handleMessage(message) {
  const data = message.data;

  try {
    const aperture = await loadAperture();

    if (data?.type === "start") {
      const transport = data.options?.transport;

      if (transport?.mode !== "shared-array-buffer") {
        throw new Error(
          "SAB cube requires a SharedArrayBuffer transport start payload.",
        );
      }

      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
      );
      sharedTransport = aperture.createSharedSnapshotTransportViews(transport);
      packetRegistry = aperture.createSnapshotPacketRegistry();
      startFrameLoop(aperture);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-start-failed",
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
    worldOptions: { entityCapacity: 8 },
  });
  const assets = registerWorkerCubeAssets(aperture, app.assets);

  app.registerSystem(aperture.SpinSystem);
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.2] }),
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
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: spinRadiansPerSecond,
      axis: spinAxis,
    }),
  );

  return {
    app,
    cube,
    mesh: assets.mesh,
    material: assets.material,
    materialAsset: assets.materialAsset,
    firstTimestamp: null,
    previousTimestamp: null,
    frame: 0,
  };
}

function registerWorkerCubeAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SabSnapshotCube",
      width: 1.55,
      height: 1.55,
      depth: 1.55,
    }),
    { id: meshId },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "SabSnapshotNormals",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: materialId,
  });

  return { mesh, material, materialAsset };
}

function startFrameLoop(aperture) {
  if (frameTimer !== null) {
    clearInterval(frameTimer);
  }

  publishFrame(aperture, performance.now());
  frameTimer = setInterval(() => {
    publishFrame(aperture, performance.now());
  }, 16);
}

function publishFrame(aperture, timestamp) {
  if (scene === null || sharedTransport === null || packetRegistry === null) {
    return;
  }

  scene.frame += 1;

  if (scene.firstTimestamp === null) {
    scene.firstTimestamp = timestamp;
    scene.previousTimestamp = timestamp;
  }

  const previousTimestamp = scene.previousTimestamp ?? timestamp;
  const elapsedSeconds = (timestamp - scene.firstTimestamp) / 1000;
  const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);

  scene.previousTimestamp = timestamp;

  const snapshot = scene.app.stepAndExtract(
    deltaSeconds,
    elapsedSeconds,
    scene.frame,
  );
  const encoded = aperture.encodeSnapshotPackets(snapshot, {
    registry: packetRegistry,
  });

  if (encoded.wordLength > sharedTransport.layout.packetWordsPerBuffer) {
    throw new Error(
      `SAB cube packet buffer is too small: needs ${encoded.wordLength} words, capacity is ${sharedTransport.layout.packetWordsPerBuffer}.`,
    );
  }

  const writeReport = sharedTransport.writer.writeFrame({
    frame: snapshot.frame,
    transforms: snapshot.transforms,
    instanceTints: snapshot.instanceTints,
    viewMatrices: snapshot.viewMatrices,
    packetWords: encoded.words,
  });
  const registrySnapshot = packetRegistry.snapshot();

  self.postMessage({
    type: "snapshot",
    frame: snapshot.frame,
    transport: {
      mode: "shared-array-buffer",
      registry: registrySnapshot,
      diagnostics: snapshot.diagnostics,
    },
    scene: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      materialKind: scene.materialAsset.kind,
    },
    writeReport,
    packetRegistry: {
      strings: registrySnapshot.strings.length,
      handles: registrySnapshot.handles.length,
      wordLength: encoded.wordLength,
      byteLength: encoded.byteLength,
    },
    microbenchmark: {
      entities: 10_000,
      transferableBytesAt10k:
        10_000 * 16 * Float32Array.BYTES_PER_ELEMENT +
        48 * Float32Array.BYTES_PER_ELEMENT +
        (8 + 10_000 * 28 + 10_000 * 43) * Uint32Array.BYTES_PER_ELEMENT,
      sharedArrayBufferPerFrameBytes: 0,
      reductionRatio: 1,
    },
    animation: {
      frames: snapshot.frame,
      elapsedSeconds,
      deltaSeconds,
      rotationRadians: elapsedSeconds * spinRadiansPerSecond,
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
    },
    workerStep: {
      transformDiagnostics: snapshot.diagnostics.length,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      packetWords: encoded.wordLength,
    },
  });
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
