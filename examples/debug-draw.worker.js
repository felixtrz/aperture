import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import { createPhysicsAabbDebugLines } from "@aperture-engine/physics";
import { renderSnapshotTransferList } from "@aperture-engine/runtime";
import {
  clearColor,
  cyanColor,
  debugDrawCanvasSize,
  gridDivisions,
  greyColor,
  lineWidthPx,
  magentaColor,
  orangeColor,
  sphereSegments,
} from "./debug-draw-scene.js";

let scene = null;

/**
 * The debug-draw system. `update()` runs every frame and draws the whole
 * overlay through the immediate-mode `this.debugDraw` API; each primitive lasts
 * exactly one frame.
 */
class DebugDrawSystem extends createSystem() {
  update() {
    const debug = this.debugDraw;

    // AxesHelper analog — 3 colored segments (X red, Y green, Z blue).
    debug.axes([-1.05, -0.75, 0], 0.5, lineWidthPx);

    // Box3Helper analog — a 12-edge cyan wireframe box, face-on to the camera.
    debug.aabb([-0.55, -0.45, -0.1], [0.55, 0.45, 0.1], cyanColor, lineWidthPx);

    // SphereHelper analog — 3 great-circle rings; the XY ring faces the camera.
    debug.sphere([0.0, 0.15, 0], 0.34, magentaColor, {
      segments: sphereSegments,
      width: lineWidthPx,
    });

    // GridHelper analog — a ground grid on the XZ plane.
    debug.grid({
      size: 1.6,
      divisions: gridDivisions,
      color: greyColor,
      width: 2,
    });

    // Physics debug geometry (AC2) — real physics collider-AABB wireframe lines
    // routed through the SAME overlay sink as every other debug primitive.
    debug.physics(
      {
        lines: createPhysicsAabbDebugLines(
          [{ min: [0.55, -0.85, -0.05], max: [1.05, -0.35, 0.05] }],
          orangeColor,
        ),
      },
      lineWidthPx,
    );
  }
}

function spawnDebugDrawScene(app, canvasSize) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.context.spawn.camera({
    transform: { translation: [0, 0, 5] },
    camera: {
      projection: "orthographic",
      orthographicHeight: 2,
      aspect,
      near: 0.1,
      far: 20,
      layerMask: 1,
      clearColor,
    },
  });
}

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The debug-draw worker raised an error.",
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
    if (data?.type === "init") {
      scene = await createWorkerScene(
        data.canvas ?? debugDrawCanvasSize,
        data.debugDraw !== false,
      );
      self.postMessage({ type: "ready", debugDraw: scene.debugDrawEnabled });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("debug-draw worker scene is not initialized.");
      }

      const frame = Number.isInteger(data.frame) ? data.frame : 1;

      scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            debugDraw: snapshot.report.debugDraw ?? null,
            debugSegments: snapshot.debugLines?.segmentCount ?? 0,
            diagnostics: snapshot.diagnostics.length,
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

async function createWorkerScene(canvasSize, debugDrawEnabled) {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      debugDraw: debugDrawEnabled,
    }),
    systems: [{ default: DebugDrawSystem }],
    worldOptions: { entityCapacity: 16 },
  });

  spawnDebugDrawScene(app, canvasSize);

  return { app, debugDrawEnabled };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
