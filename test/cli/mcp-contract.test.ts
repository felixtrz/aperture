vi.mock(
  "../../packages/cli/src/headless/realm-client.js",
  async () => import("../helpers/headless-realm-built.js"),
);
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runApertureMcpServer } from "../../packages/cli/src/mcp.js";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { MAX_TOOL_STEP_FRAMES } from "../../packages/cli/src/tools/control-arguments.js";

vi.setConfig({ testTimeout: 60_000 });
const managers: ApertureMcpSessionManager[] = [];
afterEach(async () => {
  for (const manager of managers.splice(0)) await manager.dispose();
});
function manager(): ApertureMcpSessionManager {
  const result = new ApertureMcpSessionManager({ cwd: process.cwd() });
  managers.push(result);
  return result;
}

describe("agent-facing MCP contracts", () => {
  it("advertises usable camera and input arguments with target capabilities", async () => {
    const session = manager();
    const tools = new Map(
      session.toolDefinitions().map((tool) => [tool.name, tool]),
    );
    expect(tools.get("camera_look_at")?.inputSchema.properties).toMatchObject({
      target: { enum: ["headed", "headless"] },
      lookAt: { type: "array", minItems: 3, maxItems: 3 },
      key: { type: "string" },
    });
    expect(tools.get("input_inject")?.inputSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        pointer: { type: "object" },
        actions: { type: "object" },
        gamepad: { type: "object" },
      },
    });
    expect(tools.get("input_action_set")?.inputSchema.required).toEqual([
      "action",
    ]);
    expect(
      tools.get("camera_create_agent")?.inputSchema.properties,
    ).toMatchObject({
      translation: { type: "array", minItems: 3, maxItems: 3 },
      lookAt: { type: "array", minItems: 3, maxItems: 3 },
    });
    const capabilities = (await session.call({
      name: "app_capabilities",
      args: { target: "headless" },
    })) as { tools: { name: string }[] };
    expect(capabilities).toMatchObject({
      headless: {
        sourceReload: "fresh-native-worker-realm",
        reset: "reload-source-and-rebuild-state",
      },
    });
    expect(capabilities.tools.map((tool) => tool.name)).toContain(
      "render_bundle",
    );
    expect(capabilities.tools.map((tool) => tool.name)).not.toContain(
      "render_get_frame_report",
    );
    expect(
      await session.call({ name: "app_status", args: { target: "headless" } }),
    ).toMatchObject({ running: false });
  });

  it("rejects misspelled targets before routing to a session", async () => {
    expect(
      await manager().call({ name: "ecs_step", args: { target: "headles" } }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "aperture.mcp.invalidTarget" }],
    });
  });

  it("routes a non-origin camera aim point independently of target", async () => {
    const session = manager();
    const config = fileURLToPath(
      new URL(
        "../fixtures/headless-procedural/aperture.headless.config.ts",
        import.meta.url,
      ),
    );
    expect(
      await session.call({
        name: "app_start",
        args: { target: "headless", config },
      }),
    ).toMatchObject({ ok: true });
    expect(
      await session.call({
        name: "camera_create_agent",
        args: { target: "headless" },
      }),
    ).toMatchObject({ ok: true });
    const orbit = await session.call({
      name: "camera_orbit",
      args: {
        target: "headless",
        key: "camera.agent",
        lookAt: [4, 2, -3],
        radius: 10,
        yawDegrees: 0,
        pitchDegrees: 0,
      },
    });
    expect(orbit).toMatchObject({
      ok: true,
      result: {
        localTransform: { translation: [4, 2, 7] },
      },
    });
    const rotation = (
      orbit as { result: { localTransform: { rotation: number[] } } }
    ).result.localTransform.rotation;
    for (const [index, value] of rotation.entries())
      expect(value).toBeCloseTo(index === 3 ? 1 : 0);
    const before = await session.call({
      name: "app_status",
      args: { target: "headless" },
    });
    for (const frames of [0, -1, 1.5, Infinity, MAX_TOOL_STEP_FRAMES + 1]) {
      expect(
        await session.call({
          name: "ecs_step",
          args: { target: "headless", frames },
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.headless.invalidStep" }],
      });
    }
    expect(
      await session.call({ name: "app_status", args: { target: "headless" } }),
    ).toEqual(before);
    for (const args of [
      {},
      { action: "jump" },
      { actions: [] },
      { pointer: { position: [0.5] } },
      { pointer: { pressed: "true" } },
      { actions: { jump: { press: true } } },
    ]) {
      expect(
        await session.call({
          name: "input_inject",
          args: { target: "headless", ...args },
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "aperture.input.invalidInjection" }],
      });
    }
  });

  it("survives malformed requests, negotiates versions, and marks tool failures", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let output = "";
    stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const done = runApertureMcpServer({
      cwd: process.cwd(),
      stdin,
      stdout,
      stderr,
    });
    stdin.end(
      [
        "{broken",
        "null",
        "[]",
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion: "2025-03-26" },
        }),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "app_status", arguments: [] },
        }),
        JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "app_start", arguments: { target: "headless" } },
        }),
        JSON.stringify({ jsonrpc: "2.0", id: 4, method: "nope" }),
        JSON.stringify({ jsonrpc: "2.0", id: null, method: "ping" }),
      ].join("\n") + "\n",
    );
    await done;
    const messages = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(messages.slice(0, 3).map((message) => message.error.code)).toEqual([
      -32700, -32600, -32600,
    ]);
    expect(
      messages.find((message) => message.id === 0).result.protocolVersion,
    ).toBe("2025-03-26");
    expect(messages.find((message) => message.id === 1).result).toEqual({});
    expect(messages.find((message) => message.id === 2).error.code).toBe(
      -32602,
    );
    expect(messages.find((message) => message.id === 3).result).toMatchObject({
      isError: true,
      structuredContent: { ok: false },
    });
    expect(messages.find((message) => message.id === 4).error.code).toBe(
      -32601,
    );
    expect(messages.at(-1)).toMatchObject({ id: null, result: {} });
    expect(messages).toHaveLength(9);
  });
});
