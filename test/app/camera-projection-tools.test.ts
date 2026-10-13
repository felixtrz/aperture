import { describe, expect, it } from "vitest";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import {
  callCameraTool,
  createGeneratedEntityToolBridge,
  type CameraToolState,
} from "@aperture-engine/app/headless-tools";
import { Camera, type RenderSnapshot } from "@aperture-engine/render";
import type { SimulationMessagePort } from "@aperture-engine/runtime";
import { createGeneratedDevtoolsBridge } from "../../packages/app/src/worker/devtools/bridge.js";

async function harness() {
  const runner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [],
  });
  const camera = runner.app.context.spawn.camera({
    key: "camera.main",
    transform: { translation: [0, 0, 0] },
    camera: { aspect: 2, autoAspect: false },
  });
  const saved = new Map<string, CameraToolState>();
  const call = (payload: unknown, viewportAspect?: number) =>
    callCameraTool(
      runner.app,
      createApertureDevtoolsRequest({
        requestId: "projection",
        tool: "camera_set_projection",
        payload,
      }),
      saved,
      viewportAspect,
    );
  const current = () =>
    callCameraTool(
      runner.app,
      createApertureDevtoolsRequest({
        requestId: "read",
        tool: "camera_get",
        payload: { key: "camera.main" },
      }),
      saved,
    );
  return { runner, camera, call, current };
}

function projection(snapshot: RenderSnapshot): Float32Array {
  const offset = snapshot.views[0]!.viewProjectionMatrixOffset;
  return snapshot.viewMatrices.slice(offset, offset + 16);
}
function clipDepth(matrix: Float32Array, distance: number): number {
  return (
    (-distance * matrix[10]! + matrix[14]!) /
    (-distance * matrix[11]! + matrix[15]!)
  );
}

describe("semantic camera projection", () => {
  it("writes a complete camera projection without stepping, then publishes it in the next real extraction", async () => {
    const h = await harness();
    try {
      const first = h.runner.step(0, 0).snapshot;
      const previous = projection(first);
      const nextFrame = h.runner.getStatus().nextFrame;
      const found = h.runner.entities.find({ key: "camera.main" });
      const ref = found.summaries[0]!.entity;
      expect(h.runner.entities.get(ref)).toMatchObject({
        ok: true,
        summary: { key: "camera.main" },
      });
      const updated = h.call({
        entity: ref,
        projection: "perspective",
        fovYDegrees: 90,
        near: 2,
        far: 80,
      });
      expect(updated).toMatchObject({
        ok: true,
        result: {
          entity: ref,
          key: "camera.main",
          camera: {
            projection: "perspective",
            fovYRadians: Math.fround(Math.PI / 2),
            near: 2,
            far: 80,
          },
        },
      });
      expect(h.runner.getStatus().nextFrame).toBe(nextFrame);
      expect(projection(first)).toEqual(previous);
      const second = h.runner.step(0, 0).snapshot;
      expect(second.frame).toBe(first.frame + 1);
      const matrix = projection(second);
      expect(matrix).not.toEqual(previous);
      expect(matrix[0]).toBeCloseTo(0.5, 6);
      expect(matrix[5]).toBeCloseTo(1, 6);
      expect(clipDepth(matrix, 2)).toBeCloseTo(0, 6);
      expect(clipDepth(matrix, 80)).toBeCloseTo(1, 6);

      expect(
        h.call({
          key: "camera.main",
          projection: "orthographic",
          orthographicHeight: 8,
        }),
      ).toMatchObject({
        ok: true,
        result: {
          camera: {
            projection: "orthographic",
            near: 2,
            far: 80,
            orthographicHeight: 8,
            fovYRadians: Math.fround(Math.PI / 2),
          },
        },
      });
      const ortho = projection(h.runner.step(0, 0).snapshot);
      expect(ortho[0]).toBeCloseTo(1 / 8, 6);
      expect(ortho[5]).toBeCloseTo(1 / 4, 6);
      expect(clipDepth(ortho, 2)).toBeCloseTo(0, 6);
      expect(clipDepth(ortho, 80)).toBeCloseTo(1, 6);
    } finally {
      expect(await disposeApertureApp(h.runner.app)).toEqual([]);
    }
  });

  it.each([
    ["empty patch", {}],
    ["raw radians", { fovYRadians: 1 }],
    [
      "unknown field after valid values",
      { fovYDegrees: 45, near: 1, far: 20, aspect: 2 },
    ],
    ["unknown mode", { projection: "panoramic" }],
    ["null mode", { projection: null }],
    ["string number", { near: "1" }],
    ["null number", { far: null }],
    ["undefined number", { near: undefined }],
    ["nonfinite", { fovYDegrees: Number.NaN }],
    ["infinite", { far: Infinity }],
    ["zero FOV", { fovYDegrees: 0 }],
    ["180-degree FOV", { fovYDegrees: 180 }],
    ["rounded 180-degree FOV", { fovYDegrees: 180 - 1e-9 }],
    ["underflow FOV", { fovYDegrees: 1e-50 }],
    ["underflow clip", { near: 1e-50 }],
    ["overflow clip", { far: 1e40 }],
    ["reversed clips", { near: 10, far: 1 }],
    ["clips round to equal", { near: 1, far: 1 + 1e-9 }],
    [
      "Float32 matrix overflow",
      { projection: "orthographic", near: 1e-40, far: 2e-40 },
    ],
    [
      "late invalid height",
      { fovYDegrees: 45, near: 1, far: 20, orthographicHeight: -1 },
    ],
    [
      "ambiguous selector",
      { key: "camera.main", entity: { index: 0, generation: 0 }, near: 1 },
    ],
    [
      "fractional reference",
      { entity: { index: 0.5, generation: 0 }, near: 1 },
    ],
    ["empty selector", { key: "", near: 1 }],
    ["missing camera", { key: "absent", near: 1 }],
    ["nonobject payload", null],
  ])(
    "rejects %s without changing any camera or transform field",
    async (_name, patch) => {
      const h = await harness();
      try {
        const before = h.current();
        const result = h.call(patch);
        expect(result).toMatchObject({
          ok: false,
          diagnostics: [
            { severity: "error", suggestedFix: expect.any(String) },
          ],
        });
        expect(h.current()).toEqual(before);
        expect(h.runner.getStatus().nextFrame).toBe(0);
      } finally {
        await disposeApertureApp(h.runner.app);
      }
    },
  );

  it("checks effective automatic aspect before committing an otherwise valid patch", async () => {
    const h = await harness();
    try {
      h.camera.setValue(Camera, "autoAspect", true);
      const before = h.current();
      expect(h.call({ near: 1, far: 20 }, 0)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.camera.projection.invalidAspect" }],
      });
      expect(h.current()).toEqual(before);
    } finally {
      await disposeApertureApp(h.runner.app);
    }
  });

  it("routes success and atomic rejection through the normal worker bridge with camera summary readback", async () => {
    const h = await harness();
    try {
      const responses: unknown[] = [];
      const bridge = createGeneratedDevtoolsBridge({
        app: h.runner.app,
        entityTools: createGeneratedEntityToolBridge(
          h.runner.app.lowLevel.world,
        ),
        port: {
          postMessage(value: unknown) {
            responses.push(structuredClone(value));
          },
        } as SimulationMessagePort,
        enqueueInputEvent() {},
        setPaused() {},
        step() {
          return {};
        },
        getSimulationState() {
          return {};
        },
      });
      bridge.handle(
        createApertureDevtoolsRequest({
          requestId: "set-projection",
          tool: "camera_set_projection",
          payload: { key: "camera.main", fovYDegrees: 60, near: 0.5, far: 50 },
        }),
      );
      expect(responses[0]).toMatchObject({
        requestId: "set-projection",
        ok: true,
        result: {
          key: "camera.main",
          camera: { near: 0.5, far: 50, fovYRadians: Math.fround(Math.PI / 3) },
        },
      });
      const before = h.current();
      bridge.handle(
        createApertureDevtoolsRequest({
          requestId: "bad-projection",
          tool: "camera_set_projection",
          payload: { key: "camera.main", fovYDegrees: 20, near: 100, far: 1 },
        }),
      );
      expect(responses[1]).toMatchObject({
        requestId: "bad-projection",
        ok: false,
        diagnostics: [{ code: "aperture.camera.projection.invalidClipRange" }],
      });
      expect(h.current()).toEqual(before);
      expect(
        clipDepth(projection(h.runner.step(0, 0).snapshot), 0.5),
      ).toBeCloseTo(0, 6);
    } finally {
      await disposeApertureApp(h.runner.app);
    }
  });
});
