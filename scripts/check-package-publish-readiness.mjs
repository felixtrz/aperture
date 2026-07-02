import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const failures = [];
const options = parseArgs(process.argv.slice(2));
const rootDir = options.rootDir;
const shouldPack = options.shouldPack;

// The CLI is a scaffolding generator: its emitted dist embeds `import ... from
// "@aperture-engine/*"` lines as TEMPLATE STRINGS written into the projects it
// generates, not as its own runtime imports (it declares zero @aperture deps by
// design). Static regex can't tell a real import from a string-literal one, so
// the generator is exempt from the emitted-import resolution check.
const EMITTED_IMPORT_CHECK_SKIP = new Set(["packages/cli"]);

const publishablePackages = [
  "packages/math",
  "packages/simulation",
  "packages/physics",
  "packages/physics-rapier",
  "packages/particles",
  "packages/render",
  "packages/ui",
  "packages/runtime",
  "packages/webgpu",
  "packages/audio",
  "packages/vite-plugin",
  "packages/app",
  "packages/cli",
  "packages/reference-assets",
];

const ASSET_ONLY_PACKAGES = new Set(["packages/reference-assets"]);

const rootPackage = await readJson(path.join(rootDir, "package.json"));
const rootLicense = await readText(path.join(rootDir, "LICENSE"));
const expectedVersion = rootPackage.version;
const expectedLicense = rootPackage.license;

if (!isSemver(expectedVersion) || expectedVersion === "0.0.0") {
  fail(
    `root package version must be a publishable semver, got ${expectedVersion}`,
  );
}

if (expectedLicense !== "MIT") {
  fail(`root package license must be MIT, got ${expectedLicense}`);
}

if (!rootPackage.private) {
  fail("workspace root must remain private:true");
}

if (!rootLicense.includes("MIT License")) {
  fail("root LICENSE must contain the MIT license text");
}

for (const packageDir of publishablePackages) {
  await checkPackage(packageDir);
}

if (shouldPack) {
  await checkPacks();
}

if (failures.length > 0) {
  console.error(
    `Package publish-readiness check failed:\n- ${failures.join("\n- ")}`,
  );
  process.exit(1);
}

console.log(
  `Package publish-readiness check passed for ${publishablePackages.length} packages${shouldPack ? " with pack inspection" : ""}.`,
);

async function checkPackage(packageDir) {
  const absoluteDir = path.join(rootDir, packageDir);
  const packageJsonPath = path.join(absoluteDir, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (packageJson.private === true) {
    fail(`${packageDir}/package.json must not set private:true`);
  }

  if (packageJson.version !== expectedVersion) {
    fail(
      `${packageDir}/package.json version must match root ${expectedVersion}, got ${packageJson.version}`,
    );
  }

  if (packageJson.license !== expectedLicense) {
    fail(
      `${packageDir}/package.json license must match root ${expectedLicense}, got ${packageJson.license}`,
    );
  }

  if (!Array.isArray(packageJson.files)) {
    fail(`${packageDir}/package.json must declare a files array`);
  } else {
    for (const required of ["dist", "LICENSE"]) {
      if (!packageJson.files.includes(required)) {
        fail(`${packageDir}/package.json files must include ${required}`);
      }
    }
  }

  if (packageJson.publishConfig?.access !== "public") {
    fail(`${packageDir}/package.json publishConfig.access must be public`);
  }

  await assertFileExists(
    path.join(absoluteDir, "LICENSE"),
    `${packageDir}/LICENSE`,
  );
  if (!ASSET_ONLY_PACKAGES.has(packageDir)) {
    await assertFileExists(
      path.join(absoluteDir, "dist/index.js"),
      `${packageDir}/dist/index.js`,
    );
    await assertFileExists(
      path.join(absoluteDir, "dist/index.d.ts"),
      `${packageDir}/dist/index.d.ts`,
    );
  }

  checkWorkspaceDependencySpecs(
    packageDir,
    packageJson.dependencies,
    "dependencies",
  );
  checkWorkspaceDependencySpecs(
    packageDir,
    packageJson.peerDependencies,
    "peerDependencies",
  );

  if (!ASSET_ONLY_PACKAGES.has(packageDir)) {
    if (packageJson.exports?.["./package.json"] !== "./package.json") {
      fail(
        `${packageDir}/package.json exports must include "./package.json": "./package.json"`,
      );
    }

    for (const [field, value] of [
      ["main", packageJson.main],
      ["types", packageJson.types],
    ]) {
      if (typeof value !== "string") {
        fail(`${packageDir}/package.json ${field} must be a string`);
      } else {
        await checkPackagePath(packageDir, absoluteDir, value, field);
      }
    }

    for (const target of exportTargets(packageJson.exports)) {
      await checkPackagePath(
        packageDir,
        absoluteDir,
        target.path,
        target.label,
      );
    }
  }

  await checkEmittedDependencyImports(packageDir, absoluteDir, packageJson);
}

/**
 * Every `@aperture-engine/*` package that the EMITTED dist actually imports must
 * be a declared dependency (or peer, or the package itself). Without this, a
 * subpath that re-exports a sibling — e.g. `@aperture-engine/app/vite` re-exporting
 * `@aperture-engine/vite-plugin` — passes the spec/target checks yet throws
 * ERR_MODULE_NOT_FOUND on a clean external install. Scans `dist/**\/*.js` for
 * `from "@aperture-engine/X..."` / `import("@aperture-engine/X...")` statements.
 */
async function checkEmittedDependencyImports(
  packageDir,
  absoluteDir,
  packageJson,
) {
  if (EMITTED_IMPORT_CHECK_SKIP.has(packageDir)) {
    return;
  }
  const declared = new Set([
    packageJson.name,
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
  const importPattern =
    /(?:from\s*|import\(\s*)["'](@aperture-engine\/[a-z0-9-]+)(?:\/[^"']*)?["']/g;
  const referenced = new Set();

  for (const file of await collectJsFiles(path.join(absoluteDir, "dist"))) {
    const code = await readText(file);
    let match;
    while ((match = importPattern.exec(code)) !== null) {
      referenced.add(match[1]);
    }
  }

  for (const name of referenced) {
    if (!declared.has(name)) {
      fail(
        `${packageDir} emitted dist imports ${name} but it is not a declared dependency — an external install would fail to resolve it`,
      );
    }
  }
}

async function collectJsFiles(dir) {
  const out = [];
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...(await collectJsFiles(full)));
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }

  return out;
}

async function checkPacks() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-pack-"));

  try {
    for (const packageDir of publishablePackages) {
      const packageJson = await readJson(
        path.join(rootDir, packageDir, "package.json"),
      );
      const pack = spawnSync(
        "pnpm",
        [
          "--filter",
          packageJson.name,
          "pack",
          "--json",
          "--pack-destination",
          tempDir,
        ],
        {
          cwd: rootDir,
          encoding: "utf8",
        },
      );

      if (pack.status !== 0) {
        fail(`${packageDir} pnpm pack failed: ${pack.stderr || pack.stdout}`);
        continue;
      }

      const report = parsePackReport(pack.stdout, packageDir);
      const filePaths = new Set(report.files.map((file) => file.path));

      for (const required of packRequiredFiles(packageDir)) {
        if (!filePaths.has(required)) {
          fail(`${packageDir} pack output must include ${required}`);
        }
      }

      for (const filePath of filePaths) {
        if (filePath.startsWith("src/") || filePath.startsWith("test/")) {
          fail(`${packageDir} pack output must not include ${filePath}`);
        }
      }

      const packedPackageJson = JSON.parse(
        spawnTar(["-xOf", report.filename, "package/package.json"], packageDir),
      );

      for (const [sectionName, section] of [
        ["dependencies", packedPackageJson.dependencies],
        ["peerDependencies", packedPackageJson.peerDependencies],
      ]) {
        for (const [name, spec] of Object.entries(section ?? {})) {
          if (
            name.startsWith("@aperture-engine/") &&
            spec.startsWith("workspace:")
          ) {
            fail(
              `${packageDir} packed ${sectionName}.${name} leaked workspace spec ${spec}`,
            );
          }
        }
      }
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function packRequiredFiles(packageDir) {
  if (ASSET_ONLY_PACKAGES.has(packageDir)) {
    return [
      "package.json",
      "LICENSE",
      "README.md",
      "dist/manifest.json",
      "dist/data.tgz",
    ];
  }

  return ["package.json", "LICENSE", "dist/index.js"];
}

function checkWorkspaceDependencySpecs(packageDir, dependencies, sectionName) {
  for (const [name, spec] of Object.entries(dependencies ?? {})) {
    if (!name.startsWith("@aperture-engine/")) {
      continue;
    }

    if (spec !== "workspace:^") {
      fail(
        `${packageDir}/package.json ${sectionName}.${name} must use workspace:^ before publish conversion, got ${spec}`,
      );
    }
  }
}

async function checkPackagePath(packageDir, absoluteDir, packagePath, label) {
  // The standard `"./package.json": "./package.json"` self-export lets
  // consumers and tooling resolve package metadata; it is the one export
  // allowed to point outside ./dist.
  if (packagePath === "./package.json") {
    return;
  }

  if (!packagePath.startsWith("./dist/")) {
    fail(
      `${packageDir}/package.json ${label} must point into ./dist, got ${packagePath}`,
    );
    return;
  }

  await assertFileExists(
    path.join(absoluteDir, packagePath.slice(2)),
    `${packageDir}/${packagePath.slice(2)}`,
  );
}

function exportTargets(exportsValue, label = "exports") {
  if (typeof exportsValue === "string") {
    return [{ label, path: exportsValue }];
  }

  if (exportsValue === null || typeof exportsValue !== "object") {
    return [];
  }

  const targets = [];

  for (const [key, value] of Object.entries(exportsValue)) {
    targets.push(...exportTargets(value, `${label}.${key}`));
  }

  return targets;
}

function parsePackReport(stdout, packageDir) {
  const trimmed = stdout.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const jsonStart = trimmed.lastIndexOf("\n{");

    if (jsonStart >= 0) {
      try {
        return JSON.parse(trimmed.slice(jsonStart + 1));
      } catch {
        // Fall through to the original parser error below.
      }
    }

    fail(`${packageDir} pnpm pack produced invalid JSON: ${error.message}`);
    return { files: [], filename: "" };
  }
}

function spawnTar(args, packageDir) {
  const result = spawnSync("tar", args, {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail(
      `${packageDir} tar inspection failed: ${result.stderr || result.stdout}`,
    );
    return "{}";
  }

  return result.stdout;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function assertFileExists(filePath, label) {
  try {
    await readFile(filePath);
  } catch {
    fail(`${label} must exist`);
  }
}

function isSemver(value) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(
    String(value),
  );
}

function fail(message) {
  failures.push(message);
}

function parseArgs(args) {
  let rootDir = defaultRootDir;
  let shouldPack = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--pack") {
      shouldPack = true;
      continue;
    }

    if (arg === "--root") {
      index += 1;
      const value = args[index];

      if (value === undefined || value.length === 0) {
        throw new Error("--root requires a directory path.");
      }

      rootDir = path.resolve(value);
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return { rootDir, shouldPack };
}
