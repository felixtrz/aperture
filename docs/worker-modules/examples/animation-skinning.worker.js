// M2-T9 proof route worker: imports a skinned + 3-morph-target + CUBICSPLINE
// GLB entirely through the public createApertureApp + spawn.gltf/spawn.animation
// API (no hand-rolled glb-viewer sampler), plays the clip, and posts the
// extracted snapshot + engine-owned animation status for the main thread to
// render. `init.animationTime` selects the rendered clip phase; `init.morph`
// sets the 3rd morph target's weight.
import { createApertureApp } from "/aperture/worker-modules/packages/app/dist/index.js";
import { asset, defineApertureConfig } from "/aperture/worker-modules/packages/app/dist/config.js";
import {
  Animation,
  renderSnapshotTransferList,
} from "/aperture/worker-modules/packages/runtime/dist/index.js";
import {
  LightKind,
  Mesh,
  MorphTargetWeights,
  createMorphTargetWeights,
} from "/aperture/worker-modules/packages/render/dist/index.js";
import {
  ASSET_KEY,
  CLIP_NAME,
  MORPH_TARGET_COUNT,
  SKIN_JOINT_COUNT,
  animationSkinningDataUrl,
  clearColor,
} from "./animation-skinning-scene.js";

let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The animation-skinning worker raised an error.",
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
      scene = await createWorkerScene(
        data.canvas ?? { width: 960, height: 960 },
        finiteNumber(data.animationTime, 0),
        finiteNumber(data.morph, 1),
      );
      self.postMessage({ type: "ready", scene: scene.status });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Animation-skinning worker scene is not initialized.");
      }
      const snapshot = scene.app.extract(
        Number.isInteger(data.frame) ? data.frame : 1,
      );
      self.postMessage(
        {
          type: "snapshot",
          frame: data.frame ?? 1,
          snapshot,
          status: scene.status,
          workerStep: {
            meshDraws: snapshot.meshDraws.length,
            morphedDraws: snapshot.meshDraws.filter(
              (draw) => draw.batchKey.morphed,
            ).length,
            skinnedDraws: snapshot.meshDraws.filter(
              (draw) => draw.batchKey.skinned,
            ).length,
            bones: (snapshot.bones?.length ?? 0) / 16,
            morphTargetCount: snapshot.meshDraws[0]?.morphTargetCount ?? 0,
          },
        },
        renderSnapshotTransferList(snapshot),
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

async function createWorkerScene(canvasSize, animationTime, morphWeight) {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      assets: {
        [ASSET_KEY]: asset.gltf(animationSkinningDataUrl(), {
          preload: "blocking",
        }),
      },
    }),
  });

  const handle = app.context.assets.gltf(ASSET_KEY);
  const loadedScene = handle.scene.value;
  const jointCount = loadedScene?.skin?.skins?.[0]?.jointCount ?? 0;

  const root = app.context.spawn.gltf(handle);
  const animation = app.context.spawn.animation(root);

  // The imported renderable mesh entity carries morphTargetData; attach a
  // MorphTargetWeights so the 3rd target contributes at `morphWeight`.
  const state = root.getValue(Animation, "state");
  for (const entity of state.targets.values()) {
    if (entity.hasComponent(Mesh)) {
      entity.addComponent(
        MorphTargetWeights,
        createMorphTargetWeights({ weights: [0, 0, morphWeight] }),
      );
      break;
    }
  }

  app.context.spawn.camera({
    transform: { translation: [0, 0, 4] },
    camera: {
      aspect: canvasSize.width / Math.max(1, canvasSize.height),
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    },
  });
  app.context.spawn.light({
    kind: LightKind.Ambient,
    color: [1, 1, 1, 1],
    intensity: 0.7,
  });

  animation.playClip(CLIP_NAME, { loop: "loop" });
  // Advance to the requested clip phase, then apply the pose with a zero-delta
  // step so the sampled joint/morph state is written before extraction.
  if (animationTime > 0) {
    animation.seek(animationTime);
  }
  app.step(0);

  return {
    app,
    status: {
      activeClip: animation.activeClipId,
      time: Number(animation.time.toFixed(4)),
      steppedBy: animationTime,
      jointCount,
      morphTargetCount: MORPH_TARGET_COUNT,
      morphWeight,
      clipIds: animation.clipIds,
      expectedJointCount: SKIN_JOINT_COUNT,
    },
  };
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
