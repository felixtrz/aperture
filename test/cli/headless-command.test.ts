import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { runHeadlessCommand } from "@aperture-engine/cli";

const execFileAsync = promisify(execFile);

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI_BIN = path.join(REPO_ROOT, "packages/cli/dist/bin/aperture.js");
const PROCEDURAL_CONFIG = path.join(
  REPO_ROOT,
  "test/fixtures/headless-procedural/aperture.headless.config.ts",
);
const BROWSER_CONFIG = path.join(
  REPO_ROOT,
  "test/fixtures/headless-procedural/aperture.browser.config.ts",
);
const BAD_SYSTEM_CONFIG = path.join(
  REPO_ROOT,
  "test/fixtures/headless-bad-system/aperture.headless.config.ts",
);
const NONDETERMINISTIC_CONFIG = path.join(
  REPO_ROOT,
  "test/fixtures/headless-nondeterministic/aperture.headless.config.ts",
);

async function runInProcess(
  argv: readonly string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runHeadlessCommand({
    argv,
    cwd: REPO_ROOT,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
}

async function expectRejectedCode(
  argv: readonly string[],
  code: string,
): Promise<void> {
  await expect(runInProcess(argv)).rejects.toMatchObject({ code });
}

describe("aperture headless command — argument handling (P1.4)", () => {
  it("prints help and exits 0", async () => {
    const result = await runInProcess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--frames");
    expect(result.stdout).toContain("--out");
    expect(result.stdout).toContain("--inject");
    expect(result.stdout).toContain("--asset-mode");
    expect(result.stdout).toContain("--decoder-assets-dir");
    expect(result.stdout).toContain("--allow-http-assets");
    expect(result.stdout).toContain("--determinism");
  });

  it("requires a config path", async () => {
    await expectRejectedCode(
      ["--out", "x.json"],
      "aperture.headless.missingConfig",
    );
  });

  it("requires --out", async () => {
    await expectRejectedCode(
      [PROCEDURAL_CONFIG],
      "aperture.headless.missingOutput",
    );
  });

  it("rejects unknown options", async () => {
    await expectRejectedCode(
      [PROCEDURAL_CONFIG, "--out", "x.json", "--bogus"],
      "aperture.headless.unknownOption",
    );
  });

  it("rejects a non-integer --frames", async () => {
    await expectRejectedCode(
      [PROCEDURAL_CONFIG, "--out", "x.json", "--frames", "abc"],
      "aperture.headless.invalidOption",
    );
  });

  it("rejects an invalid --asset-mode", async () => {
    await expectRejectedCode(
      [PROCEDURAL_CONFIG, "--out", "x.json", "--asset-mode", "browser"],
      "aperture.headless.invalidOption",
    );
  });

  it("rejects an invalid --determinism mode", async () => {
    await expectRejectedCode(
      [PROCEDURAL_CONFIG, "--out", "x.json", "--determinism", "strict"],
      "aperture.headless.invalidOption",
    );
  });

  it("reports a missing config file", async () => {
    await expectRejectedCode(
      [path.join(REPO_ROOT, "does-not-exist.config.ts"), "--out", "x.json"],
      "aperture.headless.configNotFound",
    );
  });
});

describe("aperture headless command — end to end, in-process (PA.3)", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir !== undefined) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes a renderable render bundle from a procedural app", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));
    const out = path.join(tempDir, "snapshot.json");

    const { stdout } = await runInProcess([
      PROCEDURAL_CONFIG,
      "--frames",
      "5",
      "--out",
      out,
    ]);

    expect(stdout).toContain("Wrote render bundle");
    // Hybrid is the default asset mode (#66): the placeholder default made
    // GLB-only scenes extract zero mesh draws out of the box.
    expect(stdout).toContain("Asset mode: hybrid");
    expect(stdout).toContain("Render target: 960x640");

    const bundle = JSON.parse(await readFile(out, "utf8")) as {
      format: string;
      version: number;
      frame: number;
      renderTarget: { width: number; height: number };
      snapshot: { codec: string; value: { meshDraws: unknown[] } };
      assets: { entries: unknown[] };
    };

    expect(bundle.format).toBe("aperture.render-bundle");
    expect(bundle.version).toBe(1);
    expect(bundle.frame).toBe(4);
    expect(bundle.renderTarget).toMatchObject({ width: 960, height: 640 });
    expect(bundle.snapshot.codec).toBe("json-typed-array-v1");
    expect(bundle.snapshot.value.meshDraws.length).toBe(1);
    expect(bundle.assets.entries.length).toBeGreaterThan(0);
  });

  it("prints the headless status report with --json", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));
    const out = path.join(tempDir, "snapshot.json");

    const { stdout } = await runInProcess([
      PROCEDURAL_CONFIG,
      "--frames",
      "2",
      "--out",
      out,
      "--json",
    ]);

    const status = JSON.parse(stdout) as { mode: string; nextFrame: number };
    expect(status.mode).toBe("headless");
    expect(status.nextFrame).toBe(2);
  });

  it("rejects a non-headless config with aperture.headless.invalidMode", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));
    await expectRejectedCode(
      [BROWSER_CONFIG, "--out", path.join(tempDir, "s.json")],
      "aperture.headless.invalidMode",
    );
  });

  it("warns about a system without a default export but still writes a bundle", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));
    const out = path.join(tempDir, "snapshot.json");

    const { stderr } = await runInProcess([BAD_SYSTEM_CONFIG, "--out", out]);

    expect(stderr).toContain("aperture.system.missingDefaultExport");
    const bundle = JSON.parse(await readFile(out, "utf8")) as {
      format: string;
    };
    expect(bundle.format).toBe("aperture.render-bundle");
  });

  it("reports nondeterministic globals as warnings when requested", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));
    const out = path.join(tempDir, "snapshot.json");

    const result = await runInProcess([
      NONDETERMINISTIC_CONFIG,
      "--out",
      out,
      "--determinism",
      "warn",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      "warning aperture.determinism.nondeterministicGlobal",
    );
    expect(result.stderr).toContain("Math.random");
    const bundle = JSON.parse(await readFile(out, "utf8")) as {
      format: string;
    };
    expect(bundle.format).toBe("aperture.render-bundle");
  });

  it("fails the command for nondeterministic globals in error mode", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-"));

    await expectRejectedCode(
      [
        NONDETERMINISTIC_CONFIG,
        "--out",
        path.join(tempDir, "snapshot.json"),
        "--determinism",
        "error",
      ],
      "aperture.headless.determinismViolation",
    );
  });
});

describe("aperture headless command — shipped binary smoke (PA.3)", () => {
  let tempDir: string;

  beforeAll(async () => {
    // One subprocess test that the published binary actually boots and loads
    // the engine natively (dist realm). CI builds before tests; build on demand
    // if a developer runs vitest without a prior build.
    try {
      await stat(CLI_BIN);
    } catch {
      await execFileAsync("pnpm", ["run", "build"], { cwd: REPO_ROOT });
    }
  }, 240_000);

  afterEach(async () => {
    if (tempDir !== undefined) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("runs the built CLI against a procedural config", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-headless-smoke-"));
    const out = path.join(tempDir, "snapshot.json");

    const { stdout } = await execFileAsync("node", [
      CLI_BIN,
      "headless",
      PROCEDURAL_CONFIG,
      "--frames",
      "2",
      "--out",
      out,
    ]);

    expect(stdout).toContain("Wrote render bundle");
    const bundle = JSON.parse(await readFile(out, "utf8")) as {
      format: string;
    };
    expect(bundle.format).toBe("aperture.render-bundle");
  }, 120_000);
});
