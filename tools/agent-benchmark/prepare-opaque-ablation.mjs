import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  readlink,
  chmod,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, writeImmutable } from "./recorder.mjs";

const exec = promisify(execFile);
const opaqueDiscard =
  "  if ((material.featureFlags & STANDARD_FEATURE_ALPHA_MASK) != 0u && alpha < material.alphaCutoff) {\n    discard;\n  }";

export function removeKnownOpaqueDiscard(source) {
  if (source.split(opaqueDiscard).length !== 2)
    throw new Error(
      "Expected exactly one stock StandardMaterial alpha-mask discard block",
    );
  return source.replace(
    opaqueDiscard,
    "  // Diagnostic-only: this frozen house uses exclusively opaque StandardMaterials.",
  );
}

async function inventory(root, includeSymlinks = false, excludedRoots = []) {
  const files = {};
  const canonicalRoot = await realpath(root);
  async function visit(path) {
    for (const item of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const current = resolve(path, item.name),
        key = relative(root, current).split(sep).join("/");
      if (
        excludedRoots.some(
          (excluded) => key === excluded || key.startsWith(excluded + "/"),
        )
      )
        continue;
      if (item.isSymbolicLink()) {
        if (
          !includeSymlinks ||
          !(await realpath(current)).startsWith(canonicalRoot + sep)
        )
          throw new Error(`Input symlink escapes its dependency copy: ${key}`);
        files[key] = { symlink: await readlink(current) };
        continue;
      }
      if (item.isDirectory()) await visit(current);
      else if (item.isFile()) {
        const bytes = await readFile(current);
        files[key] = { bytes: bytes.length, sha256: sha256(bytes) };
      } else throw new Error(`Input is not a regular file: ${key}`);
    }
  }
  await visit(root);
  return files;
}

async function seal(root) {
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) await seal(path);
    else await chmod(path, 0o444);
  }
  await chmod(root, 0o555);
}

export async function prepareOpaqueAblation({
  sourceRoot,
  dependenciesRoot,
  outputRoot,
}) {
  for (const path of [sourceRoot, dependenciesRoot, outputRoot])
    if (!isAbsolute(path)) throw new Error("Ablation paths must be absolute");
  const originalSource = await inventory(sourceRoot),
    originalDependencies = await inventory(dependenciesRoot, true);
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  const outcomes = {};
  for (const variant of ["base", "opaque-discard-removed"]) {
    const app = resolve(outputRoot, variant);
    await cp(sourceRoot, app, {
      recursive: true,
      dereference: false,
      verbatimSymlinks: true,
      errorOnExist: true,
      force: false,
    });
    await cp(dependenciesRoot, resolve(app, "node_modules"), {
      recursive: true,
      dereference: false,
      verbatimSymlinks: true,
      errorOnExist: true,
      force: false,
    });
    if (
      JSON.stringify(await inventory(resolve(app, "node_modules"), true)) !==
      JSON.stringify(originalDependencies)
    )
      throw new Error(
        "Copied dependency input differs from its immutable original",
      );
    const packageRoot = await realpath(
      resolve(app, "node_modules/@aperture-engine/webgpu"),
    );
    if (!packageRoot.startsWith(app + sep))
      throw new Error(
        "Copied WebGPU package still points outside the diagnostic app",
      );
    const shaderPath = resolve(
      packageRoot,
      "dist/materials/standard/standard-shader-source.js",
    );
    const before = await readFile(shaderPath, "utf8");
    if (variant === "opaque-discard-removed") {
      // Change the independent copied dependency only. The old SDK, installed
      // original packages and current repository shader stay untouched.
      const replaced = removeKnownOpaqueDiscard(before);
      await chmod(shaderPath, 0o644);
      await writeFile(shaderPath, replaced);
    }
    const build = await exec(
      process.execPath,
      [resolve(app, "node_modules/vite/bin/vite.js"), "build"],
      { cwd: app, maxBuffer: 8 * 1024 * 1024 },
    );
    await writeImmutable(
      resolve(outputRoot, `${variant}-build.log`),
      build.stdout + build.stderr,
    );
    const outputFiles = await inventory(resolve(app, "dist"));
    const copiedDependencies = await inventory(
      resolve(app, "node_modules"),
      true,
    );
    const changedDependency = relative(resolve(app, "node_modules"), shaderPath)
      .split(sep)
      .join("/");
    const expectedDependencies = { ...originalDependencies };
    if (variant === "opaque-discard-removed")
      expectedDependencies[changedDependency] = {
        bytes: (await readFile(shaderPath)).length,
        sha256: sha256(await readFile(shaderPath)),
      };
    if (
      JSON.stringify(copiedDependencies) !==
      JSON.stringify(expectedDependencies)
    )
      throw new Error(
        "Diagnostic build changed an unexpected dependency input",
      );
    const copiedSource = await inventory(app, false, ["node_modules", "dist"]);
    const originalAuthored = Object.fromEntries(
      Object.entries(originalSource).filter(
        ([path]) => !path.startsWith("dist/"),
      ),
    );
    for (const [path, expected] of Object.entries(originalAuthored)) {
      const actual = copiedSource[path];
      if (
        !actual ||
        actual.sha256 !== expected.sha256 ||
        actual.bytes !== expected.bytes
      )
        throw new Error(`Authored scene changed during ablation: ${path}`);
    }
    if (
      Object.keys(copiedSource).length !== Object.keys(originalAuthored).length
    )
      throw new Error(
        "Unexpected authored files were introduced during the diagnostic build",
      );
    outcomes[variant] = {
      appRoot: app,
      distRoot: resolve(app, "dist"),
      sourceFiles: originalAuthored,
      outputFiles,
      modifiedPackageFile: relative(app, shaderPath).split(sep).join("/"),
      packageShaderBeforeSha256: sha256(Buffer.from(before)),
      packageShaderAfterSha256: sha256(await readFile(shaderPath)),
      dependencyFilesManifestSha256: sha256(
        Buffer.from(JSON.stringify(copiedDependencies)),
      ),
      diagnosticOnly: true,
    };
    await seal(app);
  }
  // Re-read originals: copied dependency edits must never modify base inputs.
  if (
    JSON.stringify(await inventory(sourceRoot)) !==
      JSON.stringify(originalSource) ||
    JSON.stringify(await inventory(dependenciesRoot, true)) !==
      JSON.stringify(originalDependencies)
  )
    throw new Error(
      "Original author source/dependencies changed while preparing diagnostic copies",
    );
  const provenance = {
    schema: "aperture.opaque-discard-ablation.v1",
    recordedAt: new Date().toISOString(),
    scope:
      "Single known-opaque-house StandardMaterial discard-block ablation; no production performance change",
    originalSourceRoot: sourceRoot,
    originalDependenciesRoot: dependenciesRoot,
    originalSource,
    originalDependencies,
    variants: outcomes,
  };
  await writeImmutable(
    resolve(outputRoot, "provenance.json"),
    JSON.stringify(provenance, null, 2) + "\n",
  );
  return provenance;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await prepareOpaqueAblation({
      sourceRoot: process.argv[2],
      dependenciesRoot: process.argv[3],
      outputRoot: process.argv[4],
    });
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
