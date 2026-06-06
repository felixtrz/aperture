import {
  physicsSettlingClearColor,
  physicsSettlingDirectionalLightRotation,
  physicsSettlingDynamicBodies,
  physicsSettlingFixedDelta,
  physicsSettlingFixedSteps,
  countPhysicsSettlingDebugLinesByCategory,
  createPhysicsSettlingDebugMaterialSlots,
  createPhysicsSettlingDebugLineMesh,
  registerPhysicsSettlingScene,
} from "./physics-settling-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The physics settling worker raised an error.",
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
      scene = await createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
        data.physicsExecution,
      );
      self.postMessage({
        type: "ready",
        scene: {
          backend: scene.backendInfo.backend,
          backendVersion: scene.backendInfo.backendVersion,
          backendBuild: scene.backendInfo.backendBuild,
          execution: scene.backendInfo.execution,
          physicsWorker: scene.physicsWorkerInfo,
          meshKey: scene.assets.meshKey,
          materialKeys: scene.assets.materialKeys,
          dynamicBodyCount: scene.dynamicBodies.length,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Physics settling worker scene is not initialized.");
      }

      const snapshotMessage = await createSnapshotMessage(
        aperture,
        scene,
        data,
      );
      self.postMessage(
        snapshotMessage,
        aperture.renderSnapshotTransferList(snapshotMessage.snapshot),
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
    import("@aperture-engine/physics"),
    import("@aperture-engine/physics-rapier"),
  ]).then(([simulation, render, runtime, physics, rapier]) => ({
    ...simulation,
    ...render,
    ...runtime,
    ...physics,
    ...rapier,
  }));
  return apertureModulePromise;
}

async function createWorkerScene(aperture, canvasSize, physicsExecution) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 24 },
    fixedStep: {
      fixedDelta: physicsSettlingFixedDelta,
      maxSubsteps: 8,
      maxAccumulatedTime: physicsSettlingFixedDelta * 8,
    },
  });
  aperture.registerPhysicsComponents(app.world);

  const syncState = aperture.createPhysicsWorldSyncState();
  const assets = registerPhysicsSettlingScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  const dynamicBodies = [];
  let lastPhysicsReport = null;
  const requestedPhysicsExecution =
    physicsExecution === "physics-worker-transferable"
      ? "physics-worker-transferable"
      : "simulation-worker";
  let backend = null;
  let physicsProxy = null;
  let physicsWorker = null;
  let physicsWorkerInfo = null;
  let backendInfo;

  if (requestedPhysicsExecution === "physics-worker-transferable") {
    const transport = await createPhysicsWorkerTransport(aperture);
    physicsProxy = aperture.createPhysicsWorkerTransferProxy(
      transport.endpoint,
    );
    physicsWorker = transport.worker;
    physicsWorkerInfo = transport.info;
    backendInfo = {
      backend: transport.info.backend,
      backendVersion: transport.info.backendVersion,
      backendBuild: transport.info.backendBuild,
      execution: transport.info.execution,
    };
  } else {
    backend = aperture.createRapierPhysicsBackend({
      execution: "simulation-worker",
    });
    await backend.init({ execution: "simulation-worker" });
    backendInfo = {
      backend: backend.kind,
      backendVersion: backend.version,
      backendBuild: backend.build,
      execution: backend.execution,
    };

    app.registerFixedStepTask((context) => {
      lastPhysicsReport = aperture.stepPhysicsWorld({
        world: app.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });
    });
  }

  app.spawn(
    aperture.withTransform({ translation: [0, 2.0, 8.2] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 4.8,
      aspect,
      near: 0.1,
      far: 40,
      clearColor: physicsSettlingClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.58, 0.64, 0.72, 1],
      intensity: 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: physicsSettlingDirectionalLightRotation(),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.78, 1],
      intensity: 1.22,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, -0.1, 0],
      scale: [7, 0.2, 5],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.ground),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Static,
      canSleep: true,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [3.5, 0.1, 2.5] },
      friction: 0.92,
      restitution: 0,
    }),
  );

  for (const body of physicsSettlingDynamicBodies) {
    const entity = app.spawn(
      aperture.withTransform({
        translation: body.initialTranslation,
      }),
      aperture.withMesh(assets.boxMesh),
      aperture.withMaterial(assets.materials[body.material]),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
      aperture.withRigidBody({
        type: aperture.PhysicsRigidBodyType.Dynamic,
        linearDamping: 0.14,
        angularDamping: 0.45,
        canSleep: true,
      }),
      aperture.withCollider({
        shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] },
        density: 1,
        friction: 0.86,
        restitution: 0.01,
      }),
      aperture.withPhysicsVelocity(),
    );

    dynamicBodies.push({
      ...body,
      entity,
    });
  }
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.debugMesh),
    aperture.withMaterial(assets.materials.debug),
    aperture.withMaterialSlots(
      createPhysicsSettlingDebugMaterialSlots(assets.materials),
    ),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    app,
    backend,
    backendInfo,
    physicsProxy,
    physicsWorker,
    physicsWorkerInfo,
    assets,
    dynamicBodies,
    fixedStepsRun: 0,
    syncState,
    requestedPhysicsExecution,
    getLastPhysicsReport: () => lastPhysicsReport,
    setLastPhysicsReport: (report) => {
      lastPhysicsReport = report;
    },
  };
}

async function createSnapshotMessage(aperture, workerScene, data) {
  const frame = finiteInteger(data.frame, 1);
  const requestedSteps = finiteInteger(data.steps, physicsSettlingFixedSteps);
  const steps = Math.max(1, requestedSteps);

  if (workerScene.physicsProxy !== null) {
    for (let index = 0; index < steps; index += 1) {
      const nextStep = workerScene.fixedStepsRun + 1;
      const report = await workerScene.physicsProxy.stepWorld({
        world: workerScene.app.world,
        fixedDelta: physicsSettlingFixedDelta,
        fixedStep: nextStep,
        state: workerScene.syncState,
      });
      workerScene.setLastPhysicsReport(report);
      workerScene.fixedStepsRun = nextStep;
    }
    workerScene.app.step(
      0,
      workerScene.fixedStepsRun * physicsSettlingFixedDelta,
    );
  } else {
    for (let index = 0; index < steps; index += 1) {
      const nextStep = workerScene.fixedStepsRun + 1;
      workerScene.app.step(
        physicsSettlingFixedDelta,
        nextStep * physicsSettlingFixedDelta,
      );
      workerScene.fixedStepsRun = nextStep;
    }
  }

  const debugRayProbes = [
    {
      ray: {
        origin: [0, 4, 0],
        direction: [0, -1, 0],
        maxDistance: 6,
      },
    },
  ];
  const debugRaycastHit =
    workerScene.physicsProxy !== null
      ? await workerScene.physicsProxy.raycastFirst(debugRayProbes[0].ray)
      : (workerScene.backend?.raycastFirst(debugRayProbes[0].ray) ?? null);
  const debugGeometry = await readPhysicsDebugGeometry(workerScene, {
    colliderWireframes: true,
    contactNormals: true,
    bodyStateMarkers: true,
    rayProbes: debugRayProbes,
  });
  const contactNormalGeometry = await readPhysicsDebugGeometry(workerScene, {
    contactNormals: true,
  });
  const bodyStateGeometry = await readPhysicsDebugGeometry(workerScene, {
    bodyStateMarkers: true,
  });
  const bodyStateCounts = countPhysicsSettlingDebugLinesByCategory(
    bodyStateGeometry.lines,
  );
  workerScene.app.assets.markReady(
    workerScene.assets.debugMesh,
    createPhysicsSettlingDebugLineMesh(aperture, debugGeometry.lines),
  );

  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    debugGeometry,
    physics: createPhysicsStatus(aperture, workerScene, debugGeometry, {
      rayProbeCount: debugRayProbes.length,
      raycastHit: debugRaycastHit,
      contactNormalCount: contactNormalGeometry.lines.length,
      bodyStateMarkerCount: bodyStateGeometry.lines.length,
      activeBodyMarkerCount: bodyStateCounts.activeBody ?? 0,
      sleepingBodyMarkerCount: bodyStateCounts.sleepingBody ?? 0,
    }),
    workerStep: {
      fixedStepsRun: workerScene.fixedStepsRun,
      transforms: snapshot.transforms.length / 16,
      viewMatrices: snapshot.viewMatrices.length / 16,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

async function readPhysicsDebugGeometry(workerScene, options) {
  const geometry =
    workerScene.physicsProxy !== null
      ? await workerScene.physicsProxy.debugGeometry(options)
      : (workerScene.backend?.debugGeometry?.(options) ?? emptyDebugGeometry());

  return serializableDebugGeometry(geometry);
}

function createPhysicsStatus(aperture, workerScene, debugGeometry, debugInput) {
  const bodies = workerScene.dynamicBodies.map((body) => {
    const translation = vec3FromView(
      body.entity.getVectorView(aperture.LocalTransform, "translation"),
    );
    const velocity = body.entity.hasComponent(aperture.PhysicsVelocity)
      ? vec3FromView(
          body.entity.getVectorView(aperture.PhysicsVelocity, "linear"),
        )
      : [0, 0, 0];
    const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
    const currentDrop = body.initialTranslation[1] - translation[1];

    return {
      id: body.id,
      initialY: body.initialTranslation[1],
      y: translation[1],
      drop: currentDrop,
      speed,
      sleeping: body.entity.hasComponent(aperture.PhysicsBodyState)
        ? body.entity.getValue(aperture.PhysicsBodyState, "sleeping")
        : false,
      expectedMinDrop: body.expectedMinDrop,
    };
  });
  const report = workerScene.getLastPhysicsReport();
  const maxSpeed = Math.max(...bodies.map((body) => body.speed));
  const minDrop = Math.min(...bodies.map((body) => body.drop));
  const settled =
    bodies.every((body) => body.drop >= body.expectedMinDrop) &&
    bodies.every((body) => body.y >= 0.35 && body.y <= 4.25) &&
    maxSpeed <= 0.45;

  return {
    backend: report?.step.backend ?? workerScene.backendInfo.backend,
    backendVersion:
      report?.step.backendVersion ?? workerScene.backendInfo.backendVersion,
    backendBuild:
      report?.step.backendBuild ?? workerScene.backendInfo.backendBuild,
    execution: report?.step.execution ?? workerScene.backendInfo.execution,
    fixedDelta: physicsSettlingFixedDelta,
    fixedStepsRun: workerScene.fixedStepsRun,
    bodyCount: report?.writeback.bodyCount ?? 0,
    colliderCount:
      report?.sync?.colliderCount ?? report?.step.colliderCount ?? 0,
    eventCount: report?.step.eventCount ?? 0,
    queryCount: report?.step.queryCount ?? 0,
    transformWrites: report?.writeback.transformWrites ?? 0,
    velocityWrites: report?.writeback.velocityWrites ?? 0,
    bodyStateWrites: report?.writeback.bodyStateWrites ?? 0,
    timings: {
      syncToBackendMs: report?.step.syncToBackendMs ?? 0,
      backendStepMs: report?.step.backendStepMs ?? 0,
      writebackMs: report?.step.writebackMs ?? 0,
    },
    maxSpeed,
    minDrop,
    settled,
    transport: report?.transport ?? null,
    commands: report?.commands ?? null,
    workerQuery: {
      raycastFirst: debugInput.raycastHit,
    },
    debug: {
      lineCount: debugGeometry.lines.length,
      summary: aperture.summarizePhysicsDebugGeometry(debugGeometry),
      rayProbeCount: debugInput.rayProbeCount,
      contactNormalCount: debugInput.contactNormalCount,
      bodyStateMarkerCount: debugInput.bodyStateMarkerCount,
      activeBodyMarkerCount: debugInput.activeBodyMarkerCount,
      sleepingBodyMarkerCount: debugInput.sleepingBodyMarkerCount,
      rendered: debugGeometry.lines.length > 0,
      meshKey: aperture.assetHandleKey(workerScene.assets.debugMesh),
      materialKey: aperture.assetHandleKey(workerScene.assets.materials.debug),
      materialKeys: {
        collider: aperture.assetHandleKey(workerScene.assets.materials.debug),
        contactNormal: aperture.assetHandleKey(
          workerScene.assets.materials.debugContactNormal,
        ),
        rayHit: aperture.assetHandleKey(
          workerScene.assets.materials.debugRayHit,
        ),
        rayMiss: aperture.assetHandleKey(
          workerScene.assets.materials.debugRayMiss,
        ),
        activeBody: aperture.assetHandleKey(
          workerScene.assets.materials.debugActiveBody,
        ),
        sleepingBody: aperture.assetHandleKey(
          workerScene.assets.materials.debugSleepingBody,
        ),
      },
    },
    bodies,
  };
}

function serializableDebugGeometry(geometry) {
  return {
    lines: geometry.lines.map((line) => ({
      from: vec3FromView(line.from),
      to: vec3FromView(line.to),
      color: [
        line.color[0] ?? 1,
        line.color[1] ?? 1,
        line.color[2] ?? 1,
        line.color[3] ?? 1,
      ],
    })),
  };
}

function emptyDebugGeometry() {
  return { lines: [] };
}

async function createPhysicsWorkerTransport(aperture) {
  const worker = new Worker(
    "/worker-modules/examples/physics-worker-mode.physics-worker.js",
    {
      name: "aperture-physics-transferable-backend",
      type: "module",
    },
  );
  const pendingSteps = new Map();
  const pendingActions = new Map();
  let readyResolve = null;
  let readyReject = null;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  worker.addEventListener("message", (event) => {
    const message = event.data;

    if (message?.type === "ready") {
      readyResolve?.(message);
      return;
    }

    if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.result) {
      const pending = pendingSteps.get(message.fixedStep);
      pendingSteps.delete(message.fixedStep);
      pending?.resolve({ message, transfer: [] });
      return;
    }

    if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.actionResult) {
      const pending = pendingActions.get(message.requestId);
      pendingActions.delete(message.requestId);
      pending?.resolve({ message, transfer: [] });
      return;
    }

    if (message?.type === aperture.PHYSICS_WORKER_PROTOCOL.error) {
      if (message.requestId !== undefined) {
        const pending = pendingActions.get(message.requestId);
        pendingActions.delete(message.requestId);
        pending?.resolve({ message, transfer: [] });
        return;
      }

      if (pendingSteps.size > 0 || pendingActions.size > 0) {
        for (const pending of pendingSteps.values()) {
          pending.resolve({ message, transfer: [] });
        }
        for (const pending of pendingActions.values()) {
          pending.resolve({ message, transfer: [] });
        }
        pendingSteps.clear();
        pendingActions.clear();
      } else {
        readyReject?.(new Error(message.message ?? "Physics worker failed."));
      }
    }
  });
  worker.addEventListener("error", (event) => {
    const error = new Error(
      event.message || "Physics worker transport failed.",
    );
    readyReject?.(error);
    for (const pending of pendingSteps.values()) {
      pending.reject(error);
    }
    for (const pending of pendingActions.values()) {
      pending.reject(error);
    }
    pendingSteps.clear();
    pendingActions.clear();
  });
  worker.postMessage({
    type: aperture.PHYSICS_WORKER_PROTOCOL.init,
    backend: "rapier",
    backendBuild: "performance",
    execution: "physics-worker-transferable",
    gravity: [0, -9.81, 0],
  });

  const info = await ready;

  return {
    worker,
    info,
    endpoint: {
      step(request) {
        return new Promise((resolve, reject) => {
          pendingSteps.set(request.message.fixedStep, { resolve, reject });
          worker.postMessage(request.message, request.transfer);
        });
      },
      action(request) {
        return new Promise((resolve, reject) => {
          pendingActions.set(request.message.requestId, { resolve, reject });
          worker.postMessage(request.message, request.transfer);
        });
      },
    },
  };
}

function vec3FromView(view) {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
