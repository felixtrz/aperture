import {
  createApertureApp,
  createRotateGizmo,
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

// H2 render-control route (rotate gizmo): a selected box at the origin with a
// createRotateGizmo (three axis-ring Pickable tori parented to it, snapAngle =
// π/4). The main thread forwards a scripted pointer press + arc drag over the
// +Z ring's first-quadrant diagonal; the gizmo (driven by the same interaction
// frame + camera ray as the translate gizmo) projects the pointer ray onto the
// ring plane, measures the swept angle, snaps it, and writes the target's
// LocalTransform rotation quaternion — proven by the published before/after
// rotation (a pure +Z rotation of exactly π/4). Headless/worker-safe.

let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The rotate-gizmo simulation worker errored.",
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

  const gizmo = createRotateGizmo(ctx, {
    target: { index: target.index, generation: target.generation },
    size: 3,
    thickness: 0.12,
    snapAngle: Math.PI / 4,
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

function localRotation(entity) {
  const r = entity.getVectorView(LocalTransform, "rotation");
  return [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 1];
}

function gizmoState(scene) {
  return {
    rotation: localRotation(scene.target),
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
