vi.mock(
  "../../packages/cli/src/headless/realm-client.js",
  async () => import("../helpers/headless-realm-built.js"),
);
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runApertureMcpServer } from "../../packages/cli/src/mcp.js";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";
import { waitFor } from "../helpers/wait.js";
import { createApertureRenderSession } from "../../packages/cli/src/render/driver.js";
import * as headless from "../../packages/cli/src/headless/realm-client.js";

const renderAdapter = vi.hoisted(() => ({
  dispose: vi.fn(async () => {}),
  render: vi.fn(async () => ({
    png: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
      "base64",
    ),
    frame: 0,
    metadata: { webgpu: null, lightingHealth: null },
  })),
}));

// Resource lifecycle tests never need a browser. Keep this adapter local to
// this file; pixel/lighting integration tests retain their real renderer.
vi.mock("../../packages/cli/src/render/driver.js", () => ({
  createApertureRenderSession: vi.fn(async () => renderAdapter),
}));

const tempRoots: string[] = [];
const disposers: ReturnType<typeof vi.fn<() => Promise<void>>>[] = [];

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  const createController = headless.prepareHeadlessSessionClient;
  vi.spyOn(headless, "prepareHeadlessSessionClient").mockImplementation(
    async (options) => {
      const controller = await createController(options);
      const originalDispose = controller.dispose.bind(controller);
      const dispose = vi.fn(originalDispose);
      Object.defineProperty(controller, "dispose", {
        value: dispose,
        configurable: true,
      });
      disposers.push(dispose);
      return controller;
    },
  );
});

afterEach(async () => {
  for (const dispose of disposers.splice(0)) {
    if (dispose.mock.calls.length === 0) await dispose();
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(createApertureRenderSession).mockReset();
  renderAdapter.dispose.mockReset();
  renderAdapter.render.mockReset();
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("MCP transport resource lifecycle", () => {
  it("disposes its warm renderer even if controller cleanup reports a failure", async () => {
    const root = await fixtureRoot();
    const manager = new ApertureMcpSessionManager({ cwd: root });
    try {
      expect(
        await manager.call({
          name: "app_start",
          args: { target: "headless", config: "aperture.headless.config.ts" },
        }),
      ).toMatchObject({ ok: true });
      expect(
        await manager.call({
          name: "frame_capture",
          args: { target: "headless" },
        }),
      ).toMatchObject({ ok: true });
      const dispose = disposers[0]!;
      const original = dispose.getMockImplementation()!;
      dispose.mockImplementationOnce(async () => {
        await original();
        throw new Error("cleanup probe");
      });
      expect(
        await manager.call({ name: "app_stop", args: { target: "headless" } }),
      ).toMatchObject({ ok: false });
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    } finally {
      await manager.dispose();
    }
  });

  it.each(["end", "close"] as const)(
    "disposes its headless controller and warm renderer on stdin %s",
    async (event) => {
      const root = await fixtureRoot();
      const stdin = new PassThrough();
      const output: string[] = [];
      const done = runApertureMcpServer({
        cwd: root,
        stdin,
        stdout: { write: (chunk) => output.push(chunk) },
      });
      stdin.write(
        request(1, "app_start", {
          target: "headless",
          config: "aperture.headless.config.ts",
        }),
      );
      stdin.write(
        request(2, "frame_capture", {
          target: "headless",
        }),
      );
      if (event === "end") stdin.end();
      else stdin.destroy();
      await done;

      expect(
        output.map((line) => JSON.parse(line).result.structuredContent.ok),
      ).toEqual([true, true]);
      const capture = JSON.parse(output[1]!).result;
      expect(capture.content).toEqual([
        { type: "text", text: expect.any(String) },
        { type: "image", mimeType: "image/png", data: expect.any(String) },
      ]);
      const metadata = JSON.parse(capture.content[0].text);
      expect(metadata).toMatchObject({ ok: true, target: "headless" });
      expect(metadata.dimensions).toEqual(capture.structuredContent.dimensions);
      expect(metadata.data).toBeUndefined();
      expect(capture.isError).toBe(false);
      expect(disposers).toHaveLength(1);
      expect(disposers[0]).toHaveBeenCalledTimes(1);
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    },
  );

  it("does not double-dispose a slot explicitly stopped before disconnect", async () => {
    const root = await fixtureRoot();
    const stdin = new PassThrough();
    const done = runApertureMcpServer({
      cwd: root,
      stdin,
      stdout: { write() {} },
    });
    stdin.write(
      request(1, "app_start", {
        target: "headless",
        config: "aperture.headless.config.ts",
      }),
    );
    stdin.write(request(2, "frame_capture", { target: "headless" }));
    stdin.write(request(3, "app_stop", { target: "headless" }));
    stdin.end();
    await done;
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("drains queued captures and awaits renderer cleanup before resolving", async () => {
    const root = await fixtureRoot();
    const stdin = new PassThrough();
    let releaseRender!: () => void;
    const rendering = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    let releaseDispose!: () => void;
    const disposing = new Promise<void>((resolve) => {
      releaseDispose = resolve;
    });
    const render = renderAdapter.render.getMockImplementation()!;
    renderAdapter.render.mockImplementationOnce(async () => {
      await rendering;
      return render();
    });
    renderAdapter.dispose.mockImplementationOnce(() => disposing);
    let completed = false;
    const done = runApertureMcpServer({
      cwd: root,
      stdin,
      stdout: { write() {} },
    }).then(() => {
      completed = true;
    });
    stdin.write(
      request(1, "app_start", {
        target: "headless",
        config: "aperture.headless.config.ts",
      }),
    );
    stdin.write(request(2, "frame_capture", { target: "headless" }));
    stdin.end();
    try {
      await waitFor(() => renderAdapter.render.mock.calls.length === 1);
      expect(renderAdapter.dispose).not.toHaveBeenCalled();
      expect(disposers[0]).not.toHaveBeenCalled();
      releaseRender();
      await waitFor(() => renderAdapter.dispose.mock.calls.length === 1);
      expect(completed).toBe(false);
    } finally {
      releaseRender();
      releaseDispose();
      await done;
    }
    expect(completed).toBe(true);
  });

  it.each(["stdin", "stdout", "stderr"] as const)(
    "cleans up and rejects when %s emits an error",
    async (source) => {
      const root = await fixtureRoot();
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const streams = { stdin, stdout, stderr };
      const error = new Error("test transport failure");
      const done = runApertureMcpServer({ cwd: root, ...streams });
      const rejected = expect(done).rejects.toBe(error);
      stdin.write(
        request(1, "app_start", {
          target: "headless",
          config: "aperture.headless.config.ts",
        }),
      );
      stdin.write(request(2, "frame_capture", { target: "headless" }));
      streams[source].emit("error", error);
      await rejected;
      expect(disposers[0]).toHaveBeenCalledTimes(1);
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
      expect(stdin.listenerCount("data")).toBe(0);
      for (const stream of Object.values(streams)) {
        expect(stream.listenerCount("error")).toBe(0);
        stream.destroy();
      }
    },
  );

  it("still drains queued work and releases resources when response writes throw", async () => {
    const root = await fixtureRoot();
    const stdin = new PassThrough();
    const done = runApertureMcpServer({
      cwd: root,
      stdin,
      stdout: {
        write() {
          throw new Error("broken pipe");
        },
      },
    });
    const rejected = expect(done).rejects.toThrow(
      "MCP transport or resource cleanup failed",
    );
    stdin.write(
      request(1, "app_start", {
        target: "headless",
        config: "aperture.headless.config.ts",
      }),
    );
    stdin.write(request(2, "frame_capture", { target: "headless" }));
    await rejected;
    expect(stdin.isPaused()).toBe(true);
    expect(renderAdapter.render).toHaveBeenCalledTimes(1);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("handles asynchronous writable failures without leaking an owned session", async () => {
    const root = await fixtureRoot();
    const stdin = new PassThrough();
    const stdout = new Writable({
      write(_chunk, _encoding, callback) {
        setImmediate(() => callback(new Error("test EPIPE")));
      },
    });
    const done = runApertureMcpServer({ cwd: root, stdin, stdout });
    const rejected = expect(done).rejects.toThrow(
      "MCP transport or resource cleanup failed",
    );
    stdin.write(
      request(1, "app_start", {
        target: "headless",
        config: "aperture.headless.config.ts",
      }),
    );
    stdin.write(request(2, "frame_capture", { target: "headless" }));
    await rejected;
    expect(stdin.isPaused()).toBe(true);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    expect(stdout.listenerCount("error")).toBe(0);
  });

  it("awaits a real asynchronous feature disposer on EOF", async () => {
    const root = await fixtureRoot();
    const marker = path.join(root, "disposed.txt");
    await writeFile(
      path.join(root, "aperture.headless.config.ts"),
      `
      import { writeFile } from "node:fs/promises";
      export default { mode: "headless", systems: [], features: [{
        id: "async-cleanup",
        installRuntime: () => async () => {
          await new Promise(resolve => setImmediate(resolve));
          await writeFile(${JSON.stringify(marker)}, "disposed");
        },
      }] };
    `,
    );
    const stdin = new PassThrough();
    const done = runApertureMcpServer({
      cwd: root,
      stdin,
      stdout: { write() {} },
    });
    stdin.write(
      request(1, "app_start", {
        target: "headless",
        config: "aperture.headless.config.ts",
      }),
    );
    stdin.end();
    await done;
    expect(await readFile(marker, "utf8")).toBe("disposed");
  });

  it("retries renderer creation after a failed warm-slot launch", async () => {
    const root = await fixtureRoot();
    const manager = new ApertureMcpSessionManager({ cwd: root });
    vi.mocked(createApertureRenderSession).mockRejectedValueOnce(
      new Error("temporary browser launch failure"),
    );
    try {
      await manager.call({
        name: "app_start",
        args: { target: "headless", config: "aperture.headless.config.ts" },
      });
      expect(
        await manager.call({
          name: "frame_capture",
          args: { target: "headless" },
        }),
      ).toMatchObject({ ok: false });
      expect(
        await manager.call({
          name: "frame_capture",
          args: { target: "headless" },
        }),
      ).toMatchObject({ ok: true });
      expect(createApertureRenderSession).toHaveBeenCalledTimes(2);
    } finally {
      await manager.dispose();
    }
    expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("coalesces held renderer teardown and latches failed host cleanup before any replacement", async () => {
    const root = await fixtureRoot();
    const manager = new ApertureMcpSessionManager({ cwd: root });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const primary = new Error("render-primary-fault"),
      cleanup = new Error("render-owner-did-not-stop");
    renderAdapter.render.mockRejectedValueOnce(primary);
    renderAdapter.dispose.mockImplementationOnce(async () => {
      await held;
      throw cleanup;
    });
    try {
      expect(
        await manager.call({
          name: "app_start",
          args: { target: "headless", config: "aperture.headless.config.ts" },
        }),
      ).toMatchObject({ ok: true });
      const capture = manager.call({
        name: "frame_capture",
        args: { target: "headless" },
      });
      await waitFor(() => renderAdapter.dispose.mock.calls.length === 1, {
        timeoutMs: 10_000,
        label: "held renderer owner cleanup",
      });
      const stop = manager.call({
        name: "app_stop",
        args: { target: "headless" },
      });
      await expect(
        manager.call({
          name: "app_start",
          args: { target: "headless", config: "aperture.headless.config.ts" },
        }),
      ).resolves.toMatchObject({ ok: false });
      let settled = false;
      void stop.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
      release();
      const result = await capture;
      expect(result).toMatchObject({ ok: false });
      expect(JSON.stringify(result)).toContain(primary.message);
      expect(await stop).toMatchObject({ ok: false });
      expect(
        await manager.call({
          name: "app_status",
          args: { target: "headless" },
        }),
      ).toMatchObject({
        running: false,
        cleanupBlocked: true,
        retryable: false,
      });
      const retry = await manager.call({
        name: "app_start",
        args: { target: "headless", config: "aperture.headless.config.ts" },
      });
      expect(retry).toMatchObject({ ok: false });
      expect(JSON.stringify(retry)).toContain(cleanup.message);
      expect(createApertureRenderSession).toHaveBeenCalledTimes(1);
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await manager.dispose().catch(() => undefined);
    }
  });

  it("attempts every cleanup after a disposer fails and makes disposal idempotent", async () => {
    const root = await fixtureRoot();
    const manager = new ApertureMcpSessionManager({ cwd: root });
    await manager.call({
      name: "app_start",
      args: { target: "headless", config: "aperture.headless.config.ts" },
    });
    await manager.call({ name: "frame_capture", args: { target: "headless" } });
    renderAdapter.dispose.mockRejectedValueOnce(
      new Error("render teardown failed"),
    );
    const first = manager.dispose();
    expect(manager.dispose()).toBe(first);
    await expect(first).rejects.toThrow(
      "Failed to release MCP session resources",
    );
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    await expect(manager.call({ name: "app_start", args: {} })).rejects.toThrow(
      "disposed",
    );
  });
});

describe("injected MCP render-session factory", () => {
  it.each(["end", "error"] as const)(
    "uses the injected factory and disposes it on transport %s",
    async (event) => {
      const root = await fixtureRoot();
      const stdin = new PassThrough();
      const factory = vi.fn<typeof createApertureRenderSession>(async () => ({
        browser: { channel: "unit", headless: true, args: [] },
        dispose: renderAdapter.dispose,
        async render(input) {
          const result = await renderAdapter.render();
          return {
            ...result,
            metadata: {
              ...result.metadata,
              browser: { channel: "unit", headless: true, args: [] },
              requestedDimensions: { width: input.width, height: input.height },
              actualDimensions: { width: 1, height: 1 },
              bundleDigest: null,
            },
          };
        },
      }));
      const done = runApertureMcpServer({
        cwd: root,
        stdin,
        stdout: { write() {} },
        renderSessionFactory: factory,
      });
      stdin.write(
        request(1, "app_start", {
          target: "headless",
          config: "aperture.headless.config.ts",
        }),
      );
      stdin.write(request(2, "frame_capture", { target: "headless" }));
      if (event === "end") {
        stdin.end();
        await done;
      } else {
        const rejected = expect(done).rejects.toThrow(
          "injected transport failure",
        );
        stdin.emit("error", new Error("injected transport failure"));
        await rejected;
      }
      expect(factory).toHaveBeenCalledExactlyOnceWith({
        displayWidth: 1920,
        displayHeight: 1080,
      });
      expect(createApertureRenderSession).not.toHaveBeenCalled();
      expect(renderAdapter.dispose).toHaveBeenCalledTimes(1);
    },
  );
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-mcp-lifecycle-"));
  tempRoots.push(root);
  await writeFile(
    path.join(root, "aperture.headless.config.ts"),
    `export default { mode: "headless", systems: [], render: { defaultCamera: false, defaultLight: false } };\n`,
  );
  return root;
}

function request(
  id: number,
  name: string,
  args: Record<string, unknown>,
): string {
  return `${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })}\n`;
}
