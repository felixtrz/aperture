import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import * as headless from "@aperture-engine/app/headless";
import * as cameraTools from "@aperture-engine/app/headless-tools";
import {
  createSystem,
  defineResource,
  material,
  mesh,
  resource,
  type CameraLocalInspectionReport,
} from "@aperture-engine/app/systems";
import { Camera, Mesh } from "@aperture-engine/render";
import { LocalTransform } from "@aperture-engine/simulation";
import { runApertureCli } from "../../packages/cli/src/cli.js";
import { runCameraCommand } from "../../packages/cli/src/commands/camera.js";
import * as loader from "../../packages/cli/src/headless/config-loader.js";
import * as disposal from "../../packages/cli/src/headless/dispose-runner.js";
import * as assetLoader from "../../packages/cli/src/headless/node-asset-loader.js";

vi.setConfig({ testTimeout: 30_000 });

const Probe = defineResource("test.cameraInspectLocal.command", {
  request: resource.value<unknown>(null),
  inspection: resource.value({ ok: true, result: { stale: true } }),
});
const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
  },
});
let root: string;
let configFile: string;
let width: number;
let translate: number;
let autoAspect: boolean;
let rolled: boolean;
let missingBounds: boolean;
let randomized: boolean;
let requestOverride: unknown;
let destroyed: number;
let finalAspect: number;
let runners: headless.ApertureHeadlessRunner[];

function request() {
  return {
    camera: { key: "camera.main" },
    viewport: { width: 800, height: 600 },
    subjects: [
      {
        name: "plate",
        entity: { key: "assembly" },
        points: [{ name: "edge", local: [width / 2, 0, 0] }],
        bounds: { source: "mesh-local-aabb", includeDescendants: true },
      },
    ],
    cameraJob: { referenceDistance: 10 },
  };
}

beforeEach(async () => {
  root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-camera-inspect-command-"),
  );
  configFile = path.join(root, "aperture.headless.config.ts");
  await writeFile(configFile, "export default {};\n");
  width = 3;
  translate = 1;
  autoAspect = true;
  rolled = false;
  missingBounds = false;
  randomized = false;
  requestOverride = undefined;
  destroyed = 0;
  finalAspect = 0;
  runners = [];
  class Scene extends createSystem() {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: {
          translation: [0, 0, 10],
          lookAt: [0, 0, 0],
          ...(rolled
            ? {
                rotation: [
                  0,
                  0,
                  Math.sin(Math.PI / 8),
                  Math.cos(Math.PI / 8),
                ] as const,
              }
            : {}),
        },
        camera: {
          projection: "orthographic",
          orthographicHeight: 6,
          aspect: 2,
          autoAspect,
          near: 0.1,
          far: 100,
        },
      });
      const assembly = this.spawn.group({ key: "assembly" });
      const plate = this.spawn.mesh({
        mesh: mesh.box({ size: [width, 2, 0.1] }),
        material: material.standard(),
        transform: { parent: assembly },
      });
      if (missingBounds) plate.setValue(Mesh, "meshId", "mesh:unavailable");
      this.resources.set(Probe, {
        request: requestOverride === undefined ? request() : requestOverride,
        inspection: { ok: true, result: { stale: true } },
      });
      // A saved init-time inspection would miss this later authored edit.
      assembly.getVectorView(LocalTransform, "translation")[0] = randomized
        ? this.random.range(-5, 5)
        : translate;
    }
    override update(): void {
      throw new Error("Inspection must not step systems");
    }
    override async destroy(): Promise<void> {
      await Promise.resolve();
      destroyed++;
    }
  }
  vi.spyOn(loader, "loadApertureHeadlessApp").mockResolvedValue({
    config,
    configFile,
    root,
    diagnostics: [],
    systems: [{ default: Scene }],
  });
  const create = headless.createApertureHeadlessRunner;
  vi.spyOn(headless, "createApertureHeadlessRunner").mockImplementation(
    async (options) => {
      const runner = await create(options);
      runners.push(runner);
      vi.spyOn(runner, "step");
      vi.spyOn(runner, "stepWithoutExtract");
      vi.spyOn(runner, "extract");
      vi.spyOn(runner.app, "step");
      vi.spyOn(runner.app, "extract");
      return runner;
    },
  );
  const dispose = disposal.disposeHeadlessRunner;
  vi.spyOn(disposal, "disposeHeadlessRunner").mockImplementation(
    async (runner) => {
      const ref = runner.entities.find({ key: "camera.main" }).summaries[0]!
        .entity;
      const camera = runner.app.lowLevel.world.entityManager.getEntityByIndex(
        ref.index,
      )!;
      finalAspect = camera.getValue(Camera, "aspect")!;
      return dispose(runner);
    },
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const runner of runners) await disposal.disposeHeadlessRunner(runner);
  await rm(root, { force: true, recursive: true });
});

async function run(args: readonly string[], cli = false) {
  let stdout = "",
    stderr = "";
  const options = {
    argv: ["inspect-local", configFile, ...args],
    cwd: root,
    stdout: (text: string) => {
      stdout += text;
    },
    stderr: (text: string) => {
      stderr += text;
    },
  };
  const code = cli
    ? await runApertureCli({ ...options, argv: ["camera", ...options.argv] })
    : await runCameraCommand(options);
  return { code, stdout, stderr };
}
const resourceArgs = ["--request-resource", Probe.id];
function report(stdout: string): CameraLocalInspectionReport {
  const envelope = JSON.parse(stdout) as {
    ok: boolean;
    result: CameraLocalInspectionReport;
  };
  expect(envelope.ok).toBe(true);
  return envelope.result;
}

describe("one-shot local camera inspection", () => {
  it("shares the JSON/resource result, recomputes fresh ECS data, and awaits disposal before output", async () => {
    const input = path.join(root, "request.json");
    const out = path.join(root, "report.json");
    await writeFile(input, JSON.stringify(request()));
    const fresh = await run([...resourceArgs, "--out", out]);
    const explicit = await run(["--request", input]);
    expect(fresh.code).toBe(0);
    expect(fresh.stdout).toBe(explicit.stdout);
    expect(await readFile(out, "utf8")).toBe(fresh.stdout);
    expect(report(fresh.stdout).subjects[0]!.points[0]!.world).toEqual([
      2.5, 0, 0,
    ]);
    expect(report(fresh.stdout).camera.aspect).toBeCloseTo(4 / 3);
    expect(finalAspect).toBe(2);
    expect(destroyed).toBe(2);
    for (const runner of runners) {
      expect(runner.step).not.toHaveBeenCalled();
      expect(runner.stepWithoutExtract).not.toHaveBeenCalled();
      expect(runner.extract).not.toHaveBeenCalled();
      expect(runner.app.step).not.toHaveBeenCalled();
      expect(runner.app.extract).not.toHaveBeenCalled();
    }
    width = 4;
    translate = 1.25;
    const changed = report((await run(resourceArgs)).stdout);
    expect(changed.subjects[0]!.points[0]!.world).toEqual([3.25, 0, 0]);
    expect(changed.subjects[0]!.points[0]!.pixel![0]).toBeCloseTo(725);
    expect(headless.createApertureHeadlessRunner).toHaveBeenCalledWith(
      expect.objectContaining({ random: 0 }),
    );
  });

  it("retains fixed aspect and deterministic explicit seeds", async () => {
    autoAspect = false;
    randomized = true;
    const a = await run([...resourceArgs, "--seed", "7"]);
    const b = await run([...resourceArgs, "--seed", "7"]);
    const c = await run([...resourceArgs, "--seed", "8"]);
    expect(a.stdout).toBe(b.stdout);
    expect(a.stdout).not.toBe(c.stdout);
    expect(report(a.stdout).camera.aspect).toBe(2);
    expect(finalAspect).toBe(2);
  });

  it("accepts existing headless integer seed spellings", async () => {
    for (const [text, seed] of [
      ["-1e2", -100],
      ["0x64", 100],
    ] as const) {
      expect((await run([...resourceArgs, "--seed", text])).code).toBe(0);
      expect(headless.createApertureHeadlessRunner).toHaveBeenLastCalledWith(
        expect.objectContaining({ random: seed }),
      );
    }
  });

  it("preserves incomplete bounds with null aggregates on exit 0", async () => {
    missingBounds = true;
    const result = await run(resourceArgs);
    expect(result.code).toBe(0);
    expect(report(result.stdout).subjects[0]!.bounds).toMatchObject({
      status: "incomplete",
      screenBounds: null,
      diagnostics: [{ code: "aperture.camera.local.boundsUnavailable" }],
    });
  });

  it("retains a valid report when the optional camera job cannot represent the camera", async () => {
    rolled = true;
    const result = await run(resourceArgs);
    expect(result.code).toBe(0);
    expect(report(result.stdout).cameraJob).toBeNull();
    expect(report(result.stdout).cameraJobDiagnostics.length).toBeGreaterThan(
      0,
    );
  });

  it("uses strict assets by default and forwards existing loader flags", async () => {
    const spy = vi.spyOn(assetLoader, "createNodeApertureAssetLoader");
    await run(resourceArgs);
    expect(spy).toHaveBeenLastCalledWith({
      mode: "strict",
      root,
      publicDir: "public",
      allowHttp: false,
    });
    await run([
      ...resourceArgs,
      "--asset-mode",
      "hybrid",
      "--public-dir",
      "static",
      "--decoder-assets-dir",
      "decoders",
      "--allow-http-assets",
    ]);
    expect(spy).toHaveBeenLastCalledWith({
      mode: "hybrid",
      root,
      publicDir: "static",
      allowHttp: true,
      decoderAssetsDir: path.join(root, "decoders"),
    });
  });

  it.each([
    [
      "missing resource",
      ["--request-resource", "missing"],
      undefined,
      "requestResourceNotFound",
    ],
    ["missing request", resourceArgs, null, "invalidInspection"],
    [
      "wrong selector",
      resourceArgs,
      { camera: { key: "missing" } },
      "invalidInspection",
    ],
    [
      "unknown top field",
      resourceArgs,
      { target: "headless" },
      "invalidInspection",
    ],
    [
      "nested shape",
      resourceArgs,
      { viewport: { width: 0, height: 600 } },
      "invalidInspection",
    ],
  ] as const)(
    "returns diagnostic envelope and exit 2 for %s",
    async (_name, args, override, code) => {
      requestOverride =
        override == null ? override : { ...request(), ...override };
      const out = path.join(root, "failure.json");
      const result = await run([...args, "--out", out], true);
      expect(result.code).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        diagnostics: [{ code: `aperture.camera.local.${code}` }],
      });
      expect(await readFile(out, "utf8")).toBe(result.stdout);
      expect(destroyed).toBe(1);
    },
  );

  it("rejects malformed JSON before boot and translates failure to CLI exit 1", async () => {
    const input = path.join(root, "request.json");
    await writeFile(input, "{bad");
    const result = await run(["--request", input], true);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("aperture.camera.invalidJson");
    expect(result.stdout).toBe("");
    expect(headless.createApertureHeadlessRunner).not.toHaveBeenCalled();
  });

  it.each([
    [],
    ["--request-resource"],
    [...resourceArgs, "--request", "request.json"],
    [...resourceArgs, "--seed", "NaN"],
    [...resourceArgs, "--seed", "1.5"],
    [...resourceArgs, "--seed", "0", "--seed", "1"],
    [...resourceArgs, "--out"],
    [...resourceArgs, "--asset-mode", "browser"],
    [...resourceArgs, "extra"],
    [...resourceArgs, "--frames", "1"],
    [...resourceArgs, "--allow-http-assets", "--allow-http-assets"],
  ])("rejects invalid options before loading: %j", async (...args) => {
    await expect(run(args)).rejects.toMatchObject({
      code: "aperture.camera.usage",
    });
    expect(loader.loadApertureHeadlessApp).not.toHaveBeenCalled();
  });

  it("protects config/request aliases and replaces independent output symlinks safely", async () => {
    const input = path.join(root, "request.json");
    const original = JSON.stringify(request());
    await writeFile(input, original);
    const alias = path.join(root, "alias");
    await symlink(root, alias, "dir");
    for (const output of [
      configFile,
      input,
      path.join(alias, "request.json"),
    ]) {
      await expect(
        run(["--request", input, "--out", output]),
      ).rejects.toMatchObject({ code: "aperture.camera.usage" });
    }
    const inputLink = path.join(root, "input-link.json");
    await symlink(input, inputLink);
    await expect(
      run(["--request", inputLink, "--out", input]),
    ).rejects.toMatchObject({ code: "aperture.camera.usage" });
    await expect(
      run(["--request", inputLink, "--out", inputLink]),
    ).rejects.toMatchObject({ code: "aperture.camera.usage" });
    const outputLink = path.join(root, "output-link.json");
    await symlink(input, outputLink);
    expect((await run(["--request", input, "--out", outputLink])).code).toBe(0);
    expect(await readFile(input, "utf8")).toBe(original);
  });

  it("retains prior output on cleanup failure and exposes semantic failure diagnostics", async () => {
    const out = path.join(root, "report.json");
    await writeFile(out, "prior report");
    vi.mocked(disposal.disposeHeadlessRunner).mockRestore();
    const actualDispose = disposal.disposeHeadlessRunner;
    vi.spyOn(disposal, "disposeHeadlessRunner").mockImplementation(
      async (runner) => {
        await actualDispose(runner);
        return [new Error("cleanup marker")];
      },
    );
    const result = await run(
      ["--request-resource", "missing", "--out", out],
      true,
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cleanup marker");
    expect(result.stderr).toContain("requestResourceNotFound");
    expect(result.stdout).toBe("");
    expect(await readFile(out, "utf8")).toBe("prior report");
    expect(destroyed).toBe(1);
  });

  it("preserves an unexpected primary exception when cleanup and its warning sink also fail", async () => {
    const primary = new Error("inspection marker");
    vi.spyOn(cameraTools, "callCameraTool").mockImplementation(() => {
      throw primary;
    });
    vi.mocked(disposal.disposeHeadlessRunner).mockRestore();
    const actualDispose = disposal.disposeHeadlessRunner;
    vi.spyOn(disposal, "disposeHeadlessRunner").mockImplementation(
      async (runner) => {
        await actualDispose(runner);
        throw new Error("cleanup marker");
      },
    );
    await expect(
      runCameraCommand({
        argv: ["inspect-local", configFile, ...resourceArgs],
        cwd: root,
        stdout() {
          throw new Error("must not publish");
        },
        stderr() {
          throw new Error("warning sink failed");
        },
      }),
    ).rejects.toBe(primary);
    expect(destroyed).toBe(1);
  });

  it("disposes before report publication and cleans temporary files on output failure", async () => {
    await runCameraCommand({
      argv: ["inspect-local", configFile, ...resourceArgs],
      cwd: root,
      stdout() {
        expect(destroyed).toBe(1);
      },
    });
    const out = path.join(root, "directory");
    await mkdir(out);
    await expect(run([...resourceArgs, "--out", out])).rejects.toMatchObject({
      code: "aperture.camera.writeFailed",
    });
    expect(destroyed).toBe(2);
    expect((await readdir(root)).some((name) => name.endsWith(".tmp"))).toBe(
      false,
    );
    await expect(
      runCameraCommand({
        argv: ["inspect-local", configFile, ...resourceArgs],
        cwd: root,
        stdout() {
          throw new Error("stdout failed");
        },
      }),
    ).rejects.toThrow("stdout failed");
    expect(destroyed).toBe(3);
  });

  it("routes dedicated help without booting", async () => {
    const result = await run(["--help"], true);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("--request-resource");
    expect(result.stdout).toContain("background/manual");
    expect(loader.loadApertureHeadlessApp).not.toHaveBeenCalled();
  });
});
