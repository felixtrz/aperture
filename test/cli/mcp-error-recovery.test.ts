vi.mock(
  "../../packages/cli/src/headless/realm-client.js",
  async () => import("../helpers/headless-realm-built.js"),
);
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApertureGeneratedDiagnostic } from "@aperture-engine/app/diagnostics";
import { runApertureMcpServer } from "../../packages/cli/src/mcp.js";

vi.setConfig({ testTimeout: 60_000 });
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<string> {
  const temporary = path.join(process.cwd(), "tmp");
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(path.join(temporary, "mcp-error-recovery-"));
  directories.push(root);
  await mkdir(path.join(root, "src/systems"), { recursive: true });
  await writeFile(
    path.join(root, "aperture.headless.config.ts"),
    [
      'import { defineApertureConfig } from "@aperture-engine/app/config";',
      'export default defineApertureConfig({ mode: "headless", systems: ["src/systems/*.system.ts"], render: { defaultEnvironment: false, defaultCamera: false, defaultLight: false } });',
    ].join("\n"),
  );
  await writeFile(
    path.join(root, "src/systems/broken.system.ts"),
    [
      'import { createSystem, defineResource, resource } from "@aperture-engine/app/systems";',
      'const State = defineResource("test.mcp.diagnosticRecovery", { height: resource.number(1) });',
      "function originalSceneFailure() { return (undefined as unknown as { position: number[] }).position; }",
      "export default class BrokenMcpSceneSystem extends createSystem() {",
      "  init() { this.resources.read(State); }",
      "  update() { originalSceneFailure(); }",
      "}",
    ].join("\n"),
  );
  return root;
}

interface ToolEnvelope {
  readonly id: number;
  readonly result?: {
    readonly isError?: boolean;
    readonly structuredContent: {
      readonly ok: boolean;
      readonly diagnostics: ApertureGeneratedDiagnostic[];
    };
    readonly content: { readonly type: string; readonly text: string }[];
  };
  readonly error?: unknown;
}

describe("MCP error recovery attribution", () => {
  it("retains real lifecycle and resource failures in normal MCP tool envelopes", async () => {
    const root = await fixture();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let output = "";
    stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const done = runApertureMcpServer({ cwd: root, stdin, stdout, stderr });
    const tool = (id: number, name: string, args: Record<string, unknown>) => ({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: { target: "headless", ...args } },
    });
    stdin.end(
      [
        {
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        },
        tool(1, "app_start", { config: "aperture.headless.config.ts" }),
        tool(2, "resource_set", {
          id: "test.mcp.diagnosticRecovery",
          values: { height: "invalid" },
        }),
        tool(3, "ecs_step", { frames: 1, delta: 1 / 60 }),
      ]
        .map((request) => JSON.stringify(request))
        .join("\n") + "\n",
    );
    await done;
    const responses = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as ToolEnvelope);
    expect(
      responses.find((response) => response.id === 1)?.result?.structuredContent
        .ok,
    ).toBe(true);
    for (const id of [2, 3]) {
      const response = responses.find((message) => message.id === id)!;
      expect(response.error).toBeUndefined();
      expect(response.result?.isError).toBe(true);
      expect(response.result?.structuredContent.ok).toBe(false);
      const content = response.result?.content.find(
        (entry) => entry.type === "text",
      );
      expect(JSON.parse(content!.text)).toEqual(
        response.result?.structuredContent,
      );
    }
    const resource = responses.find((message) => message.id === 2)!.result!
      .structuredContent.diagnostics[0]!;
    expect(resource).toMatchObject({
      code: "aperture.resource.invalidFieldValue",
      data: {
        id: "test.mcp.diagnosticRecovery",
        field: "height",
        kind: "number",
        value: "invalid",
      },
      error: {
        name: "ApertureSystemError",
        stack: expect.stringContaining("invalidResourceFieldValueError"),
      },
    });
    expect(resource.suggestedFix).toContain("field kind");
    const lifecycle = responses.find((message) => message.id === 3)!.result!
      .structuredContent.diagnostics[0]!;
    expect(lifecycle).toMatchObject({
      code: "aperture.system.lifecycleFailed",
      data: { system: "BrokenMcpSceneSystem", phase: "update" },
      error: {
        cause: {
          name: "TypeError",
          stack: expect.stringContaining("originalSceneFailure"),
        },
      },
    });
    expect(lifecycle.error?.cause?.stack).toContain("broken.system.ts:");
    expect(lifecycle.suggestedFix).toContain("diagnostic.error.cause.stack");
  });
});
