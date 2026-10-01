import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runHeadlessServeCommand } from "../../packages/cli/src/commands/headless-serve.js";
import { waitFor } from "../helpers/wait.js";
import * as headless from "../../packages/cli/src/headless/session-controller.js";

const roots: string[] = [];
const disposers: ReturnType<typeof vi.fn<() => Promise<void>>>[] = [];
vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  const create = headless.createHeadlessSessionController;
  vi.spyOn(headless, "createHeadlessSessionController").mockImplementation(
    async (options) => {
      const controller = await create(options);
      const dispose = vi.fn(() => controller.dispose());
      disposers.push(dispose);
      return { ...controller, dispose };
    },
  );
});

afterEach(async () => {
  for (const dispose of disposers.splice(0)) {
    if (dispose.mock.calls.length === 0) await dispose();
  }
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("headless serve resource lifecycle", () => {
  it.each(["EOF", "shutdown"])("awaits feature cleanup on %s", async (mode) => {
    const root = await fixtureRoot();
    const output: string[] = [];
    await runHeadlessServeCommand({
      cwd: root,
      argv: ["aperture.headless.config.ts"],
      stdin: Readable.from(
        mode === "EOF"
          ? ['{"id":1,"cmd":"step"}\n']
          : ['{"id":1,"cmd":"shutdown"}\n'],
      ),
      stdout: (text) => {
        output.push(text);
      },
    });
    expect(JSON.parse(output[0]!).ready).toBe(true);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
      "disposed",
    );
  });

  it("disposes the session when the initial ready output throws", async () => {
    const root = await fixtureRoot();
    const error = new Error("ready output failed");
    await expect(
      runHeadlessServeCommand({
        cwd: root,
        argv: ["aperture.headless.config.ts"],
        stdin: Readable.from([]),
        stdout: () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
      "disposed",
    );
  });

  it("drains an asynchronous bundle write before disposing on EOF", async () => {
    const root = await fixtureRoot();
    const out = path.join(root, "frame.bundle.json");
    const responses: Record<string, unknown>[] = [];
    await runHeadlessServeCommand({
      cwd: root,
      argv: ["aperture.headless.config.ts"],
      stdin: Readable.from([
        `${JSON.stringify({ id: 1, cmd: "bundle", params: { out } })}\n`,
        '{"id":2,"cmd":"get-status"}\n',
      ]),
      stdout: (text) => {
        responses.push(JSON.parse(text));
      },
    });
    expect(responses.slice(1).map((response) => response["id"])).toEqual([
      1, 2,
    ]);
    expect(
      responses.slice(1).every((response) => response["ok"] === true),
    ).toBe(true);
    expect(JSON.parse(await readFile(out, "utf8")).format).toBe(
      "aperture.render-bundle",
    );
    expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
      "disposed",
    );
  });

  it("drains queued commands and disposes after output throws with stdin left open", async () => {
    const root = await fixtureRoot();
    const stdin = new PassThrough();
    const out = path.join(root, "after-output-error.bundle.json");
    const responses: Record<string, unknown>[] = [];
    const error = new Error("command output failed");
    const done = runHeadlessServeCommand({
      cwd: root,
      argv: ["aperture.headless.config.ts"],
      stdin,
      stdout(text) {
        const response = JSON.parse(text) as Record<string, unknown>;
        if (response["id"] === 1) throw error;
        responses.push(response);
      },
    });
    const rejected = expect(done).rejects.toBe(error);
    await waitFor(() => responses.length === 1);
    stdin.write(
      `{ "id": 1, "cmd": "step" }\n${JSON.stringify({ id: 2, cmd: "bundle", params: { out } })}\n{ "id": 3, "cmd": "get-status" }\n`,
    );
    await rejected;
    expect(responses.slice(1).map((response) => response["id"])).toEqual([
      2, 3,
    ]);
    expect(JSON.parse(await readFile(out, "utf8")).format).toBe(
      "aperture.render-bundle",
    );
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
      "disposed",
    );
    expect(stdin.isPaused()).toBe(true);
    expect(stdin.listenerCount("data")).toBe(0);
    stdin.destroy();
  });

  it.each(["close", "error"] as const)(
    "disposes when input emits %s",
    async (event) => {
      const root = await fixtureRoot();
      const stdin = new PassThrough();
      let ready = false;
      const done = runHeadlessServeCommand({
        cwd: root,
        argv: ["aperture.headless.config.ts"],
        stdin,
        stdout: () => {
          ready = true;
        },
      });
      const error = new Error("serve input failed");
      const outcome =
        event === "error"
          ? expect(done).rejects.toBe(error)
          : expect(done).resolves.toBe(0);
      await waitFor(() => ready);
      stdin.destroy(event === "error" ? error : undefined);
      await outcome;
      expect(disposers[0]).toHaveBeenCalledTimes(1);
      expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
        "disposed",
      );
    },
  );

  it("ignores commands queued after explicit shutdown and cleans up once", async () => {
    const root = await fixtureRoot();
    const responses: Record<string, unknown>[] = [];
    await runHeadlessServeCommand({
      cwd: root,
      argv: ["aperture.headless.config.ts"],
      stdin: Readable.from([
        '{"id":1,"cmd":"shutdown"}\n{"id":2,"cmd":"step"}\n',
      ]),
      stdout: (text) => {
        responses.push(JSON.parse(text));
      },
    });
    expect(responses.slice(1).map((response) => response["id"])).toEqual([1]);
    expect(disposers[0]).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(root, "disposed.txt"), "utf8")).toBe(
      "disposed",
    );
  });
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-serve-lifecycle-"),
  );
  roots.push(root);
  await writeFile(
    path.join(root, "aperture.headless.config.ts"),
    `
    import { writeFile } from "node:fs/promises";
    export default { mode: "headless", systems: [], features: [{
      id: "owned-timer",
      installRuntime() {
        const timer = setInterval(() => {}, 1000);
        return async () => {
          clearInterval(timer);
          await writeFile(${JSON.stringify(path.join(root, "disposed.txt"))}, "disposed");
        };
      },
    }] };
  `,
  );
  return root;
}
