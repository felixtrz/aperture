import {
  physicsCharacterClearColor,
  physicsCharacterDirectionalLightRotation,
  physicsCharacterFixedDelta,
  physicsCharacterFixedSteps,
  createPhysicsCharacterDebugLineMesh,
  quatFromZRotation,
  registerPhysicsCharacterScene,
} from "./physics-character-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The physics character worker raised an error.",
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
      );
      self.postMessage({
        type: "ready",
        scene: {
          backend: scene.backend.kind,
          backendVersion: scene.backend.version,
          meshKey: scene.assets.meshKey,
          materialKeys: scene.assets.materialKeys,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Physics character worker scene is not initialized.");
      }

      const snapshotMessage = createSnapshotMessage(aperture, scene, data);
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

async function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 32 },
    fixedStep: {
      fixedDelta: physicsCharacterFixedDelta,
      maxSubsteps: 8,
      maxAccumulatedTime: physicsCharacterFixedDelta * 8,
    },
  });
  aperture.registerPhysicsComponents(app.world);

  const backend = aperture.createRapierPhysicsBackend();
  await backend.init();

  const syncState = aperture.createPhysicsWorldSyncState();
  const assets = registerPhysicsCharacterScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  let lastPhysicsReport = null;

  app.spawn(
    aperture.withTransform({ translation: [0.15, 1.18, 6.4] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 3.8,
      aspect,
      near: 0.1,
      far: 32,
      clearColor: physicsCharacterClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.62, 0.66, 0.72, 1],
      intensity: 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: physicsCharacterDirectionalLightRotation(),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.8, 1],
      intensity: 1.24,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, -0.05, 0],
      scale: [5.4, 0.1, 2.8],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.floor),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({ type: aperture.PhysicsRigidBodyType.Static }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [2.7, 0.05, 1.4] },
      friction: 0.8,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0.82, 0.75, 0.24],
      scale: [0.1, 1.5, 1],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.wall),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({ type: aperture.PhysicsRigidBodyType.Static }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.05, 0.75, 0.5] },
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-0.82, 0.1, -0.5],
      scale: [0.3, 0.2, 0.7],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.step),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({ type: aperture.PhysicsRigidBodyType.Static }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.15, 0.1, 0.35] },
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [-0.95, 0.34, 0.56],
      rotation: quatFromZRotation(Math.PI / 3),
      scale: [1.2, 0.08, 0.7],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.slope),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({ type: aperture.PhysicsRigidBodyType.Static }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.6, 0.04, 0.35] },
    }),
  );
  const character = app.spawn(
    aperture.withTransform({
      translation: [0, 0.75, 0],
      scale: [0.42, 1.1, 0.42],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.character),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.KinematicPosition,
      canSleep: false,
    }),
    aperture.withCollider({
      shape: { kind: "capsule", radius: 0.25, halfHeight: 0.5 },
      friction: 0.2,
    }),
    aperture.withPhysicsVelocity(),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.debugMesh),
    aperture.withMaterial(assets.materials.debugCollider),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const characterRef = aperture.serializeEntityRef(character);
  const tracking = {
    groundedSteps: 0,
    wallCollisions: 0,
    maxX: 0,
    maxZ: 0,
    lastMove: null,
  };

  return {
    app,
    backend,
    assets,
    syncState,
    character,
    characterRef,
    fixedStepsRun: 0,
    tracking,
    getLastPhysicsReport: () => lastPhysicsReport,
    setLastPhysicsReport: (report) => {
      lastPhysicsReport = report;
    },
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = finiteInteger(data.frame, 1);
  const requestedSteps = finiteInteger(data.steps, physicsCharacterFixedSteps);

  if (workerScene.fixedStepsRun === 0 && requestedSteps > 0) {
    workerScene.setLastPhysicsReport(
      stepCharacterPhysics(aperture, {
        app: workerScene.app,
        backend: workerScene.backend,
        syncState: workerScene.syncState,
        characterRef: workerScene.characterRef,
        fixedDelta: physicsCharacterFixedDelta,
        fixedStep: 1,
        tracking: workerScene.tracking,
      }),
    );
    workerScene.fixedStepsRun = 1;
    updateCharacterTracking(aperture, workerScene);
  }
  workerScene.app.step(0, frame * physicsCharacterFixedDelta);

  const debugGeometry = serializableDebugGeometry(
    workerScene.backend.debugGeometry?.({ colliderWireframes: true }) ?? {
      lines: [],
    },
  );
  workerScene.app.assets.markReady(
    workerScene.assets.debugMesh,
    createPhysicsCharacterDebugLineMesh(aperture, debugGeometry.lines),
  );

  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    debugGeometry,
    physics: createPhysicsStatus(aperture, workerScene, debugGeometry),
    workerStep: {
      fixedStepsRun: workerScene.fixedStepsRun,
      transforms: snapshot.transforms.length / 16,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
  };
}

function stepCharacterPhysics(aperture, options) {
  const sync = options.backend.sync(
    aperture.collectPhysicsCommands(options.app.world, options.syncState),
  );
  options.backend.step(options.fixedDelta, Math.max(0, options.fixedStep - 1));
  const move = options.backend.moveCharacter?.({
    entity: options.characterRef,
    desiredTranslation: [1, -0.02, 0.65],
    settings: {
      snapToGroundDistance: 0.12,
      maxSlopeClimbAngle: Math.PI / 4,
      minSlopeSlideAngle: Math.PI / 3,
      autostep: {
        maxHeight: 0.3,
        minWidth: 0.2,
      },
    },
  });

  if (move?.grounded === true) {
    options.tracking.groundedSteps += 1;
  }
  if (
    move?.collisions.some(
      (collision) => collision.entity?.includes(options.characterRef) === false,
    ) === true
  ) {
    options.tracking.wallCollisions += 1;
  }
  options.tracking.lastMove = move ?? null;

  const step = options.backend.step(options.fixedDelta, options.fixedStep);
  const readback = options.backend.readResults(options.syncState.resultBuffer);
  const writeback = aperture.applyPhysicsResultsToWorld(
    options.app.world,
    options.syncState.resultBuffer,
  );
  const events = [...options.syncState.resultBuffer.events];

  return { sync, step, readback, writeback, events };
}

function createPhysicsStatus(aperture, workerScene, debugGeometry) {
  const report = workerScene.getLastPhysicsReport();
  const characterTranslation = vec3FromEntity(aperture, workerScene.character);
  const behavior = createSceneBehaviorStatus(workerScene.tracking);

  return {
    backend: workerScene.backend.kind,
    backendVersion: workerScene.backend.version,
    backendBuild: report?.step.backendBuild ?? workerScene.backend.build,
    execution: report?.step.execution ?? workerScene.backend.execution,
    fixedDelta: physicsCharacterFixedDelta,
    fixedStepsRun: workerScene.fixedStepsRun,
    bodyCount: report?.writeback.bodyCount ?? 0,
    colliderCount: report?.sync.colliderCount ?? 0,
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
    debug: {
      lineCount: debugGeometry.lines.length,
      colliderLineCount: debugGeometry.lines.length,
      rendered: debugGeometry.lines.length > 0,
      meshKey: aperture.assetHandleKey(workerScene.assets.debugMesh),
      materialKeys: {
        collider: aperture.assetHandleKey(
          workerScene.assets.materials.debugCollider,
        ),
      },
    },
    scene: {
      characterCenter: characterTranslation,
      maxX: workerScene.tracking.maxX,
      maxZ: workerScene.tracking.maxZ,
      groundedSteps: workerScene.tracking.groundedSteps,
      wallCollisions: workerScene.tracking.wallCollisions,
    },
    behavior,
  };
}

function createSceneBehaviorStatus(tracking) {
  const lastMovement = tracking.lastMove?.movement ?? [0, 0, 0];

  return {
    walk: {
      grounded: tracking.groundedSteps > 0,
      passed: tracking.groundedSteps > 0 && tracking.maxX > 0.3,
    },
    slide: {
      movement: lastMovement,
      collisionCount: tracking.wallCollisions,
      passed: tracking.wallCollisions > 0 && tracking.maxZ > 0.2,
    },
  };
}

function updateCharacterTracking(aperture, workerScene) {
  const translation = vec3FromEntity(aperture, workerScene.character);

  workerScene.tracking.maxX = Math.max(
    workerScene.tracking.maxX,
    translation[0],
  );
  workerScene.tracking.maxZ = Math.max(
    workerScene.tracking.maxZ,
    translation[2],
  );
}

function vec3FromEntity(aperture, entity) {
  const view = entity.getVectorView(aperture.LocalTransform, "translation");

  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function serializableDebugGeometry(geometry) {
  return {
    lines: (geometry.lines ?? []).map((line) => ({
      from: vec3(line.from),
      to: vec3(line.to),
      color: Array.from(line.color ?? [1, 1, 1, 1]),
    })),
  };
}

function vec3(value) {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
