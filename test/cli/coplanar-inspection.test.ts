import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
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
import { inspectCoplanarMeshOverlaps } from "@aperture-engine/render";
import { coplanarFixture } from "../helpers/coplanar-overlap-fixture.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "aperture-coplanar-cli-"),
  );
  directories.push(directory);
  const { input, registry } = coplanarFixture();
  const bundle = createApertureSnapshotBundle({
    snapshot: input.snapshot,
    assets: registry,
  });
  const bundlePath = path.join(directory, "scene.bundle.json"),
    jobPath = path.join(directory, "job.json");
  await writeFile(bundlePath, JSON.stringify(bundle));
  await writeFile(
    jobPath,
    JSON.stringify({ bundle: "scene.bundle.json", scope: input.scope }),
  );
  return { directory, input, bundle, bundlePath, jobPath };
}
async function run(cwd: string, args: string[]) {
  const stdout: string[] = [],
    stderr: string[] = [];
  const code = await runApertureCli({
    cwd,
    argv: ["inspect", "coplanar", ...args],
    stdout: (s) => stdout.push(s),
    stderr: (s) => stderr.push(s),
  });
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}

it("decodes a strict public bundle and writes an informational report without touching inputs", async () => {
  const f = await setup();
  const before = await Promise.all([
    readFile(f.bundlePath, "utf8"),
    readFile(f.jobPath, "utf8"),
  ]);
  const result = await run(f.directory, ["job.json", "--out", "report.json"]);
  expect(result.code, result.stderr).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.coverage).toBe("complete");
  expect(report.findings).toEqual(
    inspectCoplanarMeshOverlaps(f.input).findings,
  );
  expect(report.findings.length).toBeGreaterThan(0);
  expect(await readFile(path.join(f.directory, "report.json"), "utf8")).toBe(
    result.stdout,
  );
  expect(
    await Promise.all([
      readFile(f.bundlePath, "utf8"),
      readFile(f.jobPath, "utf8"),
    ]),
  ).toEqual(before);
  expect(
    (await readdir(f.directory)).some((name) => name.endsWith(".tmp")),
  ).toBe(false);
});

it("does not turn exhausted work or incomplete asset closure into a clean report", async () => {
  const f = await setup();
  await writeFile(
    f.jobPath,
    JSON.stringify({
      bundle: "scene.bundle.json",
      scope: { all: true },
      limits: { maxTrianglePairs: 1 },
    }),
  );
  const capped = await run(f.directory, ["job.json"]);
  expect(capped.code, capped.stderr).toBe(0);
  expect(JSON.parse(capped.stdout)).toMatchObject({
    coverage: "partial",
    diagnostics: [{ code: "pair-limit" }],
  });
  await writeFile(
    f.bundlePath,
    JSON.stringify({
      ...f.bundle,
      assets: {
        ...f.bundle.assets,
        entries: f.bundle.assets.entries.filter(
          (entry) => entry.handle.kind !== "mesh",
        ),
      },
    }),
  );
  const missing = await run(f.directory, ["job.json"]);
  expect(missing.code, missing.stderr).toBe(0);
  expect(JSON.parse(missing.stdout).coverage).toBe("partial");
  expect(
    JSON.parse(missing.stdout).diagnostics.some(
      (d: { code: string }) => d.code === "bundle-preflight",
    ),
  ).toBe(true);
});

it("refuses overwriting the job or bundle including directory aliases", async () => {
  const f = await setup();
  const alias = path.join(f.directory, "alias");
  await symlink(f.directory, alias, "dir");
  for (const output of [
    "job.json",
    "scene.bundle.json",
    "alias/scene.bundle.json",
  ]) {
    const result = await run(f.directory, ["job.json", "--out", output]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Report path must differ");
  }
  expect(JSON.parse(await readFile(f.jobPath, "utf8")).bundle).toBe(
    "scene.bundle.json",
  );
  expect(JSON.parse(await readFile(f.bundlePath, "utf8")).format).toBe(
    "aperture.render-bundle",
  );
});

it("rejects absent scope, invalid limits, unknown options and malformed JSON", async () => {
  const f = await setup();
  for (const job of [
    { bundle: "scene.bundle.json" },
    { bundle: "scene.bundle.json", scope: {} },
    { bundle: "scene.bundle.json", scope: { all: true }, viewId: null },
    {
      bundle: "scene.bundle.json",
      scope: { all: true },
      limits: { maxTriangles: 0 },
    },
    {
      bundle: "scene.bundle.json",
      scope: { all: true },
      tolerances: { epsilon: 1 },
    },
    { bundle: "scene.bundle.json", scope: { all: true }, autoFix: true },
  ]) {
    await writeFile(f.jobPath, JSON.stringify(job));
    expect((await run(f.directory, ["job.json"])).code).toBe(1);
  }
  await writeFile(f.jobPath, "{");
  expect((await run(f.directory, ["job.json"])).stderr).toContain("readFailed");
  expect((await run(f.directory, ["--help"])).stdout).toContain(
    "visibility stays unknown",
  );
});
