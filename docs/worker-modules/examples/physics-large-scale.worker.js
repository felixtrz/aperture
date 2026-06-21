import {
  physicsLargeScaleClearColor,
  physicsLargeScaleCameraRotation,
  physicsLargeScaleDirectionalLightRotation,
  physicsLargeScaleDynamicBodyCount,
  physicsLargeScaleFixedDelta,
  physicsLargeScaleFixedSteps,
  physicsLargeScaleBodySpec,
  registerPhysicsLargeScaleScene,
} from "./physics-large-scale-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The physics large-scale worker raised an error.",
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
          backendBuild: scene.backend.build,
          execution: scene.backend.execution,
          assetBackedColliderCount: scene.assetBackedColliderCount,
          dynamicBodyCount: scene.dynamicBodies.length,
          meshKeys: scene.assets.meshKeys,
          materialKeys: scene.assets.materialKeys,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Physics large-scale worker scene is not initialized.");
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
    import("/aperture/worker-modules/packages/simulation/dist/index.js"),
    import("/aperture/worker-modules/packages/render/dist/index.js"),
    import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    import("/aperture/worker-modules/packages/physics/dist/index.js"),
    import("/aperture/worker-modules/packages/physics-rapier/dist/index.js"),
    import("/aperture/worker-modules/packages/app/dist/index.js"),
  ]).then(([simulation, render, runtime, physics, rapier, app]) => ({
    ...simulation,
    ...render,
    ...runtime,
    ...physics,
    ...rapier,
    ...app,
  }));
  return apertureModulePromise;
}

async function createWorkerScene(aperture, canvasSize) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 320 },
    fixedStep: {
      fixedDelta: physicsLargeScaleFixedDelta,
      maxSubsteps: 12,
      maxAccumulatedTime: physicsLargeScaleFixedDelta * 12,
    },
  });
  aperture.registerPhysicsComponents(app.world);

  const assets = registerPhysicsLargeScaleScene(aperture, app.assets);
  const colliderGeometryProvider =
    aperture.createAssetBackedPhysicsColliderGeometryProvider({
      assets: app.assets,
    });
  const backend = aperture.createRapierPhysicsBackend({
    gravity: [0, -9.81, 0],
    execution: "simulation-worker",
    colliderGeometryProvider,
  });
  const syncState = aperture.createPhysicsWorldSyncState();
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  const dynamicBodies = [];
  let lastPhysicsReport = null;

  await backend.init({
    execution: "simulation-worker",
    colliderGeometryProvider,
  });

  app.registerFixedStepTask((context) => {
    lastPhysicsReport = aperture.stepPhysicsWorld({
      world: app.world,
      backend,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
      state: syncState,
    });
  });

  app.spawn(
    aperture.withTransform({
      translation: [0, 5.5, 11],
      rotation: physicsLargeScaleCameraRotation(),
    }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 8.5,
      aspect,
      near: 0.1,
      far: 80,
      clearColor: physicsLargeScaleClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.58, 0.68, 1],
      intensity: 0.68,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: physicsLargeScaleDirectionalLightRotation(),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.78, 1],
      intensity: 1.35,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.terrainMesh),
    aperture.withMaterial(assets.materials.terrain),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Static,
      canSleep: true,
    }),
    aperture.withCollider({
      shape: {
        kind: "trimesh",
        meshId: aperture.assetHandleKey(assets.terrainMesh),
      },
      friction: 0.92,
      restitution: 0,
    }),
  );

  for (let index = 0; index < physicsLargeScaleDynamicBodyCount; index += 1) {
    const spec = physicsLargeScaleBodySpec(index);
    const entity = app.spawn(
      aperture.withTransform({
        translation: spec.translation,
        scale: [0.36, 0.36, 0.36],
      }),
      aperture.withMesh(assets.boxMesh),
      aperture.withMaterial(assets.materials[spec.material]),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
      aperture.withRigidBody({
        type: aperture.PhysicsRigidBodyType.Dynamic,
        linearDamping: 0.16,
        angularDamping: 0.5,
        canSleep: true,
      }),
      aperture.withCollider({
        shape: { kind: "box", halfExtents: [0.18, 0.18, 0.18] },
        density: 1,
        friction: 0.84,
        restitution: 0.02,
      }),
      aperture.withPhysicsVelocity(),
    );

    dynamicBodies.push({ ...spec, entity });
  }

  return {
    app,
    backend,
    syncState,
    assets,
    dynamicBodies,
    fixedStepsRun: 0,
    assetBackedColliderCount: 1,
    getLastPhysicsReport: () => lastPhysicsReport,
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = finiteInteger(data.frame, 1);
  const requestedSteps = finiteInteger(data.steps, physicsLargeScaleFixedSteps);
  const steps = Math.max(1, requestedSteps);

  for (let index = 0; index < steps; index += 1) {
    const nextStep = workerScene.fixedStepsRun + 1;

    workerScene.app.step(
      physicsLargeScaleFixedDelta,
      nextStep * physicsLargeScaleFixedDelta,
    );
    workerScene.fixedStepsRun = nextStep;
  }

  const terrainRaycast = workerScene.backend.raycastFirst({
    origin: [0, 4, 0],
    direction: [0, -1, 0],
    maxDistance: 8,
  });
  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    physics: createPhysicsStatus(aperture, workerScene, terrainRaycast),
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

function createPhysicsStatus(aperture, workerScene, terrainRaycast) {
  const report = workerScene.getLastPhysicsReport();
  const bodies = workerScene.dynamicBodies.map((body) => {
    const translation = vec3FromView(
      body.entity.getVectorView(aperture.LocalTransform, "translation"),
    );
    const velocity = body.entity.hasComponent(aperture.PhysicsVelocity)
      ? vec3FromView(
          body.entity.getVectorView(aperture.PhysicsVelocity, "linear"),
        )
      : [0, 0, 0];
    const sleeping = body.entity.hasComponent(aperture.PhysicsBodyState)
      ? body.entity.getValue(aperture.PhysicsBodyState, "sleeping") === true
      : false;

    return {
      id: body.id,
      y: translation[1],
      speed: Math.hypot(velocity[0], velocity[1], velocity[2]),
      sleeping,
    };
  });
  const sleepingBodyCount = bodies.filter((body) => body.sleeping).length;
  const activeBodyCount = bodies.length - sleepingBodyCount;
  const unsupportedFeatures = report?.sync?.unsupportedFeatures ?? [];
  const assetShapeUnsupportedCount = unsupportedFeatures.filter(
    (feature) => feature.code === "physics.collider.assetShape.unsupported",
  ).length;

  return {
    backend: report?.step.backend ?? workerScene.backend.kind,
    backendVersion: report?.step.backendVersion ?? workerScene.backend.version,
    backendBuild: report?.step.backendBuild ?? workerScene.backend.build,
    execution: report?.step.execution ?? workerScene.backend.execution,
    fixedDelta: physicsLargeScaleFixedDelta,
    fixedStepsRun: workerScene.fixedStepsRun,
    bodyCount: report?.writeback.bodyCount ?? 0,
    colliderCount:
      report?.sync?.colliderCount ?? report?.step.colliderCount ?? 0,
    readbackCount: report?.readback?.bodyCount ?? 0,
    transformWrites: report?.writeback.transformWrites ?? 0,
    velocityWrites: report?.writeback.velocityWrites ?? 0,
    bodyStateWrites: report?.writeback.bodyStateWrites ?? 0,
    assetBackedColliderCount: workerScene.assetBackedColliderCount,
    unsupportedFeatureCount: report?.sync?.unsupportedFeatureCount ?? 0,
    unsupportedFeatures,
    assetShapeUnsupportedCount,
    eventCount: report?.step.eventCount ?? 0,
    queryCount: report?.step.queryCount ?? 0,
    activeBodyCount,
    sleepingBodyCount,
    dynamicBodyCount: bodies.length,
    terrainRaycast,
    timings: {
      syncToBackendMs: report?.step.syncToBackendMs ?? 0,
      backendStepMs: report?.step.backendStepMs ?? 0,
      writebackMs: report?.step.writebackMs ?? 0,
    },
    bodies: {
      maxSpeed: Math.max(...bodies.map((body) => body.speed)),
      minY: Math.min(...bodies.map((body) => body.y)),
      maxY: Math.max(...bodies.map((body) => body.y)),
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
