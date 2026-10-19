import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  createSystem,
  material,
  mesh,
  type CameraLocalInspectionReport,
} from "@aperture-engine/app/systems";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { createGeneratedEntityToolBridge } from "@aperture-engine/app/headless-tools";
import { LocalTransform } from "@aperture-engine/simulation";
import type { SimulationMessagePort } from "@aperture-engine/runtime";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import { createGeneratedDevtoolsBridge } from "../../packages/app/src/worker/devtools/bridge.js";
import { callBrowserBackedTool } from "../../packages/cli/src/tools/dispatch.js";
import type { AperturePage } from "../../packages/cli/src/tools/browser.js";
import type { ApertureDevSession } from "../../packages/cli/src/session.js";
import { runToolCommand } from "../../packages/cli/src/commands/tool.js";
import { callApertureTool } from "../../packages/cli/src/devtools-client.js";

vi.mock("../../packages/cli/src/devtools-client.js", () => ({
  callApertureTool: vi.fn(async () => ({ ok: true, result: {} })),
}));

const payload = {
  camera: { key: "camera.main" },
  viewport: { width: 800, height: 400 },
  subjects: [
    {
      name: "assembly",
      entity: { key: "assembly" },
      points: [{ name: "tip", local: [1, 2, 0] }],
      faces: [
        {
          name: "front",
          localTriangle: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
      ],
      bounds: { source: "mesh-local-aabb", includeDescendants: true },
    },
  ],
  cameraJob: { referenceDistance: 10 },
};

describe("camera local inspection transport", () => {
  it("accepts the documented JSON file content as inline --json, without interpreting a filename", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-camera-local-command-"),
    );
    try {
      const file = path.join(root, "inspect-local.json");
      await writeFile(file, JSON.stringify(payload));
      const contents = await readFile(file, "utf8");
      expect(
        await runToolCommand({
          cwd: root,
          argv: ["camera_inspect_local", "--json", contents],
          stdout() {},
        }),
      ).toBe(0);
      expect(callApertureTool).toHaveBeenCalledWith({
        cwd: root,
        name: "camera_inspect_local",
        arguments: payload,
      });
      await expect(
        runToolCommand({
          cwd: root,
          argv: ["camera_inspect_local", "--json", "inspect-local.json"],
          stdout() {},
        }),
      ).rejects.toThrow("Tool arguments must be valid JSON");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("advertises explicit camera, viewport, local points, faces, bounds and optional export gauge", () => {
    const definition = new ApertureMcpSessionManager({ cwd: process.cwd() })
      .toolDefinitions()
      .find((tool) => tool.name === "camera_inspect_local");
    expect(definition).toMatchObject({
      inputSchema: {
        required: ["camera", "viewport", "subjects"],
        properties: {
          target: { enum: ["headed", "headless"] },
          cameraJob: { required: ["referenceDistance"] },
          subjects: {
            items: {
              properties: {
                points: { type: "array" },
                faces: { type: "array" },
                bounds: { required: ["source", "includeDescendants"] },
              },
            },
          },
        },
      },
    });
    expect(definition!.description).toContain("no simulation step");
  });

  it("dispatches a headed request unchanged through the existing runtime bridge", async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValue({ ok: true, result: { source: "resolved-ecs" } });
    const result = await callBrowserBackedTool(
      { evaluate } as unknown as AperturePage,
      {} as ApertureDevSession,
      "camera_inspect_local",
      payload,
    );
    expect(evaluate.mock.calls[0]![1]).toMatchObject({
      runtimeTool: "camera_inspect_local",
      runtimePayload: payload,
    });
    expect(result).toEqual({
      ok: true,
      result: { source: "resolved-ecs" },
      diagnostics: [],
    });
  });

  it("shares serializable resolved results across headless, facade and worker routes without stepping", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-camera-local-"),
    );
    const session = await createHeadlessSessionController({
      root,
      publicDir: "public",
      seed: 0,
      assetMode: "strict",
      allowHttpAssets: false,
      determinism: "off",
      renderWidth: 800,
      renderHeight: 400,
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
      }),
      systems: [
        {
          default: class Scene extends createSystem() {
            override init(): void {
              this.spawn.camera({
                key: "camera.main",
                transform: { translation: [0, 0, 10], lookAt: [0, 0, 0] },
                camera: { aspect: 2, autoAspect: false },
              });
              const assembly = this.spawn.group({ key: "assembly" });
              this.spawn.mesh({
                mesh: mesh.box(),
                material: material.standard(),
                transform: { parent: assembly },
              });
            }
          },
        },
      ],
    });
    try {
      const app = session.runner.app;
      const step = vi.spyOn(app, "step");
      const headless = session.callTool({
        name: "camera_inspect_local",
        arguments: payload,
      });
      expect(headless.ok).toBe(true);
      const facade = app.context.cameras.main.inspectLocal({
        viewport: payload.viewport,
        subjects: [
          {
            name: "assembly",
            entity: { key: "assembly" },
            points: [{ name: "tip", local: [1, 2, 0] }],
            faces: [
              {
                name: "front",
                localTriangle: [
                  [0, 0, 0],
                  [1, 0, 0],
                  [0, 1, 0],
                ],
              },
            ],
            bounds: { source: "mesh-local-aabb", includeDescendants: true },
          },
        ],
        cameraJob: { referenceDistance: 10 },
      });
      expect(facade).toEqual(headless);
      const responses: unknown[] = [];
      const workerStep = vi.fn(() => ({}));
      const setPaused = vi.fn();
      const bridge = createGeneratedDevtoolsBridge({
        app,
        entityTools: createGeneratedEntityToolBridge(app.lowLevel.world),
        port: {
          postMessage: (value: unknown) =>
            responses.push(structuredClone(value)),
        } as unknown as SimulationMessagePort,
        enqueueInputEvent() {},
        setPaused,
        step: workerStep,
        getSimulationState: () => ({}),
      });
      bridge.handle(
        createApertureDevtoolsRequest({
          requestId: "local-inspection",
          tool: "camera_inspect_local",
          payload,
        }),
      );
      expect(responses[0]).toMatchObject({ ok: true, result: headless.result });
      expect(JSON.stringify(structuredClone(headless.result))).toEqual(
        JSON.stringify(headless.result),
      );
      const report = headless.result as CameraLocalInspectionReport;
      const ref = report.subjects[0]!.entity;
      app.lowLevel.world.entityManager
        .getEntityByIndex(ref.index)!
        .getVectorView(LocalTransform, "translation")[0] = 3;
      const next = session.callTool({
        name: "camera_inspect_local",
        arguments: payload,
      });
      expect(
        (next.result as CameraLocalInspectionReport).subjects[0]!.points[0]!
          .world,
      ).toEqual([4, 2, 0]);
      expect(step).not.toHaveBeenCalled();
      expect(workerStep).not.toHaveBeenCalled();
      expect(setPaused).not.toHaveBeenCalled();
      expect(
        session.callTool({
          name: "camera_inspect_local",
          arguments: { ...payload, camera: undefined },
        }).ok,
      ).toBe(false);
    } finally {
      session.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
});
