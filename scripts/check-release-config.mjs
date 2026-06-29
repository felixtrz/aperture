import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const publishablePackages = [
  { dir: "packages/math", name: "@aperture-engine/math" },
  { dir: "packages/simulation", name: "@aperture-engine/simulation" },
  { dir: "packages/physics", name: "@aperture-engine/physics" },
  { dir: "packages/physics-rapier", name: "@aperture-engine/physics-rapier" },
  { dir: "packages/render", name: "@aperture-engine/render" },
  { dir: "packages/ui", name: "@aperture-engine/ui" },
  { dir: "packages/runtime", name: "@aperture-engine/runtime" },
  { dir: "packages/webgpu", name: "@aperture-engine/webgpu" },
  { dir: "packages/audio", name: "@aperture-engine/audio" },
  { dir: "packages/vite-plugin", name: "@aperture-engine/vite-plugin" },
  { dir: "packages/app", name: "@aperture-engine/app" },
  { dir: "packages/cli", name: "@aperture-engine/cli" },
  {
    dir: "packages/reference-assets",
    name: "@aperture-engine/reference-assets",
  },
];

const publishableNames = publishablePackages.map((pkg) => pkg.name);
const failures = [];

await checkPackageScripts();
await checkWorkflows();
await checkChangesetConfig();
await checkPublishReadinessRegression();

if (failures.length > 0) {
  console.error(`Release config check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Release config check passed.");

async function checkPackageScripts() {
  const packageJson = await readJson("package.json");
  const scripts = packageJson.scripts ?? {};

  expectScriptIncludes("check", scripts.check, "check:release-config");
  expectScriptIncludes("check", scripts.check, "check:publish");
  expectScriptIncludes(
    "publish:dry-run",
    scripts["publish:dry-run"],
    "reference-assets:build-payload",
  );
  expectScriptIncludes("release:dry-run", scripts["release:dry-run"], [
    "publish:dry-run",
  ]);
  expectScriptIncludes("release:publish", scripts["release:publish"], [
    "reference-assets:build-payload",
    "check:publish:pack",
    "changeset publish",
  ]);
  expectScriptIncludes("changeset", scripts.changeset, "changeset");
  expectScriptIncludes(
    "version-packages",
    scripts["version-packages"],
    "changeset version",
  );

  if (packageJson.devDependencies?.["@changesets/cli"] === undefined) {
    fail("package.json devDependencies must include @changesets/cli.");
  }
}

async function checkWorkflows() {
  const ci = await readText(".github/workflows/ci.yml");
  const release = await readText(".github/workflows/release.yml");

  expectTextIncludes("ci.yml", ci, [
    "pull_request:",
    "push:",
    "branches:",
    "main",
    "pnpm install --frozen-lockfile",
    "pnpm run check",
  ]);
  expectTextIncludes("release.yml", release, [
    "workflow_dispatch:",
    "tags:",
    '"v*"',
    "pnpm install --frozen-lockfile",
    "pnpm run release:dry-run",
    "pnpm run release:publish",
    "startsWith(github.ref, 'refs/tags/v')",
    "secrets.NPM_TOKEN",
  ]);
}

async function checkChangesetConfig() {
  const config = await readJson(".changeset/config.json");
  const fixedGroups = Array.isArray(config.fixed) ? config.fixed : [];
  const fixedNames = fixedGroups.flatMap((group) =>
    Array.isArray(group) ? group : [],
  );
  const ignored = Array.isArray(config.ignore) ? config.ignore : [];

  if (config.access !== "public") {
    fail(".changeset/config.json must set access to public.");
  }

  if (config.baseBranch !== "main") {
    fail(".changeset/config.json must use main as baseBranch.");
  }

  // AI-72: a real release must generate a changelog. Reject the `false` (no
  // changelog) setting and require a generator (a module string, or [module, opts]).
  const changelog = config.changelog;
  const changelogGenerator =
    typeof changelog === "string"
      ? changelog
      : Array.isArray(changelog) && typeof changelog[0] === "string"
        ? changelog[0]
        : null;

  if (!changelogGenerator) {
    fail(
      '.changeset/config.json must set changelog to a generator (e.g. "@changesets/cli/changelog") so releases produce a CHANGELOG; got ' +
        JSON.stringify(changelog),
    );
  }

  if (!sameMembers(fixedNames, publishableNames)) {
    fail(
      `.changeset/config.json fixed group must list exactly ${publishableNames.join(
        ", ",
      )}; got ${fixedNames.join(", ")}`,
    );
  }

  for (const name of ["@aperture-engine/workspace", "examples"]) {
    if (fixedNames.includes(name)) {
      fail(`.changeset/config.json fixed group must not include ${name}.`);
    }
  }

  for (const name of [
    ...publishableNames,
    "@aperture-engine/workspace",
    "examples",
  ]) {
    if (ignored.includes(name)) {
      fail(`.changeset/config.json ignore must not include ${name}.`);
    }
  }
}

async function checkPublishReadinessRegression() {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), "aperture-release-config-"),
  );

  try {
    await writeJson(path.join(fixtureRoot, "package.json"), {
      name: "@aperture-engine/workspace",
      version: "0.1.0",
      private: true,
      license: "MIT",
    });
    await writeFile(path.join(fixtureRoot, "LICENSE"), "MIT License\n", "utf8");

    for (const pkg of publishablePackages) {
      await writePackageFixture(fixtureRoot, pkg);
    }

    const regressedPackage = publishablePackages.find(
      (pkg) => pkg.dir === "packages/render",
    );

    if (regressedPackage === undefined) {
      fail("release-config regression fixture could not find packages/render.");
      return;
    }

    await writePackageFixture(fixtureRoot, regressedPackage, {
      private: true,
      version: "0.0.0",
    });

    const result = spawnSync(
      process.execPath,
      ["scripts/check-package-publish-readiness.mjs", "--root", fixtureRoot],
      {
        cwd: rootDir,
        encoding: "utf8",
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    if (result.status === 0) {
      fail("publish-readiness guard must fail for a regressed package.");
      return;
    }

    expectTextIncludes("publish-readiness regression output", output, [
      "packages/render/package.json must not set private:true",
      "packages/render/package.json version must match root 0.1.0, got 0.0.0",
    ]);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

async function writePackageFixture(fixtureRoot, pkg, overrides = {}) {
  const packageDir = path.join(fixtureRoot, pkg.dir);
  await mkdir(path.join(packageDir, "dist"), { recursive: true });
  await writeFile(path.join(packageDir, "LICENSE"), "MIT License\n", "utf8");
  await writeFile(path.join(packageDir, "dist/index.js"), "export {};\n");
  await writeFile(path.join(packageDir, "dist/index.d.ts"), "export {};\n");
  await writeJson(path.join(packageDir, "package.json"), {
    name: pkg.name,
    version: "0.1.0",
    license: "MIT",
    files: ["dist", "LICENSE"],
    publishConfig: { access: "public" },
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    ...overrides,
  });
}

function expectScriptIncludes(label, value, expected) {
  if (typeof value !== "string") {
    fail(`package.json scripts.${label} must exist.`);
    return;
  }

  expectTextIncludes(`package.json scripts.${label}`, value, expected);
}

function expectTextIncludes(label, value, expected) {
  const expectedValues = Array.isArray(expected) ? expected : [expected];

  for (const expectedValue of expectedValues) {
    if (!value.includes(expectedValue)) {
      fail(`${label} must include '${expectedValue}'.`);
    }
  }
}

function sameMembers(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual].sort().join("\n") === [...expected].sort().join("\n")
  );
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fail(message) {
  failures.push(message);
}
