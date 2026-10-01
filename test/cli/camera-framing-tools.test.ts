import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { runApertureMcpServer } from "../../packages/cli/src/mcp.js";
import { describe, expect, it } from "vitest";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import {
  createApertureDevtoolsRequest,
  APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
} from "@aperture-engine/app/commands";
import { createGeneratedEntityToolBridge } from "@aperture-engine/app/headless-tools";
import { Camera, type RenderSnapshot } from "@aperture-engine/render";
import type { SimulationMessagePort } from "@aperture-engine/runtime";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import { createGeneratedDevtoolsBridge } from "../../packages/app/src/worker/devtools/bridge.js";
import { applyViewportResizeCommand } from "../../packages/app/src/worker/viewport.js";
import type { CameraFramingReport } from "../../packages/app/src/devtools/camera-framing.js";

function expectProjected(
  snapshot: RenderSnapshot,
  report: CameraFramingReport,
): void {
  const offset = snapshot.views[0]!.viewProjectionMatrixOffset;
  const m = snapshot.viewMatrices.subarray(offset, offset + 16);
  for (let bits = 0; bits < 8; bits += 1) {
    const p = [0, 1, 2].map((axis) =>
      (bits & (1 << axis)) === 0
        ? report.bounds.min[axis]!
        : report.bounds.max[axis]!,
    );
    const clip = [0, 1, 2, 3].map(
      (row) =>
        m[row]! * p[0]! +
        m[4 + row]! * p[1]! +
        m[8 + row]! * p[2]! +
        m[12 + row]!,
    );
    expect(clip[3]).toBeGreaterThan(0);
    expect(Math.abs(clip[0]! / clip[3]!)).toBeLessThanOrEqual(
      1 / report.padding + 0.00002,
    );
    expect(Math.abs(clip[1]! / clip[3]!)).toBeLessThanOrEqual(
      1 / report.padding + 0.00002,
    );
    expect(clip[2]! / clip[3]!).toBeGreaterThanOrEqual(0);
    expect(clip[2]! / clip[3]!).toBeLessThanOrEqual(1);
  }
}

async function importedScene() {
  return createHeadlessSessionController({
    config: defineApertureConfig({
      mode: "headless",
      assets: {
        model: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
      },
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [
      {
        default: class ImportedScene extends createSystem() {
          override init(): void {
            this.spawn.gltf(this.assets.gltf("model"), {
              key: "product",
              transform: {
                translation: [35, 2, -50],
                rotationEulerDegrees: [10, 40, 5],
                scale: [20, 4, -10],
              },
            });
          }
        },
      },
    ],
    seed: 0,
    assetMode: "strict",
    root: path.resolve("examples/developer-api"),
    publicDir: "public",
    allowHttpAssets: false,
    determinism: "off",
    renderWidth: 300,
    renderHeight: 900,
  });
}

describe("camera framing tool integration", () => {
  it("publishes a self-describing MCP schema for the new capability", () => {
    const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
    const definition = manager
      .toolDefinitions()
      .find((tool) => tool.name === "camera_frame_entities");
    expect(definition).toMatchObject({
      inputSchema: {
        required: ["subjects"],
        properties: {
          target: { enum: ["headed", "headless"] },
          key: { type: "string" },
          subjects: { type: "array", minItems: 1, maxItems: 256 },
          includeDescendants: { default: true },
          padding: { default: 1.1 },
        },
      },
    });
    expect(definition?.description).toContain("static world bounds");
    expect(definition?.description).toContain("orthographic");
  });

  it("imports, frames and re-reads a real GLB without stepping after camera creation", async () => {
    const session = await importedScene();
    try {
      expect(session.callTool({ name: "camera_create_agent" }).ok).toBe(true);
      const result = session.callTool({
        name: "camera_frame_entities",
        arguments: { subjects: [{ key: "product" }] },
      });
      expect(result.ok).toBe(true);
      const report = (result.result as { framing: CameraFramingReport })
        .framing;
      expect(report.meshes.length).toBeGreaterThan(0);
      expect(report.aspect).toBeCloseTo(1 / 3, 6);
      expect(report.center[0]).toBeGreaterThan(20);
      expect(
        session.callTool({
          name: "camera_get",
          arguments: { key: "camera.agent" },
        }),
      ).toMatchObject({
        ok: true,
        result: {
          camera: { aspect: expect.closeTo(1 / 3, 6) },
          localTransform: {
            translation: report.translation.map((value) =>
              expect.closeTo(value, 4),
            ),
          },
        },
      });
      expectProjected(session.extract().snapshot, report);
      expect(
        session.runner.app.lowLevel.assets.createManifestReport().placeholders
          .count,
      ).toBe(0);
    } finally {
      session.dispose();
    }
  });

  it("uses the identical framing operation through the generated worker bridge", async () => {
    const session = await importedScene();
    try {
      const app = session.runner.app;
      applyViewportResizeCommand(app, {
        channel: APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL,
        payload: {
          width: 300,
          height: 900,
          displayWidth: 300,
          displayHeight: 900,
          pixelRatio: 1,
          aspect: 1 / 3,
        },
      });
      const camera = app.context.spawn.camera({
        key: "camera.agent",
        camera: { aspect: 1, autoAspect: true },
      });
      const responses: unknown[] = [];
      const port = {
        postMessage(value: unknown) {
          responses.push(value);
        },
      } as SimulationMessagePort;
      const bridge = createGeneratedDevtoolsBridge({
        app,
        entityTools: createGeneratedEntityToolBridge(app.lowLevel.world),
        port,
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
          requestId: "frame-import",
          tool: "camera_frame_entities",
          payload: { subjects: [{ key: "product" }], padding: 1.25 },
        }),
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        requestId: "frame-import",
        ok: true,
        result: {
          key: "camera.agent",
          framing: { padding: 1.25, meshes: expect.any(Array) },
        },
      });
      const report = (
        responses[0] as { result: { framing: CameraFramingReport } }
      ).result.framing;
      expect(report.aspect).toBeCloseTo(1 / 3, 6);
      expectProjected(app.extract(), report);
      expect(camera.getValue(Camera, "near")).toBeCloseTo(report.near);
    } finally {
      session.dispose();
    }
  });
  it("discovers and runs framing through JSON-RPC MCP and writes a render-ready bundle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aperture-framing-mcp-"));
    try {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const chunks: string[] = [];
      stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
      const done = runApertureMcpServer({ cwd: process.cwd(), stdin, stdout });
      const calls = [
        {
          name: "app_start",
          arguments: {
            target: "headless",
            config: path.resolve(
              "test/fixtures/headless-procedural/aperture.headless.config.ts",
            ),
            seed: 42,
          },
        },
        { name: "camera_create_agent", arguments: { target: "headless" } },
        {
          name: "camera_frame_entities",
          arguments: { target: "headless", subjects: [{ key: "cube" }] },
        },
        {
          name: "camera_get",
          arguments: { target: "headless", key: "camera.agent" },
        },
        {
          name: "render_bundle",
          arguments: {
            target: "headless",
            out: path.join(root, "frame.bundle.json"),
          },
        },
        { name: "app_stop", arguments: { target: "headless" } },
      ];
      const requests = [
        { jsonrpc: "2.0", id: 1, method: "initialize" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        ...calls.map((params, index) => ({
          jsonrpc: "2.0",
          id: index + 3,
          method: "tools/call",
          params,
        })),
      ];
      stdin.end(
        requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
      );
      await done;
      const responses = chunks
        .join("")
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              id: number;
              error?: unknown;
              result: {
                instructions?: string;
                tools?: readonly { name: string }[];
                structuredContent?: unknown;
              };
            },
        );
      expect(responses).toHaveLength(requests.length);
      expect(responses.every((response) => response.error === undefined)).toBe(
        true,
      );
      expect(responses[0]!.result.instructions).toContain(
        "camera_frame_entities",
      );
      expect(
        responses[1]!.result.tools?.some(
          (tool) => tool.name === "camera_frame_entities",
        ),
      ).toBe(true);
      for (const response of responses.slice(2))
        expect(response.result.structuredContent).toMatchObject({ ok: true });
      const framed = responses[4]!.result.structuredContent as {
        result: { framing: CameraFramingReport };
      };
      expect(responses[5]!.result.structuredContent).toMatchObject({
        result: {
          worldTransform: { col3: [...framed.result.framing.translation, 1] },
        },
      });
      const bundle = JSON.parse(
        await readFile(path.join(root, "frame.bundle.json"), "utf8"),
      ) as {
        format: string;
        snapshot: { value: { meshDraws: readonly unknown[] } };
      };
      expect(bundle.format).toBe("aperture.render-bundle");
      expect(bundle.snapshot.value.meshDraws.length).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
