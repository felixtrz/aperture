import {
  spawn,
  execFile,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);
const CLI = path.resolve("packages/cli/dist/bin/aperture.js");
const CITY_ROOT = path.resolve("showcase/city-builder");
const CITY_HEADLESS_CONFIG = path.join(
  CITY_ROOT,
  "aperture.headless.config.ts",
);
const CITY_PORT = 5221;
const MCP_TIMEOUT_MS = 90_000;
const CAPTURE_SAMPLES = [
  { id: "center", x: 0.5, y: 0.5, coordinateSpace: "normalized" },
  { id: "upper-left", x: 0.25, y: 0.25, coordinateSpace: "normalized" },
  { id: "upper-right", x: 0.75, y: 0.25, coordinateSpace: "normalized" },
  { id: "lower-left", x: 0.25, y: 0.75, coordinateSpace: "normalized" },
  { id: "lower-right", x: 0.75, y: 0.75, coordinateSpace: "normalized" },
] as const;
const CLI_ENV =
  process.env.CI === "true"
    ? { ...process.env, APERTURE_GPU: "software" }
    : process.env;

test.describe("City Builder shared MCP backend parity", () => {
  test("shared tools expose equivalent headed and headless results", async () => {
    test.setTimeout(240_000);
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-city-mcp-"));
    const mcp = new McpClient(CITY_ROOT);

    await runCli(["dev", "down"], { allowFailure: true });

    try {
      expect(
        await mcp.call("app_start", {
          target: "headed",
          appRoot: CITY_ROOT,
          port: CITY_PORT,
          headless: true,
        }),
      ).toMatchObject({ ok: true, target: "headed" });

      expect(
        await mcp.call("app_status", {
          target: "headed",
          waitUntilReady: true,
          timeoutMs: 45_000,
        }),
      ).toMatchObject({ ok: true, target: "headed" });

      expect(
        await mcp.call("app_start", {
          target: "headless",
          config: CITY_HEADLESS_CONFIG,
          root: CITY_ROOT,
          assetMode: "hybrid",
          seed: 17,
        }),
      ).toMatchObject({
        ok: true,
        target: "headless",
        status: { seed: 17 },
      });

      const headedStatus = await mcp.call("app_status", {
        target: "headed",
      });
      const headlessStatus = await mcp.call("app_status", {
        target: "headless",
      });
      expect(headedStatus).toMatchObject({ ok: true, running: true });
      expect(headlessStatus).toMatchObject({ ok: true, running: true });

      const headedSystems = await mcp.call("ecs_list_systems", {
        target: "headed",
      });
      const headlessSystems = await mcp.call("ecs_list_systems", {
        target: "headless",
      });
      expect(headedSystems).toMatchObject({
        ok: true,
        target: "headed",
        systems: expect.any(Array),
      });
      expect(headlessSystems).toMatchObject({
        ok: true,
        target: "headless",
        systems: expect.any(Array),
      });
      expect(systemClassNames(headedSystems)).toEqual(
        expect.arrayContaining([...systemClassNames(headlessSystems)]),
      );
      expect(systemClassNames(headlessSystems)).toEqual(
        expect.arrayContaining([
          "SetupSystem",
          "CameraSystem",
          "BuilderSystem",
          "AudioSystem",
        ]),
      );

      expect(
        await mcp.call("ecs_step", { target: "headed", frames: 1 }),
      ).toMatchObject({ ok: true, target: "headed" });
      expect(
        await mcp.call("ecs_step", {
          target: "headless",
          frames: 1,
          digest: true,
        }),
      ).toMatchObject({
        ok: true,
        target: "headless",
        result: { nextFrame: 1 },
      });

      const headedGround = await waitForEntityTotal(mcp, "headed", "ground", 1);
      const headlessGround = await waitForEntityTotal(
        mcp,
        "headless",
        "ground",
        1,
      );
      expect(entityTotal(headedGround)).toBe(1);
      expect(entityTotal(headlessGround)).toBe(1);

      const headedCamera = await mcp.call("camera_get", {
        target: "headed",
        key: "camera.main",
      });
      const headlessCamera = await mcp.call("camera_get", {
        target: "headless",
        key: "camera.main",
      });
      expect(cameraKey(headedCamera)).toBe("camera.main");
      expect(cameraKey(headlessCamera)).toBe("camera.main");
      expectVectorClose(
        cameraTranslation(headedCamera),
        cameraTranslation(headlessCamera),
        3,
      );

      const headedAssets = await mcp.call("asset_list", {
        target: "headed",
      });
      const headlessAssets = await mcp.call("asset_list", {
        target: "headless",
      });
      expect(assetIds(headedAssets)).toEqual(assetIds(headlessAssets));
      expect(assetIds(headlessAssets)).toEqual(
        expect.arrayContaining([
          "grass",
          "road-straight",
          "building-small-a",
          "placement-a",
          "ambience",
        ]),
      );

      for (const target of ["headed", "headless"] as const) {
        expect(
          await mcp.call("input_inject", {
            target,
            actions: { zoomIn: true, pan: { x: 1, y: 0 } },
          }),
        ).toMatchObject({ ok: true });
        expect(
          await mcp.call("ecs_step", {
            target,
            frames: 1,
          }),
        ).toMatchObject({ ok: true });
      }

      const headedInput = await mcp.call("input_get_state", {
        target: "headed",
      });
      const headlessInput = await mcp.call("input_get_state", {
        target: "headless",
      });
      expect(inputActionNames(headedInput)).toEqual(
        inputActionNames(headlessInput),
      );
      expect(inputActionNames(headlessInput)).toEqual(
        expect.arrayContaining(["pan", "zoomIn", "zoomOut", "center"]),
      );

      const headedPng = path.join(tempDir, "headed.png");
      const headlessPng = path.join(tempDir, "headless.png");
      const headedFrame = await mcp.call("frame_capture", {
        target: "headed",
        out: headedPng,
        waitUntilReady: true,
        samples: CAPTURE_SAMPLES,
      });
      const headlessFrame = await mcp.call("frame_capture", {
        target: "headless",
        out: headlessPng,
        width: 960,
        height: 640,
        samples: CAPTURE_SAMPLES,
      });

      expectFrameCapture(headedFrame, "headed");
      expectFrameCapture(headlessFrame, "headless");
      expectVisibleSamples(headedFrame, "headed");
      expectVisibleSamples(headlessFrame, "headless");
      expect(await stat(headedPng)).toMatchObject({ size: expect.any(Number) });
      expect(await stat(headlessPng)).toMatchObject({
        size: expect.any(Number),
      });
      expect(frameViewportAspect(headedFrame)).toBeCloseTo(
        frameViewportAspect(headlessFrame),
        1,
      );
    } finally {
      await mcp.call("app_stop", { target: "headless" }).catch(() => {
        // The MCP process may already have exited after a failed assertion.
      });
      await mcp.call("app_stop", { target: "headed" }).catch(() => {
        // The MCP process may already have exited after a failed assertion.
      });
      await mcp.close();
      await runCli(["dev", "down"], { allowFailure: true });
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

class McpClient {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #pending = new Map<
    number,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
      readonly timeout: NodeJS.Timeout;
    }
  >();
  #nextId = 1;
  #stdout = "";
  #stderr = "";
  #buffer = "";

  constructor(cwd: string) {
    this.#child = spawn(process.execPath, [CLI, "mcp", "stdio"], {
      cwd,
      env: CLI_ENV,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child.stdout.on("data", (chunk: Buffer) => {
      this.#stdout += chunk.toString();
      this.#buffer += chunk.toString();
      this.#drain();
    });
    this.#child.stderr.on("data", (chunk: Buffer) => {
      this.#stderr += chunk.toString();
    });
    this.#child.once("exit", () => {
      for (const [id, pending] of this.#pending) {
        clearTimeout(pending.timeout);
        pending.reject(
          new Error(
            `MCP process exited before response ${id}.\nstdout:\n${this.#stdout}\nstderr:\n${this.#stderr}`,
          ),
        );
      }
      this.#pending.clear();
    });
  }

  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const id = this.#nextId;
    this.#nextId += 1;

    const response = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new Error(
            `MCP call ${name} timed out after ${MCP_TIMEOUT_MS}ms.\nstdout:\n${this.#stdout}\nstderr:\n${this.#stderr}`,
          ),
        );
      }, MCP_TIMEOUT_MS);
      this.#pending.set(id, { resolve, reject, timeout });
      this.#child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        })}\n`,
      );
    });

    const record = asRecord(response);
    if (record === null) {
      throw new Error(`Malformed MCP response: ${JSON.stringify(response)}`);
    }

    const error = asRecord(record["error"]);
    if (error !== null) {
      throw new Error(JSON.stringify(error));
    }

    return asRecord(asRecord(record["result"])?.["structuredContent"]);
  }

  async close(): Promise<void> {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
    }
    this.#pending.clear();
    this.#child.stdin.end();
    if (this.#child.exitCode !== null || this.#child.killed) {
      return;
    }
    this.#child.kill("SIGTERM");
  }

  #drain(): void {
    for (;;) {
      const newline = this.#buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }

      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length === 0) {
        continue;
      }

      const message = JSON.parse(line) as { readonly id?: number };
      const id = message.id;
      if (typeof id !== "number") {
        continue;
      }

      const pending = this.#pending.get(id);
      if (pending === undefined) {
        continue;
      }

      this.#pending.delete(id);
      clearTimeout(pending.timeout);
      pending.resolve(message);
    }
  }
}

async function waitForEntityTotal(
  client: McpClient,
  target: "headed" | "headless",
  key: string,
  expected: number,
): Promise<unknown> {
  const deadline = Date.now() + 30_000;
  let latest: unknown = null;

  while (Date.now() < deadline) {
    latest = await client.call("ecs_find_entities", { target, key });
    if (entityTotal(latest) === expected) {
      return latest;
    }
    await delay(250);
  }

  throw new Error(
    `Timed out waiting for ${target} entity '${key}' total ${expected}. Last result: ${JSON.stringify(latest)}`,
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function expectFrameCapture(
  value: unknown,
  target: "headed" | "headless",
): void {
  expect(value).toMatchObject({
    ok: true,
    target,
    mimeType: "image/png",
    byteLength: expect.any(Number),
    canvas: {
      width: expect.any(Number),
      height: expect.any(Number),
      aspect: expect.any(Number),
    },
    viewport: {
      width: expect.any(Number),
      height: expect.any(Number),
      aspect: expect.any(Number),
    },
    renderTarget: {
      width: expect.any(Number),
      height: expect.any(Number),
    },
  });
  expect(numberPath(value, ["byteLength"])).toBeGreaterThan(1000);
  expect(asRecord(asRecord(value)?.["samples"])?.["ok"]).toBe(true);
  expect(samplePixels(value)).toHaveLength(CAPTURE_SAMPLES.length);
}

function expectVisibleSamples(
  value: unknown,
  target: "headed" | "headless",
): void {
  const visible = samplePixels(value).filter((pixel) => {
    const alpha = numericChannel(pixel, "a");
    const luma =
      0.2126 * numericChannel(pixel, "r") +
      0.7152 * numericChannel(pixel, "g") +
      0.0722 * numericChannel(pixel, "b");
    return alpha > 0 && luma > 4;
  });

  expect(
    visible.length,
    `${target} frame_capture samples should contain visible nonblank pixels`,
  ).toBeGreaterThan(0);
}

function frameViewportAspect(value: unknown): number {
  return numberPath(value, ["viewport", "aspect"]);
}

function samplePixels(value: unknown): readonly Record<string, unknown>[] {
  const samples = asRecord(asRecord(value)?.["samples"])?.["samples"];
  if (!Array.isArray(samples)) {
    return [];
  }
  return samples
    .map((sample) => asRecord(asRecord(sample)?.["pixel"]))
    .filter((pixel): pixel is Record<string, unknown> => pixel !== null);
}

function numericChannel(
  pixel: Record<string, unknown>,
  channel: "r" | "g" | "b" | "a",
): number {
  const value = pixel[channel];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function assetIds(value: unknown): readonly string[] {
  const assets = asRecord(asRecord(value)?.["result"])?.["assets"];
  return Array.isArray(assets)
    ? assets
        .map((asset) => asRecord(asset)?.["id"])
        .filter((id): id is string => typeof id === "string")
        .sort()
    : [];
}

function inputActionNames(value: unknown): readonly string[] {
  const actions = asRecord(asRecord(value)?.["result"])?.["actions"];
  return actions !== undefined &&
    typeof actions === "object" &&
    actions !== null
    ? Object.keys(actions).sort()
    : [];
}

function systemClassNames(value: unknown): readonly string[] {
  const systems = asRecord(value)?.["systems"];
  if (!Array.isArray(systems)) {
    throw new Error(
      `Expected top-level systems array in ${JSON.stringify(value)}`,
    );
  }

  return systems
    .map((system) => {
      const record = asRecord(system);
      const className = record?.["className"];
      const moduleId = record?.["moduleId"];
      return typeof className === "string"
        ? className
        : typeof moduleId === "string"
          ? systemClassNameFromModuleId(moduleId)
          : null;
    })
    .filter((name): name is string => typeof name === "string")
    .sort();
}

function systemClassNameFromModuleId(moduleId: string): string {
  const stem = path
    .basename(moduleId)
    .replace(/\.system\.[cm]?[jt]s$/u, "")
    .replace(/\.[cm]?[jt]s$/u, "");
  const pascal = stem
    .split(/[^a-zA-Z0-9]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return pascal.endsWith("System") ? pascal : `${pascal}System`;
}

function entityTotal(value: unknown): number {
  return numberPath(value, ["result", "total"]);
}

function cameraKey(value: unknown): unknown {
  return asRecord(asRecord(value)?.["result"])?.["key"];
}

function cameraTranslation(value: unknown): readonly number[] {
  const translation = asRecord(
    asRecord(asRecord(value)?.["result"])?.["localTransform"],
  )?.["translation"];
  return Array.isArray(translation) && translation.every(isFiniteNumber)
    ? translation
    : [];
}

function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
  precision: number,
): void {
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index] ?? 0, precision);
  }
}

function numberPath(value: unknown, pathSegments: readonly string[]): number {
  let current = value;
  for (const segment of pathSegments) {
    current = asRecord(current)?.[segment];
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    throw new Error(
      `Expected numeric path ${pathSegments.join(".")} in ${JSON.stringify(value)}`,
    );
  }
  return current;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function runCli(
  args: readonly string[],
  options: { readonly allowFailure?: boolean } = {},
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  try {
    return await execFileAsync(process.execPath, [CLI, ...args], {
      cwd: CITY_ROOT,
      env: CLI_ENV,
      timeout: 90_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error: unknown) {
    if (options.allowFailure === true) {
      const output = error as {
        readonly stdout?: string;
        readonly stderr?: string;
      };
      return {
        stdout: output.stdout ?? "",
        stderr: output.stderr ?? "",
      };
    }
    throw error;
  }
}
