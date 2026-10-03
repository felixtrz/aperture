import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  cloudTestCommands,
  runCloudTests,
  verifyCloudTestEnvironment,
} from "../../scripts/test-cloud.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(path.join(repo, "package.json"), "utf8"),
);
const root = "/workspace/scratch/0190a8c72f8a/aperture-tmp";
const id = "run-" + "a".repeat(32);
function fixture(overrides = {}) {
  const env = {
    APERTURE_TMP_ROOT: root,
    APERTURE_TMP_RUN_ID: id,
    APERTURE_TMP_RUN: path.join(root, id),
    APERTURE_TMP_LOCK_FD: "17",
    APERTURE_WEBGPU_RUNTIME: "/runtime",
    APERTURE_TEST_CLOUD_RENDER_OUTPUT: "/retained/evidence",
    ...overrides,
  };
  const io = {
    realpath: vi.fn(async (value) =>
      value === "/proc/self/fd/17" ? path.join(root, ".lifecycle.lock") : value,
    ),
    stat: vi.fn(async () => ({ isDirectory: () => true })),
    readFile: vi.fn(async () =>
      JSON.stringify({
        schema: "aperture.disposable-run.v2",
        run_id: id,
        state: "active",
      }),
    ),
  };
  return { env, io };
}

describe("test runner routing", () => {
  it("keeps portable defaults and explicit active recorder routing", () => {
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts["test:coverage"]).toBe("vitest run --coverage");
    expect(packageJson.scripts.check).toContain("pnpm test");
    expect(packageJson.scripts.check.split(" && ")).not.toContain(
      "pnpm run test:cloud",
    );
    expect(packageJson.scripts["test:cloud"]).toBe(
      "node scripts/test-cloud.mjs",
    );
    expect(packageJson.scripts["test:cloud:recorder"]).toBe(
      "node --test benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs",
    );
    expect(cloudTestCommands(["--exclude", "test/cli/**"])).toEqual([
      [
        process.execPath,
        [
          "--test",
          "benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs",
        ],
      ],
      [
        process.execPath,
        [
          path.join(repo, "node_modules/vitest/vitest.mjs"),
          "run",
          "--exclude",
          "test/cli/**",
        ],
      ],
    ]);
  });

  it("discovers canonical tests without executing any archive or test body", () => {
    const files = execFileSync(
      process.execPath,
      [
        path.join(repo, "node_modules/vitest/vitest.mjs"),
        "list",
        "--filesOnly",
      ],
      { cwd: repo, encoding: "utf8", timeout: 30000 },
    );
    expect(files).toContain("test/scripts/test-discovery.test.mjs");
    expect(files).toContain("test/webgpu/webgpu-app.test.ts");
    expect(files).toContain("test/cli/");
    expect(files).not.toContain("benchmarks/");
    expect(files).not.toContain("test/e2e/");
    expect(files).not.toContain("node-test.mjs");
  }, 35000);

  it("accepts an active inherited lifecycle and explicit native route", async () => {
    const { env, io } = fixture();
    await expect(verifyCloudTestEnvironment(env, io)).resolves.toBeUndefined();
  });

  for (const name of [
    "APERTURE_WEBGPU_RUNTIME",
    "APERTURE_TEST_CLOUD_RENDER_OUTPUT",
  ]) {
    for (const value of [undefined, "", "relative/path"]) {
      it(`fails closed before spawning with invalid ${name}=${String(value)}`, async () => {
        const options = fixture({ [name]: value });
        const spawn = vi.fn();
        await expect(runCloudTests([], { ...options, spawn })).rejects.toThrow(
          name,
        );
        expect(spawn).not.toHaveBeenCalled();
      });
    }
  }

  for (const output of [
    root,
    path.join(root, id, "renders"),
    "/workspace/shared/aperture-tmp/renders",
  ]) {
    it(`rejects retained output in disposable scratch: ${output}`, async () => {
      const { env, io } = fixture({
        APERTURE_TEST_CLOUD_RENDER_OUTPUT: output,
      });
      await expect(verifyCloudTestEnvironment(env, io)).rejects.toThrow(
        "outside disposable scratch",
      );
    });
  }

  it("rejects a retained-output symlink into scratch", async () => {
    const { env, io } = fixture();
    const realpath = io.realpath;
    io.realpath = vi.fn(async (value) =>
      value === env.APERTURE_TEST_CLOUD_RENDER_OUTPUT
        ? path.join(root, id)
        : realpath(value),
    );
    await expect(verifyCloudTestEnvironment(env, io)).rejects.toThrow(
      "outside disposable scratch",
    );
  });

  it("rejects missing directories, inactive lifecycles, and mismatched locks", async () => {
    for (const problem of ["directory", "manifest", "lock"]) {
      const { env, io } = fixture();
      if (problem === "directory")
        io.stat.mockResolvedValue({ isDirectory: () => false });
      if (problem === "manifest")
        io.readFile.mockResolvedValue(
          JSON.stringify({
            schema: "aperture.disposable-run.v2",
            run_id: id,
            state: "completed",
          }),
        );
      if (problem === "lock")
        io.realpath.mockImplementation(async (value) =>
          value === "/proc/self/fd/17" ? "/wrong-lock" : value,
        );
      await expect(verifyCloudTestEnvironment(env, io)).rejects.toThrow();
    }
  });

  it("runs Node first, forwards Vitest filters unchanged, and preserves the environment", async () => {
    const options = fixture();
    const spawn = vi.fn(() => ({ status: 0 }));
    expect(
      await runCloudTests(["--exclude", "test/cli/**"], { ...options, spawn }),
    ).toBe(0);
    expect(spawn.mock.calls.map(([command, argv]) => [command, argv])).toEqual(
      cloudTestCommands(["--exclude", "test/cli/**"]),
    );
    expect(
      spawn.mock.calls.every(
        ([, , settings]) =>
          settings.env === options.env && settings.stdio === "inherit",
      ),
    ).toBe(true);
  });

  it("stops on recorder failure and propagates Vitest failure", async () => {
    for (const statuses of [[7], [0, 9], [null]]) {
      const options = fixture();
      const spawn = vi.fn();
      for (const status of statuses) spawn.mockReturnValueOnce({ status });
      expect(await runCloudTests([], { ...options, spawn })).toBe(
        statuses.at(-1) ?? 1,
      );
      expect(spawn).toHaveBeenCalledTimes(statuses.length);
    }
  });

  it("propagates runner launch errors without starting later runners", async () => {
    const options = fixture();
    const spawn = vi.fn(() => ({ error: new Error("spawn failed") }));
    await expect(runCloudTests([], { ...options, spawn })).rejects.toThrow(
      "spawn failed",
    );
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
