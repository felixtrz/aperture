import {
  physicsJointsClearColor,
  physicsJointsDirectionalLightRotation,
  physicsJointsFixedDelta,
  physicsJointsFixedSteps,
  physicsJointsHinge,
  physicsJointsPrismatic,
  countPhysicsJointsDebugLinesByCategory,
  createPhysicsJointsDebugMaterialSlots,
  createPhysicsJointsDebugLineMesh,
  registerPhysicsJointsScene,
} from "./physics-joints-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The physics joints worker raised an error.",
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
          jointCount: scene.joints.length,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Physics joints worker scene is not initialized.");
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
      fixedDelta: physicsJointsFixedDelta,
      maxSubsteps: 8,
      maxAccumulatedTime: physicsJointsFixedDelta * 8,
    },
  });
  aperture.registerPhysicsComponents(app.world);

  const backend = aperture.createRapierPhysicsBackend();
  await backend.init();

  const syncState = aperture.createPhysicsWorldSyncState();
  const assets = registerPhysicsJointsScene(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  let lastPhysicsReport = null;

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
    aperture.withTransform({ translation: [0, 1.2, 8.2] }),
    aperture.withCamera({
      projection: aperture.CameraProjection.Orthographic,
      orthographicHeight: 4.8,
      aspect,
      near: 0.1,
      far: 40,
      clearColor: physicsJointsClearColor,
      layerMask: 1,
      frustumCulling: false,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.62, 0.66, 0.74, 1],
      intensity: 0.74,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      rotation: physicsJointsDirectionalLightRotation(),
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.93, 0.78, 1],
      intensity: 1.28,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, -0.95, 0],
      scale: [7, 0.14, 3],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.ground),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const hingeAnchor = app.spawn(
    aperture.withTransform({
      translation: physicsJointsHinge.anchorTranslation,
      scale: [0.26, 0.26, 0.26],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.anchor),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Static,
      canSleep: true,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.13, 0.13, 0.13] },
      sensor: true,
    }),
  );
  const pendulum = app.spawn(
    aperture.withTransform({
      translation: physicsJointsHinge.pendulumInitialTranslation,
      scale: [0.24, 1.24, 0.24],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.pendulum),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Dynamic,
      linearDamping: 0.02,
      angularDamping: 0.04,
      canSleep: false,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.12, 0.62, 0.12] },
      density: 1,
      friction: 0.45,
      restitution: 0,
    }),
    aperture.withPhysicsVelocity({
      angular: [0, 0, 2.8],
    }),
  );
  const hingeJoint = app.spawn(
    aperture.withPhysicsJoint({
      kind: aperture.PhysicsJointKind.Revolute,
      bodyARef: aperture.serializeEntityRef(hingeAnchor),
      bodyBRef: aperture.serializeEntityRef(pendulum),
      anchorA: [0, 0, 0],
      anchorB: physicsJointsHinge.pendulumAnchorLocal,
      axis: physicsJointsHinge.axis,
    }),
  );

  const rail = app.spawn(
    aperture.withTransform({
      translation: physicsJointsPrismatic.railTranslation,
      scale: [1.55, 0.1, 0.1],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.rail),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Static,
      canSleep: true,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.78, 0.05, 0.05] },
      sensor: true,
    }),
  );
  const slider = app.spawn(
    aperture.withTransform({
      translation: physicsJointsPrismatic.sliderInitialTranslation,
      scale: [0.38, 0.3, 0.3],
    }),
    aperture.withMesh(assets.boxMesh),
    aperture.withMaterial(assets.materials.slider),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Dynamic,
      gravityScale: 0,
      linearDamping: 0.35,
      angularDamping: 0.6,
      canSleep: false,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [0.19, 0.15, 0.15] },
      density: 1,
      friction: 0.55,
      restitution: 0,
    }),
    aperture.withPhysicsVelocity(),
  );
  const prismaticJoint = app.spawn(
    aperture.withPhysicsJoint({
      kind: aperture.PhysicsJointKind.Prismatic,
      bodyARef: aperture.serializeEntityRef(rail),
      bodyBRef: aperture.serializeEntityRef(slider),
      anchorA: [0, 0, 0],
      anchorB: [0, 0, 0],
      axis: physicsJointsPrismatic.axis,
      minLimit: physicsJointsPrismatic.minLimit,
      maxLimit: physicsJointsPrismatic.maxLimit,
      motorTarget: physicsJointsPrismatic.motorTarget,
      motorStiffness: 90,
      motorDamping: 12,
    }),
  );

  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(assets.debugMesh),
    aperture.withMaterial(assets.materials.debugCollider),
    aperture.withMaterialSlots(
      createPhysicsJointsDebugMaterialSlots(assets.materials),
    ),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const tracking = createJointTracking(aperture, {
    hingeAnchor,
    pendulum,
    rail,
    slider,
  });

  return {
    app,
    backend,
    assets,
    entities: {
      hingeAnchor,
      pendulum,
      rail,
      slider,
    },
    joints: [hingeJoint, prismaticJoint],
    tracking,
    fixedStepsRun: 0,
    getLastPhysicsReport: () => lastPhysicsReport,
  };
}

function createSnapshotMessage(aperture, workerScene, data) {
  const frame = finiteInteger(data.frame, 1);
  const requestedSteps = finiteInteger(data.steps, physicsJointsFixedSteps);
  const steps = Math.max(1, requestedSteps);

  for (let index = 0; index < steps; index += 1) {
    const nextStep = workerScene.fixedStepsRun + 1;
    workerScene.app.step(
      physicsJointsFixedDelta,
      nextStep * physicsJointsFixedDelta,
    );
    workerScene.fixedStepsRun = nextStep;
    updateJointTracking(aperture, workerScene);
  }

  const debugGeometry = serializableDebugGeometry(
    workerScene.backend.debugGeometry?.({
      colliderWireframes: true,
      jointFrames: true,
      jointFrameLength: 0.34,
    }) ?? {
      lines: [],
    },
  );
  const jointFrameGeometry = serializableDebugGeometry(
    workerScene.backend.debugGeometry?.({ jointFrames: true }) ?? {
      lines: [],
    },
  );
  const debugCounts = countPhysicsJointsDebugLinesByCategory(
    debugGeometry.lines,
  );
  workerScene.app.assets.markReady(
    workerScene.assets.debugMesh,
    createPhysicsJointsDebugLineMesh(aperture, debugGeometry.lines),
  );

  const snapshot = workerScene.app.extract(frame);

  return {
    type: "snapshot",
    frame,
    snapshot,
    debugGeometry,
    physics: createPhysicsStatus(
      aperture,
      workerScene,
      debugGeometry,
      jointFrameGeometry,
      debugCounts,
    ),
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

function createPhysicsStatus(
  aperture,
  workerScene,
  debugGeometry,
  jointFrameGeometry,
  debugCounts,
) {
  const report = workerScene.getLastPhysicsReport();
  const measurements = measureJoints(aperture, workerScene.entities);
  const hinge = {
    ...measurements.hinge,
    maxCenterTravel: workerScene.tracking.hingeMaxCenterTravel,
    passed:
      measurements.hinge.anchorError <= physicsJointsHinge.maxAnchorError &&
      workerScene.tracking.hingeMaxCenterTravel >=
        physicsJointsHinge.expectedMaxCenterTravel,
  };
  const prismatic = {
    ...measurements.prismatic,
    maxAxisTravel: workerScene.tracking.prismaticMaxAxisTravel,
    limitExceeded:
      measurements.prismatic.axisTravel <
        physicsJointsPrismatic.minLimit - 0.04 ||
      measurements.prismatic.axisTravel >
        physicsJointsPrismatic.maxLimit + 0.04,
    passed:
      workerScene.tracking.prismaticMaxAxisTravel >=
        physicsJointsPrismatic.expectedMinAxisTravel &&
      Math.abs(measurements.prismatic.yDrift) <=
        physicsJointsPrismatic.maxPerpendicularDrift &&
      Math.abs(measurements.prismatic.zDrift) <=
        physicsJointsPrismatic.maxPerpendicularDrift &&
      measurements.prismatic.axisTravel >=
        physicsJointsPrismatic.minLimit - 0.04 &&
      measurements.prismatic.axisTravel <=
        physicsJointsPrismatic.maxLimit + 0.04,
  };

  return {
    backend: workerScene.backend.kind,
    backendVersion: workerScene.backend.version,
    backendBuild: report?.step.backendBuild ?? workerScene.backend.build,
    execution: report?.step.execution ?? workerScene.backend.execution,
    fixedDelta: physicsJointsFixedDelta,
    fixedStepsRun: workerScene.fixedStepsRun,
    bodyCount: report?.writeback.bodyCount ?? 0,
    colliderCount: report?.sync.colliderCount ?? 0,
    jointCount: report?.step.jointCount ?? 0,
    unsupportedFeatureCount: report?.sync.unsupportedFeatureCount ?? 0,
    unsupportedFeatures: report?.sync.unsupportedFeatures ?? [],
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
      colliderLineCount: debugCounts.collider ?? 0,
      jointFrameLineCount: jointFrameGeometry.lines.length,
      jointAnchorLineCount: debugCounts.jointFrame ?? 0,
      jointAxisLineCount: debugCounts.jointAxis ?? 0,
      rendered: debugGeometry.lines.length > 0,
      meshKey: aperture.assetHandleKey(workerScene.assets.debugMesh),
      materialKeys: {
        collider: aperture.assetHandleKey(
          workerScene.assets.materials.debugCollider,
        ),
        jointFrame: aperture.assetHandleKey(
          workerScene.assets.materials.debugJointFrame,
        ),
        jointAxis: aperture.assetHandleKey(
          workerScene.assets.materials.debugJointAxis,
        ),
      },
    },
    hinge,
    prismatic,
  };
}

function createJointTracking(aperture, entities) {
  const measured = measureJoints(aperture, entities);

  return {
    hingeMaxCenterTravel: measured.hinge.centerTravel,
    prismaticMaxAxisTravel: Math.abs(measured.prismatic.axisTravel),
  };
}

function updateJointTracking(aperture, workerScene) {
  const measured = measureJoints(aperture, workerScene.entities);

  workerScene.tracking.hingeMaxCenterTravel = Math.max(
    workerScene.tracking.hingeMaxCenterTravel,
    measured.hinge.centerTravel,
  );
  workerScene.tracking.prismaticMaxAxisTravel = Math.max(
    workerScene.tracking.prismaticMaxAxisTravel,
    Math.abs(measured.prismatic.axisTravel),
  );
}

function measureJoints(aperture, entities) {
  const hingeAnchorTranslation = vec3FromEntity(aperture, entities.hingeAnchor);
  const pendulumTranslation = vec3FromEntity(aperture, entities.pendulum);
  const pendulumRotation = quatFromEntity(aperture, entities.pendulum);
  const pendulumAnchor = addVec3(
    pendulumTranslation,
    rotateVec3(pendulumRotation, physicsJointsHinge.pendulumAnchorLocal),
  );
  const sliderTranslation = vec3FromEntity(aperture, entities.slider);

  return {
    hinge: {
      anchorError: distanceVec3(hingeAnchorTranslation, pendulumAnchor),
      center: pendulumTranslation,
      centerTravel: distanceVec3(
        physicsJointsHinge.pendulumInitialTranslation,
        pendulumTranslation,
      ),
    },
    prismatic: {
      center: sliderTranslation,
      axisTravel:
        sliderTranslation[0] -
        physicsJointsPrismatic.sliderInitialTranslation[0],
      yDrift:
        sliderTranslation[1] -
        physicsJointsPrismatic.sliderInitialTranslation[1],
      zDrift:
        sliderTranslation[2] -
        physicsJointsPrismatic.sliderInitialTranslation[2],
    },
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

function vec3FromEntity(aperture, entity) {
  return vec3FromView(
    entity.getVectorView(aperture.LocalTransform, "translation"),
  );
}

function quatFromEntity(aperture, entity) {
  const view = entity.getVectorView(aperture.LocalTransform, "rotation");

  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 1];
}

function rotateVec3(quat, vec) {
  const x = vec[0];
  const y = vec[1];
  const z = vec[2];
  const qx = quat[0];
  const qy = quat[1];
  const qz = quat[2];
  const qw = quat[3];
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

function addVec3(left, right) {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function distanceVec3(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
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
