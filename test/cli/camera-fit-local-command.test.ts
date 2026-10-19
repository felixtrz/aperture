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
import {
  createSystem,
  defineResource,
  material,
  mesh,
  resource,
  type CameraLocalInspectionReport,
  type CameraLocalJobSeed,
} from "@aperture-engine/app/systems";
import { Camera } from "@aperture-engine/render";
import { LocalTransform } from "@aperture-engine/simulation";
import { runCameraCommand } from "../../packages/cli/src/commands/camera.js";
import { runApertureCli } from "../../packages/cli/src/cli.js";
import {
  fitCameraLandmarks,
  projectCameraLandmarks,
} from "../../packages/cli/src/camera/landmarks.js";
import * as loader from "../../packages/cli/src/headless/config-loader.js";
import * as disposal from "../../packages/cli/src/headless/dispose-runner.js";

vi.setConfig({ testTimeout: 30_000 });
const Probe = defineResource("test.cameraFitLocal.command", {
  request: resource.value<unknown>(null),
});
const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
  },
});
type Vec3 = readonly [number, number, number];
let root: string, configFile: string, planFile: string;
let width: number, upperHeight: number, initialized: number, destroyed: number;
let perspective: boolean,
  inconsistent: boolean,
  untargeted: boolean,
  cameraDependent: boolean,
  collapsed: boolean;
let applied: ReturnType<typeof fitCameraLandmarks>["spawnCamera"] | undefined;
let runners: headless.ApertureHeadlessRunner[];
let cameraBefore: unknown, cameraAfter: unknown;
const names = ["back-left", "back-right", "front-right", "front-left"];
const localCorners = (w: number): Vec3[] => [
  [-w / 2, 0, -1.5],
  [w / 2, 0, -1.5],
  [w / 2, 0, 1.5],
  [-w / 2, 0, 1.5],
];
function world([x, y, z]: Vec3): Vec3 {
  const a = (23 * Math.PI) / 180;
  return [
    1 + Math.cos(a) * x * 1.3 + Math.sin(a) * z * 0.9,
    y * 0.8,
    -0.5 - Math.sin(a) * x * 1.3 + Math.cos(a) * z * 0.9,
  ];
}
function targets() {
  return projectCameraLandmarks({
    viewport: { width: 800, height: 600 },
    camera: {
      translation: [7, 6, 9],
      lookAt: [0, 0, 0],
      near: 0.1,
      far: 100,
      ...(perspective
        ? { projection: "perspective", fovYDegrees: 35 }
        : { projection: "orthographic", orthographicHeight: 6 }),
    },
    landmarks: [...localCorners(4), [0, 3, 0] as Vec3].map((point, i) => ({
      name: String(i),
      world: world(point),
    })),
  }).landmarks.map((point) => point.pixel!);
}
function plan() {
  return {
    selection: (perspective ? [...names].reverse() : names).map((point) => ({
      subject: "base",
      point,
    })),
    fit: {
      parameters: {
        azimuthDegrees: "fixed",
        elevationDegrees: "fixed",
        distance: "fixed",
        panX: { min: -3, max: 3 },
        panY: { min: -3, max: 3 },
        ...(perspective
          ? { fovYDegrees: { min: 20, max: 65 } }
          : { orthographicHeight: { min: 4, max: 12 } }),
      },
      tolerancePixels: 0.05,
    },
  };
}
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "aperture-fit-local-"));
  configFile = path.join(root, "app.config.ts");
  planFile = path.join(root, "fit-plan.json");
  await writeFile(configFile, "export default {};\n");
  width = 4;
  upperHeight = 2;
  initialized = destroyed = 0;
  perspective = inconsistent = untargeted = cameraDependent = collapsed = false;
  applied = undefined;
  runners = [];
  cameraBefore = cameraAfter = undefined;
  await writeFile(planFile, JSON.stringify(plan()));
  class Scene extends createSystem() {
    override init(): void {
      initialized++;
      const eye = this.spawn.camera({
        key: "camera",
        ...(applied ?? {
          transform: { translation: [7, 6, 9], lookAt: [0, 0, 0] },
          camera: {
            ...(perspective
              ? { projection: "perspective" as const, fovYDegrees: 50 }
              : { projection: "orthographic" as const, orthographicHeight: 8 }),
            near: 0.1,
            far: 100,
          },
        }),
      });
      cameraBefore = {
        translation: Array.from(
          eye.getVectorView(LocalTransform, "translation"),
        ),
        height: eye.getValue(Camera, "orthographicHeight"),
        fov: eye.getValue(Camera, "fovYRadians"),
      };
      const parent = this.spawn.group({
        key: "assembly",
        transform: {
          translation: [1, 0, -0.5],
          rotationEulerDegrees: [0, 23, 0],
          scale: [1.3, 0.8, 0.9],
        },
      });
      const base = this.spawn.mesh({
        key: "base",
        mesh: mesh.box({ size: [width, 0.2, 3] }),
        material: material.standard(),
        transform: { parent, translation: [0, -0.1, 0] },
      });
      const upper = this.spawn.group({
        key: "upper",
        transform: { parent: cameraDependent ? eye : parent },
      });
      this.spawn.mesh({
        key: "upper-solid",
        mesh: mesh.box({ size: [0.5, upperHeight, 0.5] }),
        material: material.standard(),
        transform: { parent: upper, translation: [0, upperHeight / 2, 0] },
      });
      const target = targets();
      this.resources.set(Probe, {
        request: {
          camera: { key: "camera" },
          viewport: { width: 800, height: 600 },
          cameraJob: { referenceDistance: Math.hypot(7, 6, 9) },
          subjects: [
            {
              name: "base",
              entity: { index: base.index, generation: base.generation },
              points: localCorners(width).map(([x, , z], i) => ({
                name: names[i],
                local: collapsed ? [0, 0.1, 0] : [x, 0.1, z],
                ...(untargeted && i === 0
                  ? {}
                  : {
                      target: [
                        target[i]![0] + (inconsistent && i === 0 ? 12 : 0),
                        target[i]![1],
                      ],
                    }),
                ...(i === 1 ? { weight: 1 } : {}),
              })),
            },
            {
              name: "independent",
              entity: { index: upper.index, generation: upper.generation },
              points: [
                { name: "top", local: [0, upperHeight, 0], target: target[4] },
              ],
            },
          ],
        },
      });
    }
    override update(): void {
      throw Error("fit-local must not step simulation");
    }
    override destroy(): void {
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
      const ref = runner.entities.find({ key: "camera" }).summaries[0]!.entity;
      const eye = runner.app.lowLevel.world.entityManager.getEntityByIndex(
        ref.index,
      )!;
      cameraAfter = {
        translation: Array.from(
          eye.getVectorView(LocalTransform, "translation"),
        ),
        height: eye.getValue(Camera, "orthographicHeight"),
        fov: eye.getValue(Camera, "fovYRadians"),
      };
      return dispose(runner);
    },
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const runner of runners) await disposal.disposeHeadlessRunner(runner);
  await rm(root, { recursive: true, force: true });
});
async function run(extra: readonly string[] = [], cli = false) {
  let stdout = "",
    stderr = "";
  const argv = [
    "fit-local",
    configFile,
    "--request-resource",
    Probe.id,
    "--fit-plan",
    planFile,
    "--seed",
    "7",
    ...extra,
  ];
  const options = {
    argv,
    cwd: root,
    stdout: (s: string) => {
      expect(destroyed).toBe(initialized);
      stdout += s;
    },
    stderr: (s: string) => {
      stderr += s;
    },
  };
  const code = cli
    ? await runApertureCli({ ...options, argv: ["camera", ...argv] })
    : await runCameraCommand(options);
  return { code, stdout, stderr };
}
interface Report {
  ok: boolean;
  stage: string;
  cameraApplied: false;
  inspectionCamera: string;
  inspection: { ok: boolean; result: CameraLocalInspectionReport };
  job: CameraLocalJobSeed;
  result: ReturnType<typeof fitCameraLandmarks>;
}
const decode = (text: string) => JSON.parse(text) as Report;

describe("fresh local camera fitting", () => {
  it.each([false, true])(
    "matches manual selected fitting without edits or extra steps (perspective=%s)",
    async (p) => {
      perspective = p;
      await writeFile(planFile, JSON.stringify(plan()));
      const output = path.join(root, "report.json");
      const result = await run(["--out", output]);
      const report = decode(result.stdout);
      expect(result.code).toBe(0);
      expect(report.cameraApplied).toBe(false);
      expect(report.inspectionCamera).toBe("current-authored-camera");
      const seed = report.inspection.result.cameraJob!;
      const manualJob = {
        ...seed,
        landmarks: plan().selection.map(
          ({ subject, point: name }) =>
            seed.landmarks.find(
              (point) => point.name === JSON.stringify([subject, name]),
            )!,
        ),
        fit: plan().fit,
      };
      expect(report.job).toEqual(manualJob);
      expect(report.result).toEqual(fitCameraLandmarks(manualJob));
      expect(report.job.landmarks[0]).not.toHaveProperty("weight");
      expect(
        report.job.landmarks.find(
          (point) => point.name === JSON.stringify(["base", "back-right"]),
        )!.weight,
      ).toBe(1);
      expect(
        report.inspection.result.subjects[1]!.points[0]!.target,
      ).toBeDefined();
      expect(report.job.landmarks).toHaveLength(4);
      expect(cameraAfter).toEqual(cameraBefore);
      expect(initialized).toBe(1);
      expect(destroyed).toBe(1);
      expect(await readFile(output, "utf8")).toBe(result.stdout);
      for (const runner of runners) {
        expect(runner.step).not.toHaveBeenCalled();
        expect(runner.stepWithoutExtract).not.toHaveBeenCalled();
        expect(runner.extract).not.toHaveBeenCalled();
        expect(runner.app.step).not.toHaveBeenCalled();
        expect(runner.app.extract).not.toHaveBeenCalled();
      }
    },
  );
  it("retains independent shape error after explicit camera application and freshly measures source edits", async () => {
    const first = decode((await run()).stdout);
    applied = first.result.spawnCamera;
    const corrected = decode((await run()).stdout);
    const residual = (r: Report) => {
      const p = r.inspection.result.subjects[1]!.points[0]!;
      return Math.hypot(p.pixel![0] - p.target![0], p.pixel![1] - p.target![1]);
    };
    expect(residual(corrected)).toBeGreaterThan(10);
    upperHeight = 3;
    const dimensionFixed = decode((await run()).stdout);
    expect(residual(dimensionFixed)).toBeLessThan(0.05);
    const oldPath = path.join(root, "old.json");
    await writeFile(oldPath, JSON.stringify(dimensionFixed));
    const oldBytes = await readFile(oldPath);
    width = 5;
    const changed = decode((await run()).stdout);
    expect(changed.inspection.result.subjects[0]!.points[0]!.world).not.toEqual(
      dimensionFixed.inspection.result.subjects[0]!.points[0]!.world,
    );
    expect(await readFile(oldPath)).toEqual(oldBytes);
  });
  it("retains a converged but unaccepted fit without dropping an inconsistent target", async () => {
    inconsistent = true;
    const result = await run();
    const report = decode(result.stdout);
    expect(result.code).toBe(2);
    expect(report.stage).toBe("fit");
    expect(report.result.fit.converged).toBe(true);
    expect(report.result.fit.accepted).toBe(false);
    expect(report.job.landmarks).toHaveLength(4);
  });
  it("requires full export before filtering a camera-dependent nonselected point", async () => {
    cameraDependent = true;
    const result = await run();
    const report = decode(result.stdout);
    expect(result.code).toBe(2);
    expect(report.stage).toBe("export");
    expect(report.job).toBeNull();
    expect(report.result).toBeNull();
    expect(
      report.inspection.result.cameraJobDiagnostics.some((d) =>
        d.message.includes("descended"),
      ),
    ).toBe(true);
  });
  it("keeps typed invalid selection and initial-conditioning errors distinct from completed rejection", async () => {
    const old = path.join(root, "old.json");
    await writeFile(old, "unchanged");
    untargeted = true;
    await expect(run(["--out", old])).rejects.toMatchObject({
      code: "aperture.camera.invalidJob",
    });
    untargeted = false;
    collapsed = true;
    const result = await run(["--out", old], true);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("rank");
    expect(await readFile(old, "utf8")).toBe("unchanged");
    expect(destroyed).toBe(initialized);
  });
  it("rejects duplicate names, unknown selection, absent tolerance and target overlays", async () => {
    const original = plan();
    for (const value of [
      {
        ...original,
        selection: [...original.selection, original.selection[0]],
      },
      { ...original, targets: {} },
      { ...original, fit: { parameters: original.fit.parameters } },
      {
        ...original,
        selection: [{ subject: "base", point: "back-left", target: [0, 0] }],
      },
    ]) {
      await writeFile(planFile, JSON.stringify(value));
      await expect(run()).rejects.toMatchObject({
        code: "aperture.camera.invalidJob",
      });
    }
    expect(initialized).toBe(0);
    await writeFile(
      planFile,
      JSON.stringify({
        ...original,
        selection: [{ subject: "missing", point: "unknown" }],
      }),
    );
    await expect(run()).rejects.toMatchObject({
      code: "aperture.camera.invalidJob",
    });
    expect(initialized).toBe(1);
    expect(destroyed).toBe(1);
  });
  it("retains a missing resource failure and never falls back to an old valid report", async () => {
    const output = path.join(root, "report.json");
    await run(["--out", output]);
    let stdout = "";
    const code = await runCameraCommand({
      argv: [
        "fit-local",
        configFile,
        "--request-resource",
        "missing",
        "--fit-plan",
        planFile,
        "--seed",
        "7",
        "--out",
        output,
      ],
      cwd: root,
      stdout: (s) => {
        stdout += s;
      },
    });
    expect(code).toBe(2);
    const result = decode(stdout);
    expect(result.stage).toBe("inspection");
    expect(result.job).toBeNull();
    expect(result.result).toBeNull();
    expect(result.inspection.ok).toBe(false);
    expect(await readFile(output, "utf8")).toBe(stdout);
  });
  it("protects input aliases and safely replaces an unrelated output symlink", async () => {
    const alias = path.join(root, "alias");
    await symlink(root, alias, "dir");
    const planLink = path.join(root, "plan-link.json");
    await symlink(planFile, planLink);
    for (const out of [
      configFile,
      planFile,
      path.join(alias, "fit-plan.json"),
      path.join(alias, "app.config.ts"),
    ])
      await expect(run(["--out", out])).rejects.toMatchObject({
        code: "aperture.camera.usage",
      });
    await expect(
      runCameraCommand({
        argv: [
          "fit-local",
          configFile,
          "--request-resource",
          Probe.id,
          "--fit-plan",
          planLink,
          "--seed",
          "7",
          "--out",
          planFile,
        ],
        cwd: root,
        stdout: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "aperture.camera.usage" });
    expect(initialized).toBe(0);
    const other = path.join(root, "other.txt");
    await writeFile(other, "protected");
    const output = path.join(root, "out.json");
    await symlink(other, output);
    expect((await run(["--out", output])).code).toBe(0);
    expect(await readFile(other, "utf8")).toBe("protected");
  });
  it("rejects malformed and missing plan files before app initialization", async () => {
    const output = path.join(root, "old.json");
    await writeFile(output, "protected");
    await writeFile(planFile, "{bad json");
    await expect(run(["--out", output])).rejects.toMatchObject({
      code: "aperture.camera.invalidJson",
    });
    await rm(planFile);
    await expect(run(["--out", output])).rejects.toMatchObject({
      code: "aperture.camera.readFailed",
    });
    expect(initialized).toBe(0);
    expect(await readFile(output, "utf8")).toBe("protected");
  });
  it("preserves old output on bootstrap, disposal and write errors", async () => {
    const output = path.join(root, "old.json");
    await writeFile(output, "protected");
    vi.mocked(loader.loadApertureHeadlessApp).mockRejectedValueOnce(
      Error("load failed"),
    );
    await expect(run(["--out", output])).rejects.toThrow("load failed");
    const dispose = vi
      .mocked(disposal.disposeHeadlessRunner)
      .getMockImplementation()!;
    vi.mocked(disposal.disposeHeadlessRunner).mockImplementationOnce(
      async (runner) => {
        await dispose(runner);
        return [Error("dispose failed")];
      },
    );
    await expect(run(["--out", output])).rejects.toThrow("dispose failed");
    expect(await readFile(output, "utf8")).toBe("protected");
    const directory = path.join(root, "directory");
    await mkdir(directory);
    await expect(run(["--out", directory])).rejects.toMatchObject({
      code: "aperture.camera.writeFailed",
    });
    expect((await readdir(root)).filter((x) => x.endsWith(".tmp"))).toEqual([]);
  });
  it("requires explicit seed and rejects unsupported source routes before initialization", async () => {
    for (const args of [
      [],
      ["--request", "request.json"],
      ["--seed", "2.5"],
      ["--seed", "1", "--seed", "2"],
    ]) {
      await expect(
        runCameraCommand({
          argv: [
            "fit-local",
            configFile,
            "--request-resource",
            Probe.id,
            "--fit-plan",
            planFile,
            ...args,
          ],
          cwd: root,
          stdout: () => undefined,
        }),
      ).rejects.toMatchObject({ code: "aperture.camera.usage" });
    }
    expect(initialized).toBe(0);
  });
});
