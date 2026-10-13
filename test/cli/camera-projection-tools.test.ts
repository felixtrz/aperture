vi.mock(
  "../../packages/cli/src/headless/realm-client.js",
  async () => import("../helpers/headless-realm-built.js"),
);
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { disposeApertureApp } from "@aperture-engine/app/advanced";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import {
  callCameraTool,
  type CameraToolState,
} from "@aperture-engine/app/headless-tools";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { APERTURE_MCP_TOOL_CATALOG } from "../../packages/cli/src/tools/catalog.js";
import { callBrowserBackedTool } from "../../packages/cli/src/tools/dispatch.js";
import { RUNTIME_GLOBAL } from "../../packages/cli/src/tools/types.js";
import type { AperturePage } from "../../packages/cli/src/tools/browser.js";
import type { ApertureDevSession } from "../../packages/cli/src/session.js";

describe("camera projection tool integration", () => {
  it("advertises explicit degree units and both headed and headless routing", () => {
    expect(
      APERTURE_MCP_TOOL_CATALOG.find(
        (tool) => tool.name === "camera_set_projection",
      ),
    ).toMatchObject({
      description: expect.stringContaining("degrees"),
      annotations: { readOnlyHint: false },
      _meta: { aperture: { targets: ["headed", "headless"] } },
      inputSchema: {
        properties: {
          target: { enum: ["headed", "headless"] },
          projection: { enum: ["perspective", "orthographic"] },
          fovYDegrees: {
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 180,
          },
          near: { type: "number", exclusiveMinimum: 0 },
          far: { type: "number", exclusiveMinimum: 0 },
          orthographicHeight: { type: "number", exclusiveMinimum: 0 },
        },
      },
    });
  });

  it("headed dispatch invokes the real shared camera operation without a browser or changing the simulation clock", async () => {
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
    runner.app.context.spawn.camera({ key: "camera.main" });
    const globals = globalThis as unknown as Record<string, unknown>;
    const previous = globals[RUNTIME_GLOBAL];
    const saved = new Map<string, CameraToolState>();
    globals[RUNTIME_GLOBAL] = {
      callTool(tool: string, payload: unknown) {
        return callCameraTool(
          runner.app,
          createApertureDevtoolsRequest({
            requestId: "headed-projection",
            tool,
            payload,
          }),
          saved,
        );
      },
    };
    const page = {
      async evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A) {
        return fn(arg);
      },
    } as unknown as AperturePage;
    try {
      expect(
        await callBrowserBackedTool(
          page,
          {} as ApertureDevSession,
          "camera_set_projection",
          {
            key: "camera.main",
            fovYDegrees: 60,
            near: 1,
            far: 40,
          },
        ),
      ).toMatchObject({
        ok: true,
        result: {
          key: "camera.main",
          camera: { near: 1, far: 40, fovYRadians: Math.fround(Math.PI / 3) },
        },
        diagnostics: [],
      });
      expect(runner.getStatus().nextFrame).toBe(0);
    } finally {
      if (previous === undefined) delete globals[RUNTIME_GLOBAL];
      else globals[RUNTIME_GLOBAL] = previous;
      await disposeApertureApp(runner.app);
    }
  }, 30000);

  it("routes MCP projection requests through a real source-isolated headless realm and preserves failed patches", async () => {
    const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
    const call = (name: string, args: Record<string, unknown> = {}) =>
      manager.call({ name, args: { target: "headless", ...args } });
    try {
      expect(
        await call("app_start", {
          config: path.resolve(
            "test/fixtures/headless-procedural/aperture.headless.config.ts",
          ),
          seed: 0,
        }),
      ).toMatchObject({ ok: true });
      expect(await call("camera_create_agent")).toMatchObject({ ok: true });
      const updated = await call("camera_set_projection", {
        key: "camera.agent",
        projection: "orthographic",
        fovYDegrees: 50,
        near: 0.25,
        far: 40,
        orthographicHeight: 12,
      });
      expect(updated).toMatchObject({
        ok: true,
        result: {
          key: "camera.agent",
          camera: {
            projection: "orthographic",
            fovYRadians: Math.fround((50 * Math.PI) / 180),
            near: 0.25,
            far: 40,
            orthographicHeight: 12,
          },
        },
      });
      const readback = await call("camera_get", { key: "camera.agent" });
      expect(
        await call("camera_set_projection", {
          key: "camera.agent",
          fovYDegrees: 30,
          near: 4,
          far: 2,
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.camera.projection.invalidClipRange" }],
      });
      expect(await call("camera_get", { key: "camera.agent" })).toEqual(
        readback,
      );
      expect(await call("ecs_step", { frames: 1, delta: 0 })).toMatchObject({
        ok: true,
      });
      expect(await call("camera_get", { key: "camera.agent" })).toMatchObject({
        ok: true,
        result: {
          camera: {
            projection: "orthographic",
            fovYRadians: Math.fround((50 * Math.PI) / 180),
            near: 0.25,
            far: 40,
            orthographicHeight: 12,
          },
        },
      });
    } finally {
      await manager.dispose();
    }
  }, 30000);
});
