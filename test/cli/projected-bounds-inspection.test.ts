import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
  readdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  createApertureSnapshotBundle,
  runApertureCli,
} from "@aperture-engine/cli";
import { inspectProjectedMeshBounds } from "@aperture-engine/render";
import { projectedBoundsFixture } from "../helpers/projected-bounds-fixture.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function setup() {
  const cwd = await mkdtemp(
    path.join(os.tmpdir(), "aperture-projected-bounds-"),
  );
  directories.push(cwd);
  const fixture = projectedBoundsFixture(true, true, true);
  const bundle = createApertureSnapshotBundle({
    snapshot: fixture.input.snapshot,
    assets: fixture.registry,
    options: { renderTarget: fixture.input.target },
  });
  const job = {
    bundle: "scene.bundle.json",
    viewId: 7,
    scope: fixture.input.scope,
  };
  await writeFile(path.join(cwd, "scene.bundle.json"), JSON.stringify(bundle));
  await writeFile(path.join(cwd, "job.json"), JSON.stringify(job));
  await writeFile(
    path.join(cwd, "aperture.config.ts"),
    'throw new Error("Offline inspection must not evaluate an app");',
  );
  return { cwd, fixture, bundle, job };
}
async function run(cwd: string, args = ["job.json"]) {
  const stdout: string[] = [],
    stderr: string[] = [];
  const code = await runApertureCli({
    cwd,
    argv: ["inspect", "projected-bounds", ...args],
    stdout: (s) => stdout.push(s),
    stderr: (s) => stderr.push(s),
  });
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}
it("projects modern embedded bundle data offline and matches the pure helper, without modifying inputs", async () => {
  const f = await setup();
  const before = await Promise.all(
    ["job.json", "scene.bundle.json"].map((p) =>
      readFile(path.join(f.cwd, p), "utf8"),
    ),
  );
  const result = await run(f.cwd, ["job.json", "--out", "report.json"]);
  expect(result.code, result.stderr).toBe(0);
  const report = JSON.parse(result.stdout),
    pure = inspectProjectedMeshBounds(f.fixture.input);
  expect(report).toEqual({
    ...pure,
    source: {
      bundle: path.join(f.cwd, "scene.bundle.json"),
      frame: f.bundle.frame,
    },
  });
  expect(report.target).toEqual({ width: 800, height: 600 });
  expect(report.coverage).toBe("complete");
  expect(await readFile(path.join(f.cwd, "report.json"), "utf8")).toBe(
    result.stdout,
  );
  expect(
    await Promise.all(
      ["job.json", "scene.bundle.json"].map((p) =>
        readFile(path.join(f.cwd, p), "utf8"),
      ),
    ),
  ).toEqual(before);
  expect((await readdir(f.cwd)).some((p) => p.endsWith(".tmp"))).toBe(false);
});
it("preserves partial exit-zero semantics and null aggregate for missing selected assets and limits", async () => {
  const f = await setup();
  await writeFile(
    path.join(f.cwd, "job.json"),
    JSON.stringify({ ...f.job, limits: { maxVertices: 2 } }),
  );
  const limited = await run(f.cwd);
  expect(limited.code).toBe(0);
  expect(JSON.parse(limited.stdout)).toMatchObject({
    coverage: "partial",
    bounds: null,
    diagnostics: [{ code: "vertex-limit" }],
  });
  await writeFile(path.join(f.cwd, "job.json"), JSON.stringify(f.job));
  await writeFile(
    path.join(f.cwd, "scene.bundle.json"),
    JSON.stringify({
      ...f.bundle,
      assets: {
        ...f.bundle.assets,
        entries: f.bundle.assets.entries.filter(
          (e) => e.handle.kind !== "mesh",
        ),
      },
    }),
  );
  const missing = await run(f.cwd);
  expect(missing.code).toBe(0);
  expect(JSON.parse(missing.stdout)).toMatchObject({
    coverage: "partial",
    bounds: null,
  });
  expect(
    JSON.parse(missing.stdout).diagnostics.some(
      (d: { code: string }) => d.code === "bundle-preflight",
    ),
  ).toBe(true);
});
it("rejects legacy target defaults, missing view, unknown fields and malformed jobs", async () => {
  const f = await setup();
  await writeFile(
    path.join(f.cwd, "scene.bundle.json"),
    JSON.stringify({
      format: "aperture-render-snapshot",
      version: 1,
      frame: f.bundle.frame,
      snapshot: f.bundle.snapshot.value,
      sourceAssets: { entries: f.bundle.assets.entries },
    }),
  );
  const legacy = await run(f.cwd);
  expect(legacy.code).toBe(1);
  expect(legacy.stderr).toMatch(/recorded target dimensions/);
  await writeFile(
    path.join(f.cwd, "scene.bundle.json"),
    JSON.stringify(f.bundle),
  );
  for (const job of [
    { bundle: f.job.bundle, scope: f.job.scope },
    { ...f.job, target: { width: 800, height: 600 } },
    { ...f.job, tolerances: {} },
    { ...f.job, limits: { maxTriangles: 5 } },
    { ...f.job, viewId: 999 },
  ]) {
    await writeFile(path.join(f.cwd, "job.json"), JSON.stringify(job));
    expect((await run(f.cwd)).code).toBe(1);
  }
  await writeFile(path.join(f.cwd, "job.json"), "{");
  expect((await run(f.cwd)).code).toBe(1);
  expect((await run(f.cwd, ["--help"])).stdout).toContain("0.05px");
});
it("protects input job/bundle against output aliases and leaves failed outputs unchanged", async () => {
  const f = await setup();
  await symlink(f.cwd, path.join(f.cwd, "alias"), "dir");
  for (const out of [
    "job.json",
    "scene.bundle.json",
    "alias/scene.bundle.json",
  ]) {
    const result = await run(f.cwd, ["job.json", "--out", out]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Report path must differ");
  }
  await writeFile(path.join(f.cwd, "sentinel.json"), "previous-report");
  await writeFile(
    path.join(f.cwd, "job.json"),
    JSON.stringify({ ...f.job, viewId: -1 }),
  );
  expect((await run(f.cwd, ["job.json", "--out", "sentinel.json"])).code).toBe(
    1,
  );
  expect(await readFile(path.join(f.cwd, "sentinel.json"), "utf8")).toBe(
    "previous-report",
  );
});
