import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import {
  WorldTransform,
  createRootTransform,
} from "@aperture-engine/simulation";
import {
  callCameraTool,
  type CameraToolState,
} from "../../packages/app/src/worker/devtools/camera.js";

async function createCameraToolHarness() {
  const app = await createApertureApp({
    config: defineApertureConfig({ mode: "headless", systems: [] }),
    systems: [],
  });
  const savedCameraStates = new Map<string, CameraToolState>();
  let requestId = 0;
  const call = (tool: string, payload?: unknown) =>
    callCameraTool(
      app,
      createApertureDevtoolsRequest({
        requestId: `camera-test-${(requestId += 1)}`,
        tool,
        ...(payload === undefined ? {} : { payload }),
      }),
      savedCameraStates,
    );

  return { app, call, savedCameraStates };
}

function resultRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf("object");
  return value as Record<string, unknown>;
}

function diagnosticCode(result: {
  readonly diagnostics?: readonly unknown[];
}): unknown {
  const first = result.diagnostics?.[0];
  return typeof first === "object" && first !== null
    ? (first as { readonly code?: unknown }).code
    : undefined;
}

describe("generated devtools camera tools", () => {
  it("lists no cameras in a fresh world and reports unknown tools", async () => {
    const { call } = await createCameraToolHarness();

    expect(call("camera_list")).toEqual({ ok: true, result: [] });

    // Camera resolution runs before tool dispatch, so an unknown tool first
    // needs a resolvable camera to reach the unsupported-tool diagnostic.
    call("camera_create_agent", {});
    const unknown = call("camera_unknown_tool");
    expect(unknown.ok).toBe(false);
    expect(diagnosticCode(unknown)).toBe("aperture.camera.unsupportedTool");
  });

  it("returns a camera-not-found diagnostic when no camera exists", async () => {
    const { call } = await createCameraToolHarness();
    const missing = call("camera_get");

    expect(missing.ok).toBe(false);
    expect(diagnosticCode(missing)).toBe("aperture.camera.notFound");
  });

  it("creates an agent camera once per key and finds it by key", async () => {
    const { call } = await createCameraToolHarness();

    const created = resultRecord(
      call("camera_create_agent", { key: "camera.agent" }).result,
    );
    expect(created["key"]).toBe("camera.agent");

    const again = resultRecord(
      call("camera_create_agent", { key: "camera.agent" }).result,
    );
    expect(again["entity"]).toEqual(created["entity"]);

    const listed = call("camera_list");
    expect(listed.ok).toBe(true);
    expect(listed.result).toHaveLength(1);

    const byKey = call("camera_get", { key: "camera.agent" });
    expect(byKey.ok).toBe(true);
    expect(resultRecord(byKey.result)["entity"]).toEqual(created["entity"]);

    const byRef = call("camera_get", { entity: created["entity"] });
    expect(byRef.ok).toBe(true);

    const stale = call("camera_get", { key: "camera.other" });
    expect(stale.ok).toBe(false);
    expect(diagnosticCode(stale)).toBe("aperture.camera.notFound");
  });

  it("sets, saves, and restores camera transforms by slot", async () => {
    const { call } = await createCameraToolHarness();
    call("camera_create_agent", { key: "camera.agent" });

    const moved = call("camera_set_transform", {
      key: "camera.agent",
      translation: [1, 2, 3],
    });
    expect(moved.ok).toBe(true);
    const movedTransform = resultRecord(
      resultRecord(moved.result)["localTransform"],
    );
    expect(movedTransform["translation"]).toEqual([1, 2, 3]);

    expect(call("camera_save", { key: "camera.agent", slot: "a" }).ok).toBe(
      true,
    );

    call("camera_set_transform", {
      key: "camera.agent",
      translation: [9, 9, 9],
    });

    const missingSlot = call("camera_restore", {
      key: "camera.agent",
      slot: "missing",
    });
    expect(missingSlot.ok).toBe(false);
    expect(diagnosticCode(missingSlot)).toBe(
      "aperture.camera.savedStateMissing",
    );

    const restored = call("camera_restore", { key: "camera.agent", slot: "a" });
    expect(restored.ok).toBe(true);
    expect(
      resultRecord(resultRecord(restored.result)["localTransform"])[
        "translation"
      ],
    ).toEqual([1, 2, 3]);
  });

  it("aims the camera with look-at and orbit placements", async () => {
    const { call } = await createCameraToolHarness();
    call("camera_create_agent", { key: "camera.agent" });

    const lookAt = call("camera_look_at", {
      key: "camera.agent",
      translation: [0, 0, 5],
      target: [0, 0, 0],
    });
    expect(lookAt.ok).toBe(true);
    const lookTransform = resultRecord(
      resultRecord(lookAt.result)["localTransform"],
    );
    expect(lookTransform["translation"]).toEqual([0, 0, 5]);
    // Looking from +Z toward the origin is a 180° yaw: |y| = sin(π/2) = 1.
    const rotation = lookTransform["rotation"] as readonly number[];
    expect(Math.abs(rotation[1] ?? 0)).toBeCloseTo(1, 5);

    const orbit = call("camera_orbit", {
      key: "camera.agent",
      target: [0, 0, 0],
      radius: 10,
      yawDegrees: 0,
      pitchDegrees: 0,
    });
    expect(orbit.ok).toBe(true);
    const orbitTranslation = resultRecord(
      resultRecord(orbit.result)["localTransform"],
    )["translation"] as readonly number[];
    expect(orbitTranslation[0]).toBeCloseTo(0, 5);
    expect(orbitTranslation[1]).toBeCloseTo(0, 5);
    expect(orbitTranslation[2]).toBeCloseTo(10, 5);
  });

  it("fits entities by world transform and diagnoses unusable targets", async () => {
    const { app, call } = await createCameraToolHarness();
    call("camera_create_agent", { key: "camera.agent" });

    const target = app.lowLevel.world.createEntity();
    const root = createRootTransform({ translation: [4, 0, 0] });
    target.addComponent(WorldTransform, root.world);

    const fit = call("camera_fit_entity", {
      key: "camera.agent",
      entity: { index: target.index, generation: target.generation },
      radius: 2,
      yawDegrees: 0,
      pitchDegrees: 0,
    });
    expect(fit.ok).toBe(true);
    const fitTranslation = resultRecord(
      resultRecord(fit.result)["localTransform"],
    )["translation"] as readonly number[];
    expect(fitTranslation[0]).toBeCloseTo(4, 5);
    expect(fitTranslation[2]).toBeCloseTo(2, 5);

    const missing = call("camera_fit_entity", {
      key: "camera.agent",
      entity: { index: target.index + 7, generation: 0 },
    });
    expect(missing.ok).toBe(false);
    expect(diagnosticCode(missing)).toBe("aperture.camera.targetNotFound");

    const bare = app.lowLevel.world.createEntity();
    const noTransform = call("camera_fit_entity", {
      key: "camera.agent",
      entity: { index: bare.index, generation: bare.generation },
    });
    expect(noTransform.ok).toBe(false);
    expect(diagnosticCode(noTransform)).toBe(
      "aperture.camera.targetMissingWorldTransform",
    );
  });

  it("promotes a camera to the full-viewport agent view", async () => {
    const { call } = await createCameraToolHarness();
    call("camera_create_agent", { key: "camera.agent" });

    const result = call("camera_use_agent_view", { key: "camera.agent" });
    expect(result.ok).toBe(true);
    const camera = resultRecord(resultRecord(result.result)["camera"]);
    expect(camera["priority"]).toBe(10_000);
    expect(camera["viewport"]).toEqual([0, 0, 1, 1]);
    expect(camera["scissor"]).toEqual([0, 0, 1, 1]);
  });

  it("defaults camera_use_agent_view to the agent camera, never the first camera (F9)", async () => {
    const { app, call } = await createCameraToolHarness();

    // A user-authored main camera exists first (so it is cameraEntities[0]).
    app.context.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
    });

    // With no agent camera, an argument-less call must not silently promote
    // the main camera.
    const missing = call("camera_use_agent_view");
    expect(missing.ok).toBe(false);
    expect(diagnosticCode(missing)).toBe("aperture.camera.notFound");

    const mainBefore = resultRecord(
      call("camera_get", { key: "camera.main" }).result,
    );
    expect(resultRecord(mainBefore["camera"])["priority"]).not.toBe(10_000);

    // With the agent camera present, the argument-less call targets it.
    call("camera_create_agent", {});
    const used = call("camera_use_agent_view");
    expect(used.ok).toBe(true);
    expect(resultRecord(used.result)["key"]).toBe("camera.agent");

    const mainAfter = resultRecord(
      call("camera_get", { key: "camera.main" }).result,
    );
    expect(resultRecord(mainAfter["camera"])["priority"]).not.toBe(10_000);
  });
});
