import {
  cp,
  mkdir,
  readFile,
  readdir,
  chmod,
  realpath,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { sha256, writeImmutable } from "./recorder.mjs";
import { verifyLifecycle } from "./run.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packages = [
  "math",
  "simulation",
  "physics",
  "physics-rapier",
  "particles",
  "render",
  "runtime",
  "ui",
  "webgpu",
  "audio",
  "vite-plugin",
  "app",
];

export async function inventory(root) {
  const files = {};
  async function visit(directory) {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Frozen fixture inputs cannot contain symlinks");
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        files[relative(root, path).split(sep).join("/")] = {
          bytes: bytes.length,
          sha256: sha256(bytes),
        };
      } else throw new Error("Frozen fixture inputs must be regular files");
    }
  }
  await visit(root);
  return files;
}

export async function seal(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) await seal(path);
    else await chmod(path, 0o444);
  }
  await chmod(root, 0o555);
}

export async function prepareManualControl(outputRoot) {
  if (!isAbsolute(outputRoot))
    throw new Error("Fixture output must be absolute");
  const lifecycle = await verifyLifecycle();
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  const fixture = resolve(repo, "test/fixtures/manual-browser-control"),
    source = resolve(outputRoot, "source"),
    sdk = resolve(outputRoot, "sdk"),
    dist = resolve(outputRoot, "dist"),
    harness = resolve(outputRoot, "harness");
  const originalFixture = await inventory(fixture);
  await cp(fixture, source, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await mkdir(sdk);
  await mkdir(harness);
  const aliases = [],
    externalPackages = {},
    types = {},
    packageInputs = {};
  for (const name of packages) {
    const original = resolve(repo, "packages", name),
      copied = resolve(sdk, name);
    await mkdir(copied);
    for (const part of ["package.json", "dist", "src"])
      await cp(resolve(original, part), resolve(copied, part), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    const descriptor = JSON.parse(
      await readFile(resolve(copied, "package.json"), "utf8"),
    );
    for (const [dependency, range] of Object.entries(
      descriptor.dependencies ?? {},
    )) {
      if (range.startsWith("workspace:") || externalPackages[dependency])
        continue;
      const dependencyRoot = await realpath(
        resolve(original, "node_modules", dependency),
      );
      aliases.push({ find: dependency, replacement: dependencyRoot });
      const metadata = await readFile(resolve(dependencyRoot, "package.json"));
      externalPackages[dependency] = {
        root: dependencyRoot,
        version: JSON.parse(metadata).version,
        packageJsonSha256: sha256(metadata),
      };
    }
    for (const [entry, exports] of Object.entries(descriptor.exports)) {
      if (typeof exports !== "object" || !exports.import) continue;
      const id = descriptor.name + (entry === "." ? "" : entry.slice(1));
      aliases.push({ find: id, replacement: resolve(copied, exports.import) });
      if (exports.types) types[id] = [resolve(copied, exports.types)];
    }
    packageInputs[descriptor.name] = {
      version: descriptor.version,
      files: await inventory(copied),
    };
  }
  aliases.sort((a, b) => b.find.length - a.find.length);
  const harnessNames = [
    "manual-control-run.mjs",
    "prepare-native-manual-control.mjs",
    "native-observer.mjs",
    "recorder.mjs",
    "run.mjs",
    "contract.mjs",
  ];
  for (const name of harnessNames)
    await cp(
      resolve(repo, "tools/agent-benchmark", name),
      resolve(harness, name),
      { errorOnExist: true, force: false },
    );
  const usedModules = new Set();
  await build({
    configFile: false,
    root: source,
    logLevel: "silent",
    resolve: { alias: aliases },
    worker: {
      format: "es",
      plugins: () => [
        {
          name: "retain-worker-inputs",
          moduleParsed(module) {
            usedModules.add(module.id);
          },
        },
      ],
    },
    plugins: [
      {
        name: "retain-main-inputs",
        moduleParsed(module) {
          usedModules.add(module.id);
        },
      },
    ],
    build: {
      outDir: dist,
      emptyOutDir: false,
      target: "es2022",
      sourcemap: true,
    },
  });
  const resolvedInputs = {};
  const resolvedCopies = resolve(outputRoot, "resolved-inputs");
  await mkdir(resolvedCopies);
  for (const id of [...usedModules].sort()) {
    if (!isAbsolute(id) || id.includes("?")) continue;
    const bytes = await readFile(id),
      hash = sha256(bytes),
      file = `${hash}.source`;
    if (!Object.values(resolvedInputs).some((entry) => entry.copy === file))
      await writeImmutable(resolve(resolvedCopies, file), bytes);
    resolvedInputs[id] = { bytes: bytes.length, sha256: hash, copy: file };
  }
  if (
    JSON.stringify(await inventory(source)) !== JSON.stringify(originalFixture)
  )
    throw new Error("Fixture source changed during CPU build");
  await writeImmutable(
    resolve(outputRoot, "fixture-tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          lib: ["ES2022", "DOM"],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          paths: types,
        },
        include: ["source/*.ts"],
      },
      null,
      2,
    ) + "\n",
  );
  const provenance = {
    schema: "aperture.native-manual-browser-control.inputs.v1",
    preparedAt: new Date().toISOString(),
    scope:
      "Native diagnostic validation only; no benchmark score or author evidence",
    lifecycleRun: lifecycle.run,
    engineInputKind:
      "Fresh copies of current public compiled packages and corresponding source",
    source: originalFixture,
    packages: packageInputs,
    externalPackages,
    resolvedInputs,
    harness: await inventory(harness),
    build: await inventory(dist),
    viewport: { width: 640, height: 480 },
    variants: ["transferable", "shared-array-buffer"],
    transportSelection:
      "Same scene bytes: nonisolated auto transport versus COOP/COEP isolated auto transport; actual transport must match",
  };
  await writeImmutable(
    resolve(outputRoot, "provenance.json"),
    JSON.stringify(provenance, null, 2) + "\n",
  );
  await seal(outputRoot);
  return {
    outputRoot,
    source,
    dist,
    copiedPackages: packages.length,
    resolvedModules: Object.keys(resolvedInputs).length,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(await prepareManualControl(process.argv[2])));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
