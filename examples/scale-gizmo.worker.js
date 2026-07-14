import {
  createApertureApp,
  createScaleGizmo,
  defineApertureConfig,
} from "@aperture-engine/app";
import { material, mesh } from "@aperture-engine/app/systems";
import { Pickable, createPickable } from "@aperture-engine/render";
import { LocalTransform } from "@aperture-engine/simulation";
import { renderSnapshotTransferList } from "@aperture-engine/runtime";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/worker-modules/packages/app/dist/asset-mirror.js";

// H2 render-control route (scale gizmo): a selected box at the origin with a
// createScaleGizmo (three axis-handle Pickable boxes + a uniform center handle
// parented to it, snapIncrement = 0.5). The main thread forwards a scripted
// pointer press + horizontal drag over the +X handle; the gizmo (driven by the
// same interaction frame + camera ray as the translate gizmo) reuses the
// closest-point-on-axis projection to turn the drag into a scale factor, snaps
// the resulting scale, and writes the target's LocalTransform scale along X only
// — proven by the published before/after scale (X grows and snaps; Y/Z fixed).
// Headless/worker-safe.

let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The scale-gizmo simulation worker errored.",
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
      scene = await createScene(data.canvas ?? { width: 480, height: 360 });
      self.postMessage({ type: "ready", scene: gizmoState(scene) });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }
      const frame = finiteInteger(data.frame, 1);
      forwardPointer(scene, data.pointer);
      scene.gizmo.sync(scene.app.lowLevel.world);
      const snapshot = scene.app.stepAndExtract(
        finiteNumber(data.delta, 0),
        finiteNumber(data.time, 0),
        frame,
      );
      self.postMessage(
        {
          type: "snapshot",
          frame,
          phase: typeof data.phase === "string" ? data.phase : "idle",
          snapshot,
          sourceAssets: serializeSourceAssetRegistry(
            scene.app.lowLevel.assets,
            {
              state: sourceAssetState,
            },
          ),
          gizmo: gizmoState(scene),
          meshDraws: snapshot.meshDraws.length,
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

async function createScene(canvasSize) {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: true },
    }),
  });
  const ctx = app.context;

  ctx.spawn.camera({
    key: "camera.main",
    name: "gizmo-camera",
    transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
    fovYDegrees: 60,
    camera: { aspect: canvasSize.width / canvasSize.height },
  });
  const target = ctx.spawn.mesh({
    key: "gizmo.target",
    name: "gizmo-target",
    mesh: mesh.box({ size: 1.2 }),
    material: material.standard({
      baseColor: [0.85, 0.7, 0.2, 1],
      roughness: 0.5,
    }),
  });
  target.addComponent(Pickable, createPickable({ enabled: true }));

  const gizmo = createScaleGizmo(ctx, {
    target: { index: target.index, generation: target.generation },
    size: 3,
    thickness: 0.5,
    uniform: true,
    snapIncrement: 0.5,
  });

  return { app, target, gizmo };
}

function forwardPointer(scene, pointer) {
  const primary = scene.app.context.input.pointer.primary;
  if (
    pointer &&
    typeof pointer.x === "number" &&
    typeof pointer.y === "number"
  ) {
    primary.position.value = [pointer.x, pointer.y];
  }
  primary.pressed.value = pointer?.pressed === true;
}

function localScale(entity) {
  const s = entity.getVectorView(LocalTransform, "scale");
  return [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1];
}

function gizmoState(scene) {
  return {
    scale: localScale(scene.target),
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
