#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const renderDawn = process.argv.includes("--render-dawn");
const shouldRender = process.argv.includes("--render") || renderDawn;

const internalPackages = [
  "@aperture-engine/math",
  "@aperture-engine/simulation",
  "@aperture-engine/particles",
  "@aperture-engine/render",
  "@aperture-engine/physics",
  "@aperture-engine/physics-rapier",
  "@aperture-engine/runtime",
  "@aperture-engine/shader",
  "@aperture-engine/gpu",
  "@aperture-engine/adapter-node",
  "@aperture-engine/webgpu",
  "@aperture-engine/audio",
  "@aperture-engine/ui",
  "@aperture-engine/vite-plugin",
  "@aperture-engine/app",
  "@aperture-engine/cli",
];

const tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-pack-cli-"));
const packDir = path.join(tempDir, "packs");
const installDir = path.join(tempDir, "install");
const failures = [];

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(installDir, { recursive: true });

  const tarballs = new Map();
  for (const packageName of internalPackages) {
    tarballs.set(packageName, packPackage(packageName));
  }

  inspectCliTarball(tarballs.get("@aperture-engine/cli"));
  if (failures.length === 0) {
    await writeInstallPackageJson(tarballs);
    run("pnpm", ["install", "--ignore-scripts"], installDir);
    runCli(["--help"], installDir);
    await runHeadlessSmoke();
    if (failures.length === 0) await runInspectionSmoke();
  }

  if (shouldRender && failures.length === 0) {
    await runRenderSmoke();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Packed CLI check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Packed CLI check passed${shouldRender ? " with render smoke" : ""}.`,
);

function packPackage(packageName) {
  const result = spawnSync(
    "pnpm",
    ["--filter", packageName, "pack", "--json", "--pack-destination", packDir],
    { cwd: rootDir, encoding: "utf8" },
  );

  if (result.status !== 0) {
    fail(`${packageName} pack failed: ${result.stderr || result.stdout}`);
    return "";
  }

  const report = parsePackReport(result.stdout, packageName);
  const filename = path.resolve(rootDir, report.filename);

  if (!filename.startsWith(packDir + path.sep)) {
    fail(`${packageName} pack wrote outside pack dir: ${filename}`);
  }

  return filename;
}

function inspectCliTarball(tarball) {
  if (tarball === undefined || tarball.length === 0) {
    return;
  }

  const listing = runCapture("tar", ["-tf", tarball], rootDir);
  const files = new Set(listing.trim().split(/\r?\n/u));
  const required = [
    "package/package.json",
    "package/dist/bin/aperture.js",
    "package/dist/render/driver.js",
    "package/assets/render-harness/render-harness.main.js",
  ];

  for (const filePath of required) {
    if (!files.has(filePath)) {
      fail(`CLI pack output must include ${filePath}.`);
    }
  }
}

async function writeInstallPackageJson(tarballs) {
  const cliTarball = tarballs.get("@aperture-engine/cli");
  const appTarball = tarballs.get("@aperture-engine/app");

  if (cliTarball === undefined || cliTarball.length === 0) {
    fail("CLI tarball was not produced.");
    return;
  }

  if (appTarball === undefined || appTarball.length === 0) {
    fail("App tarball was not produced.");
    return;
  }

  const overrides = Object.fromEntries(
    [...tarballs.entries()]
      .filter(([name]) => name !== "@aperture-engine/cli")
      .map(([name, tarball]) => [name, pathToFileURL(tarball).href]),
  );

  await writeFile(
    path.join(installDir, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          "@aperture-engine/app": pathToFileURL(appTarball).href,
          "@aperture-engine/cli": pathToFileURL(cliTarball).href,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(installDir, "pnpm-workspace.yaml"),
    `overrides:\n${Object.entries(overrides)
      .map(
        ([name, tarball]) =>
          `  ${JSON.stringify(name)}: ${JSON.stringify(tarball)}`,
      )
      .join("\n")}\n`,
    "utf8",
  );
}

async function runHeadlessSmoke() {
  const appDir = path.join(installDir, "headless-app");
  await cp(path.join(rootDir, "test/fixtures/headless-procedural"), appDir, {
    recursive: true,
  });

  const out = path.join(installDir, "headless.bundle.json");
  runCli(
    [
      "headless",
      path.join(appDir, "aperture.headless.config.ts"),
      "--root",
      appDir,
      "--out",
      out,
      "--frames",
      "1",
    ],
    installDir,
  );

  if (failures.length > 0) {
    return;
  }

  let bundle;
  try {
    bundle = JSON.parse(await readFile(out, "utf8"));
  } catch (error) {
    fail(
      `Packed CLI headless smoke did not write a readable bundle: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }

  if (bundle.format !== "aperture.render-bundle") {
    fail("Packed CLI headless smoke did not write a render bundle.");
  }
  if (bundle.closure?.missing?.length !== 0) {
    fail("Packed CLI headless smoke wrote a bundle with missing assets.");
  }
  if (bundle.snapshot?.codec !== "json-typed-array-v1") {
    fail(
      "Packed CLI headless smoke wrote a bundle without snapshot codec metadata.",
    );
  }
  if (!Array.isArray(bundle.assets?.entries)) {
    fail("Packed CLI headless smoke wrote a bundle without asset entries.");
  }
}

async function runRenderSmoke() {
  const bundle = path.join(installDir, "headless.bundle.json");
  const out = path.join(installDir, "frame.png");
  // Render headed (the default). `aperture render` auto-provisions an Xvfb
  // virtual display on a GPU-less Linux host, so the browser composites real
  // WebGPU pixels. Forcing APERTURE_RENDER_HEADLESS=1 here would produce an
  // all-white frame that the (now uniformity-aware) blank guard rejects — the
  // smoke must exercise the same path real users get. Omitting --allow-blank
  // makes the command fail if the frame comes back blank.
  runCli(
    [
      "render",
      bundle,
      "--backend",
      renderDawn ? "dawn" : "browser",
      "--out",
      out,
      "--width",
      "64",
      "--height",
      "64",
      "--allow-placeholders",
    ],
    installDir,
  );
}

async function runInspectionSmoke() {
  const appDir = path.join(installDir, "inspection-app");
  await cp(path.join(rootDir, "test/fixtures/headless-procedural"), appDir, {
    recursive: true,
  });
  await writeFile(
    path.join(appDir, "src/systems/scene.system.ts"),
    `import { createSystem, mesh, material, LocalTransform } from "@aperture-engine/app/systems";
export default class InspectionSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", fovYDegrees: 60,
      transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] } });
    const root = this.spawn.group({ key: "assembly",
      transform: { translation: [1, 0, 0] } });
    const request = { viewport: { width: 800, height: 600 }, subjects: [{
      name: "assembly", entity: { index: root.index, generation: root.generation },
      points: [{ name: "anchor", local: [-1, 0, 0] as const, target: [400, 300] as const }]
    }], cameraJob: { referenceDistance: 5 } };
    const first = this.cameras.main.inspectLocal(request);
    if (!first.ok || !first.result.cameraJob) throw new Error("Installed local inspection/export failed");
    const initial = first.result.subjects[0]!.points[0]!;
    if (!initial.pixel || Math.hypot(initial.pixel[0] - 400, initial.pixel[1] - 300) > 0.001)
      throw new Error("Installed local inspection projected the wrong point");
    root.getVectorView(LocalTransform, "translation")[0] = 2;
    const second = this.cameras.main.inspectLocal(request);
    if (!second.ok || second.result.subjects[0]!.points[0]!.world[0] !== 1 || initial.world[0] !== 0)
      throw new Error("Local inspection reused stale state or mutated its earlier report");
    for (const x of [0, 0.5]) this.spawn.mesh({
      mesh: mesh.plane({ size: [2, 2] }), material: material.standard(),
      transform: { translation: [x, 0, 0] }
    });
  }
}
`,
  );
  const bundlePath = path.join(installDir, "inspection.bundle.json");
  runCli(
    [
      "headless",
      path.join(appDir, "aperture.headless.config.ts"),
      "--root",
      appDir,
      "--out",
      bundlePath,
      "--asset-mode",
      "strict",
      "--render-width",
      "800",
      "--render-height",
      "600",
    ],
    installDir,
  );
  if (failures.length > 0) return;
  const job = path.join(installDir, "inspection-job.json");
  const output = path.join(installDir, "inspection-report.json");
  await writeFile(
    job,
    JSON.stringify({ bundle: "inspection.bundle.json", scope: { all: true } }),
  );
  const bundleBefore = await readFile(bundlePath, "utf8");
  const jobBefore = await readFile(job, "utf8");
  runCli(["inspect", "coplanar", job, "--out", output], installDir);
  if (failures.length > 0) return;
  const report = JSON.parse(await readFile(output, "utf8"));
  const area = report.findings.reduce((sum, finding) => sum + finding.area, 0);
  if (
    report.coverage !== "complete" ||
    report.counts.inspectedDraws !== 2 ||
    !Number.isFinite(area) ||
    Math.abs(area - 3) > 1e-6
  )
    fail(
      "Packed coplanar inspector did not recover the analytic panel overlap.",
    );
  if (
    (await readFile(bundlePath, "utf8")) !== bundleBefore ||
    (await readFile(job, "utf8")) !== jobBefore
  )
    fail("Packed inspection modified its inputs.");
  if (failures.length > 0) return;

  const bundle = JSON.parse(bundleBefore);
  const views = bundle.snapshot?.value?.views;
  const sourceDraws = bundle.snapshot?.value?.meshDraws;
  if (
    bundle.format !== "aperture.render-bundle" ||
    bundle.version !== 1 ||
    bundle.renderTarget?.width !== 800 ||
    bundle.renderTarget?.height !== 600 ||
    !Array.isArray(views) ||
    views.length !== 1 ||
    !Number.isSafeInteger(views[0]?.viewId) ||
    !Array.isArray(sourceDraws) ||
    sourceDraws.length !== 2
  ) {
    fail(
      "Packed projected-bounds fixture lacks its explicit retained view/target/draws.",
    );
    return;
  }
  const viewId = views[0].viewId;
  const projectedJob = path.join(installDir, "inspection-projected-job.json");
  const projectedOutput = path.join(
    installDir,
    "inspection-projected-report.json",
  );
  const projectedJobBefore = JSON.stringify({
    bundle: "inspection.bundle.json",
    viewId,
    scope: { all: true },
  });
  await writeFile(projectedJob, projectedJobBefore);
  runCli(
    ["inspect", "projected-bounds", projectedJob, "--out", projectedOutput],
    installDir,
  );
  if (failures.length > 0) return;
  const projected = JSON.parse(await readFile(projectedOutput, "utf8"));
  if (
    projected.schema !== "aperture.projected-bounds.v1" ||
    projected.coverage !== "complete" ||
    projected.bounds === null ||
    projected.visibility !== "unknown" ||
    projected.viewId !== viewId ||
    projected.target?.width !== 800 ||
    projected.target?.height !== 600 ||
    projected.source?.bundle !== bundlePath ||
    projected.source?.frame !== bundle.frame ||
    projected.counts?.matchedDraws !== 2 ||
    projected.counts?.layerExcludedDraws !== 0 ||
    projected.counts?.selectedDraws !== 2 ||
    projected.counts?.inspectedDraws !== 2 ||
    projected.counts?.attemptedReferences !== 12 ||
    projected.counts?.projectedReferences !== 12 ||
    !Array.isArray(projected.diagnostics) ||
    projected.diagnostics.length !== 0 ||
    !Array.isArray(projected.draws) ||
    projected.draws.length !== 2
  ) {
    fail(
      "Packed projected-bounds inspector did not produce complete retained-view evidence.",
    );
    return;
  }

  // The fixture's unrotated planes are XY, z=0, with corners [±1,±1,0].
  // At camera z=5 and vertical FOV60, pixel/world = (600/2)*cot(30°)/5.
  // This scalar oracle uses authored geometry, not decoded matrices/positions.
  const scale = 60 * Math.sqrt(3);
  const near = (actual, expected) =>
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= 0.001;
  const nearVector = (actual, expected) =>
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((n, i) => near(n, expected[i]));
  const expectedDraws = [...sourceDraws].sort(
    (a, b) =>
      a.entity.index - b.entity.index ||
      a.entity.generation - b.entity.generation,
  );
  const sameIdentity = (actual, expected) =>
    actual?.renderId === expected.renderId &&
    actual.entity?.index === expected.entity.index &&
    actual.entity?.generation === expected.entity.generation &&
    actual.meshId === expected.mesh.id &&
    actual.materialId === expected.material.id &&
    actual.submesh === expected.submesh;
  const expectedWitnesses = [
    ["minX", 0, 0, [-1, -1, 0]],
    ["minY", 2, 2, [1, 1, 0]],
    ["maxX", 1, 1, [1, -1, 0]],
    ["maxY", 0, 0, [-1, -1, 0]],
  ];
  const witnessMatches = (witness, draw, centerX, offset, index, local) => {
    const world = [local[0] + centerX, local[1], 0];
    return (
      sameIdentity(witness, draw) &&
      witness.offset === offset &&
      witness.vertexIndex === index &&
      nearVector(witness.local, local) &&
      nearVector(witness.world, world) &&
      nearVector(witness.pixel, [
        400 + world[0] * scale,
        300 - world[1] * scale,
      ])
    );
  };
  if (
    !nearVector(projected.bounds?.min, [400 - scale, 300 - scale]) ||
    !nearVector(projected.bounds?.max, [400 + 1.5 * scale, 300 + scale]) ||
    projected.draws.some((draw, i) => {
      // Source spawn order is x=0 then x=.5; the fresh fixture deletes no entity.
      const centerX = i * 0.5;
      return (
        !sameIdentity(draw, expectedDraws[i]) ||
        draw.coverage !== "complete" ||
        draw.range?.unit !== "index" ||
        draw.range.start !== 0 ||
        draw.range.count !== 6 ||
        draw.projectedReferences !== 6 ||
        draw.outsideViewportReferences !== 0 ||
        draw.beyondFarReferences !== 0 ||
        !nearVector(draw.bounds?.min, [
          400 + (centerX - 1) * scale,
          300 - scale,
        ]) ||
        !nearVector(draw.bounds?.max, [
          400 + (centerX + 1) * scale,
          300 + scale,
        ]) ||
        expectedWitnesses.some(
          ([name, offset, index, local]) =>
            !witnessMatches(
              draw.bounds?.witnesses?.[name],
              expectedDraws[i],
              centerX,
              offset,
              index,
              local,
            ),
        )
      );
    }) ||
    expectedWitnesses.some(([name, offset, index, local]) => {
      const i = name === "maxX" ? 1 : 0;
      return !witnessMatches(
        projected.bounds?.witnesses?.[name],
        expectedDraws[i],
        i * 0.5,
        offset,
        index,
        local,
      );
    })
  )
    fail(
      "Packed projected-bounds inspector disagrees with analytic plane pixels or source witnesses.",
    );
  if (
    (await readFile(bundlePath, "utf8")) !== bundleBefore ||
    (await readFile(job, "utf8")) !== jobBefore ||
    (await readFile(projectedJob, "utf8")) !== projectedJobBefore
  )
    fail("Packed projected-bounds inspection modified its bundle or jobs.");
}

function runCli(args, cwd, env = {}) {
  run(
    process.execPath,
    [
      path.join(
        installDir,
        "node_modules/@aperture-engine/cli/dist/bin/aperture.js",
      ),
      ...args,
    ],
    cwd,
    env,
  );
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    fail(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }

  return result;
}

function runCapture(command, args, cwd) {
  const result = run(command, args, cwd);
  return result.stdout;
}

function parsePackReport(stdout, packageName) {
  const trimmed = stdout.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    fail(`${packageName} pnpm pack produced invalid JSON: ${error.message}`);
    return { filename: "" };
  }
}

function fail(message) {
  failures.push(message);
}
