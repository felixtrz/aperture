// F2 proof route worker (IK — two-bone + CCD). Builds a leg rig (hip → knee →
// foot parented transform chain) above a tilted static ramp, casts a downward
// PHYSICS RAYCAST to find the ground under the foot, sets the two-bone IK
// constraint's target to the hit point, and lets the engine's fixed-step IK
// system plant the foot on the surface. Reports the raycast hit + solved joint
// world positions for the e2e to assert (foot lands on the ground, moving the
// foot along the ramp moves it to a new height, the pole controls the bend).
import {
  BONE_LENGTH,
  FIXED_DELTA,
  HIP_HEIGHT,
  RAMP,
  RAY_MAX_DISTANCE,
  RAY_ORIGIN_HEIGHT,
  SETTLE_STEPS,
  clearColor,
  registerFootPlacementAssets,
  zRotationQuaternion,
} from "./foot-placement-ik-scene.js";

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The foot-placement-ik worker raised an error.",
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
        data.canvas ?? { width: 960, height: 640 },
        finiteNumber(data.footX, 1),
        data.pole === "back" ? "back" : "front",
      );
      self.postMessage({ type: "ready", scene: scene.status });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Foot-placement-ik worker scene is not initialized.");
      }
      const frame = Number.isInteger(data.frame) ? data.frame : 1;
      const snapshot = scene.app.extract(frame);
      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          status: scene.status,
          workerStep: {
            meshDraws: snapshot.meshDraws.length,
            transforms: snapshot.transforms.length / 16,
          },
        },
        aperture.renderSnapshotTransferList(snapshot),
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

async function createWorkerScene(aperture, canvasSize, footX, poleSide) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 32 },
    fixedStep: {
      fixedDelta: FIXED_DELTA,
      maxSubsteps: 4,
      maxAccumulatedTime: FIXED_DELTA * 4,
    },
  });
  aperture.registerPhysicsComponents(app.world);

  const syncState = aperture.createPhysicsWorldSyncState();
  const assets = registerFootPlacementAssets(aperture, app.assets);
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  const backend = aperture.createRapierPhysicsBackend({
    execution: "simulation-worker",
  });
  await backend.init({ execution: "simulation-worker" });
  app.registerFixedStepTask((context) => {
    aperture.stepPhysicsWorld({
      world: app.world,
      backend,
      fixedDelta: context.fixedDelta,
      fixedStep: context.fixedStep,
      state: syncState,
    });
  });

  app.spawn(
    aperture.withTransform({ translation: [0, 1.4, 8.5] }),
    aperture.withCamera({
      aspect,
      near: 0.1,
      far: 60,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.7, 0.75, 0.85, 1],
      intensity: 0.6,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [2.5, 4, 3] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.9, 1],
      intensity: 2.2,
      layerMask: 1,
    }),
  );

  // Tilted static ramp — the uneven ground the foot plants onto.
  app.spawn(
    aperture.withTransform({
      translation: [...RAMP.translation],
      rotation: zRotationQuaternion(RAMP.rotationDegrees),
    }),
    aperture.withMesh(assets.ramp),
    aperture.withMaterial(assets.rampMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withRigidBody({
      type: aperture.PhysicsRigidBodyType.Static,
      canSleep: true,
    }),
    aperture.withCollider({
      shape: { kind: "box", halfExtents: [...RAMP.halfExtents] },
      friction: 0.9,
      restitution: 0,
    }),
  );

  // Leg rig: a hip → knee → foot parented transform chain (unit-ish bones).
  const hip = app.spawn(
    aperture.withTransform({ translation: [footX, HIP_HEIGHT, 0] }),
    aperture.withMesh(assets.marker),
    aperture.withMaterial(assets.hipMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  const knee = app.spawn(
    aperture.withTransform({ translation: [0, -BONE_LENGTH, 0], parent: hip }),
    aperture.withMesh(assets.marker),
    aperture.withMaterial(assets.kneeMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  const foot = app.spawn(
    aperture.withTransform({ translation: [0, -BONE_LENGTH, 0], parent: knee }),
    aperture.withMesh(assets.marker),
    aperture.withMaterial(assets.footMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  // A visual marker for the raycast-found foot target.
  const targetMarker = app.spawn(
    aperture.withTransform({ translation: [footX, 0, 0] }),
    aperture.withMesh(assets.marker),
    aperture.withMaterial(assets.targetMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  // The pole hint decides which way the knee bends (front = toward +z/camera).
  const poleSign = poleSide === "back" ? -1 : 1;
  const polePosition = [footX, HIP_HEIGHT - BONE_LENGTH, poleSign * 2];

  const solver = app.spawn(
    aperture.withIk({
      constraints: [
        {
          kind: "two-bone",
          root: hip,
          mid: knee,
          end: foot,
          targetPosition: [footX, 0, 0],
          polePosition,
          weight: 1,
        },
      ],
    }),
  );
  const constraint = solver.getValue(aperture.Ik, "state").constraints[0];

  // Settle physics so the ramp collider exists in the backend, then raycast
  // straight down under the foot to find the ground surface.
  for (let i = 0; i < SETTLE_STEPS; i += 1) {
    app.step(FIXED_DELTA, i * FIXED_DELTA);
  }

  const ray = {
    origin: [footX, RAY_ORIGIN_HEIGHT, 0],
    direction: [0, -1, 0],
    maxDistance: RAY_MAX_DISTANCE,
  };
  const hit = backend.raycastFirst(ray) ?? null;
  const groundPoint = hit
    ? [hit.point[0] ?? footX, hit.point[1] ?? 0, hit.point[2] ?? 0]
    : [footX, 0, 0];

  // Plant the foot ON the surface (raise it by half the foot marker so it rests
  // on top rather than sinking into the ramp).
  const footTarget = [groundPoint[0], groundPoint[1] + 0.17, groundPoint[2]];
  constraint.targetPosition = footTarget;
  targetMarker
    .getVectorView(aperture.LocalTransform, "translation")
    .set(footTarget);

  // One solve step: the analytic two-bone IK plants the foot on the target.
  app.step(FIXED_DELTA, SETTLE_STEPS * FIXED_DELTA);

  const hipPos = worldPosition(aperture, hip);
  const kneePos = worldPosition(aperture, knee);
  const footPos = worldPosition(aperture, foot);
  const footError = Math.hypot(
    footPos[0] - footTarget[0],
    footPos[1] - footTarget[1],
    footPos[2] - footTarget[2],
  );

  return {
    app,
    status: {
      footX,
      pole: poleSide,
      settleSteps: SETTLE_STEPS,
      rayHit: hit
        ? {
            point: round3(groundPoint),
            distance: Number((hit.distance ?? 0).toFixed(5)),
          }
        : null,
      pose: {
        hip: round5(hipPos),
        knee: round5(kneePos),
        foot: round5(footPos),
        target: round5(footTarget),
        footError: Number(footError.toFixed(5)),
        // The foot planted on the raycast surface height within tolerance.
        planted: footError < 0.02,
      },
    },
  };
}

function worldPosition(aperture, entity) {
  const column = entity.getVectorView(aperture.WorldTransform, "col3");
  return [column[0] ?? 0, column[1] ?? 0, column[2] ?? 0];
}

function round3(values) {
  return values.map((value) => Number(value.toFixed(3)));
}

function round5(values) {
  return values.map((value) => Number(value.toFixed(5)));
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
