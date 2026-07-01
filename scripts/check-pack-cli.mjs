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
const shouldRender = process.argv.includes("--render");

const internalPackages = [
  "@aperture-engine/math",
  "@aperture-engine/simulation",
  "@aperture-engine/render",
  "@aperture-engine/physics",
  "@aperture-engine/physics-rapier",
  "@aperture-engine/runtime",
  "@aperture-engine/webgpu",
  "@aperture-engine/audio",
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
        pnpm: { overrides },
      },
      null,
      2,
    )}\n`,
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

function runCli(args, cwd, env = {}) {
  run(
    "node",
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
