// F1 proof route worker (Animation mixer v2). Builds a two-bone rig driven
// entirely through the engine AnimationMixer N-lane API: idle/walk/run lanes
// weighted by a `speed` signal (a locomotion blend space) plus an ADDITIVE
// head-look lane weighted by `look`. It advances a fixed deterministic step
// schedule, then posts the extracted render snapshot AND the sampled bone pose
// (hip height + head rotation + per-lane effective weights) for the e2e to
// assert. No hand-rolled sampling — the mixer owns playback.
import * as simulation from "@aperture-engine/simulation";
import * as render from "@aperture-engine/render";
import * as runtime from "@aperture-engine/runtime";
import {
  HEAD_REST,
  HIP_REST,
  STEP_COUNT,
  STEP_DT,
  blendWeights,
  buildLocomotionClips,
  clearColor,
  expectedHipHeight,
  registerLocomotionMarkerAssets,
} from "./locomotion-blend-scene.js";

const aperture = { ...simulation, ...render, ...runtime };
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The locomotion-blend worker raised an error.",
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
    if (data?.type === "init") {
      scene = createWorkerScene(
        data.canvas ?? { width: 960, height: 960 },
        finiteNumber(data.speed, 0),
        finiteNumber(data.look, 0),
      );
      self.postMessage({ type: "ready", scene: scene.status });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Locomotion-blend worker scene is not initialized.");
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

function createWorkerScene(canvasSize, speed, look) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 32 },
  });
  const assets = registerLocomotionMarkerAssets(aperture, app.assets);

  app.spawn(
    aperture.withTransform({ translation: [0, 0.6, 6] }),
    aperture.withCamera({
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
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
      intensity: 0.55,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.5, 3, 2] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.96, 0.9, 1],
      intensity: 2.4,
      layerMask: 1,
    }),
  );

  const hip = app.spawn(
    aperture.withTransform({ translation: [...HIP_REST] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.hipMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  const head = app.spawn(
    aperture.withTransform({ translation: [...HEAD_REST] }),
    aperture.withMesh(assets.mesh),
    aperture.withMaterial(assets.headMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  const clips = buildLocomotionClips(aperture);
  const targets = new Map([
    ["hip", hip],
    ["head", head],
  ]);
  const root = app.spawn(
    aperture.withAnimation({
      clips: [
        { id: "idle", clip: clips.idle },
        { id: "walk", clip: clips.walk },
        { id: "run", clip: clips.run },
        { id: "headLook", clip: clips.headLook },
      ],
      targets,
    }),
  );

  // Configure the N-lane blend: three weighted locomotion lanes selected by the
  // speed signal, plus an additive head-look lane weighted by `look`.
  const mixer = root.getValue(aperture.Animation, "state").mixer;
  const weights = blendWeights(speed);
  mixer.playLane("idle", { weight: weights.idle, loop: "repeat" });
  mixer.playLane("walk", { weight: weights.walk, loop: "repeat" });
  mixer.playLane("run", { weight: weights.run, loop: "repeat" });
  mixer.playLane("headLook", {
    additive: true,
    weight: clampUnit(look),
    loop: "repeat",
  });

  // Advance a fixed, deterministic step schedule. Each step runs the animation
  // driver (which advances the mixer and writes the blended pose into the bone
  // LocalTransforms) before transform resolution + extraction.
  for (let i = 0; i < STEP_COUNT; i += 1) {
    app.step(STEP_DT, i * STEP_DT);
  }

  const hipTranslation = Array.from(
    hip.getVectorView(aperture.LocalTransform, "translation"),
    (value) => Number(value.toFixed(5)),
  );
  const headRotation = Array.from(
    head.getVectorView(aperture.LocalTransform, "rotation"),
    (value) => Number(value.toFixed(5)),
  );

  return {
    app,
    status: {
      speed,
      look: clampUnit(look),
      steps: STEP_COUNT,
      weights: {
        idle: Number(weights.idle.toFixed(5)),
        walk: Number(weights.walk.toFixed(5)),
        run: Number(weights.run.toFixed(5)),
      },
      pose: {
        hip: hipTranslation,
        head: headRotation,
        expectedHipHeight: Number(expectedHipHeight(speed).toFixed(5)),
      },
      lanes: mixer.laneStates,
      clipIds: mixer.clipIds,
    },
  };
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampUnit(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
