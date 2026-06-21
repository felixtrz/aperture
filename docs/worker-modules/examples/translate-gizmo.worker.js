import {
  createApertureApp,
  createTranslateGizmo,
  defineApertureConfig,
} from "/aperture/worker-modules/packages/app/dist/index.js";
import { material, mesh } from "/aperture/worker-modules/packages/app/dist/systems.js";
import { Pickable, createPickable } from "/aperture/worker-modules/packages/render/dist/index.js";
import { WorldTransform } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { renderSnapshotTransferList } from "/aperture/worker-modules/packages/runtime/dist/index.js";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
} from "/aperture/worker-modules/packages/app/dist/asset-mirror.js";

// M7-T9 render-control route (translate gizmo): a selected box at the origin with
// a createTranslateGizmo (3 axis-handle Pickable meshes parented to it). The main
// thread forwards a scripted pointer press + horizontal drag over the X handle;
// the gizmo (driven by the M7-T8 interaction layer + M7-T7 camera ray) projects
// the pointer motion onto world X and writes the target's LocalTransform — proven
// by the published target/handle WorldTransform translations (X moves, Y/Z fixed,
// the handle follows). Headless/worker-safe: input is the forwarded pointer signal.

let scene = null;
const sourceAssetState = createSourceAssetSerializationState();

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The translate-gizmo simulation worker errored.",
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

  const gizmo = createTranslateGizmo(ctx, {
    target: { index: target.index, generation: target.generation },
    size: 3,
    thickness: 0.5,
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

function worldTranslation(entity) {
  const col3 = entity.getVectorView(WorldTransform, "col3");
  return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}

function gizmoState(scene) {
  const world = scene.app.lowLevel.world;
  const handleX = world.entityManager.getEntityByIndex(
    scene.gizmo.handles.x.index,
  );
  return {
    target: worldTranslation(scene.target),
    handleX: handleX === null ? null : worldTranslation(handleX),
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
