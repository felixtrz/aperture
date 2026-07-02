#!/usr/bin/env node
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const examplesDir = path.join(repoRoot, "examples");
const distDir = path.join(docsSiteDir, "dist");
const distExamplesDir = path.join(distDir, "examples");
const distPackagesDir = path.join(distDir, "packages");
const distNodeModulesDir = path.join(distDir, "node_modules");
const distVendorDir = path.join(distDir, "vendor");
const distWorkerModulesDir = path.join(distDir, "worker-modules");
const distGitignorePath = path.join(distDir, ".gitignore");
const base = normalizeBase(process.env.APERTURE_DOCS_BASE ?? "/");

const packageDistTargets = [
  "app",
  "audio",
  "math",
  "particles",
  "physics",
  "physics-rapier",
  "render",
  "runtime",
  "simulation",
  "vite-plugin",
  "webgpu",
];

const browserImportTargets = {
  "@aperture-engine/app": "packages/app/dist/index.js",
  "@aperture-engine/app/browser": "packages/app/dist/browser.js",
  "@aperture-engine/app/config": "packages/app/dist/config.js",
  "@aperture-engine/app/systems": "packages/app/dist/systems.js",
  "@aperture-engine/app/worker": "packages/app/dist/worker.js",
  "@aperture-engine/audio": "packages/audio/dist/index.js",
  "@aperture-engine/math": "packages/math/dist/index.js",
  "@aperture-engine/particles": "packages/particles/dist/index.js",
  "@aperture-engine/physics": "packages/physics/dist/index.js",
  "@aperture-engine/physics/testing": "packages/physics/dist/testing.js",
  "@aperture-engine/physics-rapier": "packages/physics-rapier/dist/index.js",
  "@aperture-engine/render": "packages/render/dist/index.js",
  "@aperture-engine/render/test-support":
    "packages/render/dist/test-support.js",
  "@aperture-engine/runtime": "packages/runtime/dist/index.js",
  "@aperture-engine/simulation": "packages/simulation/dist/index.js",
  "@aperture-engine/vite-plugin": "packages/vite-plugin/dist/index.js",
  "@aperture-engine/webgpu": "packages/webgpu/dist/index.js",
  "@aperture-engine/webgpu/test-support":
    "packages/webgpu/dist/test-support.js",
  "@dimforge/rapier3d-compat": "vendor/@dimforge/rapier3d-compat/rapier.mjs",
  "@preact/signals-core": "vendor/@preact/signals-core/dist/signals-core.mjs",
  elics: "vendor/elics/lib/index.js",
  "wgpu-matrix": "vendor/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
};

const workerImportTargets = Object.fromEntries(
  Object.entries(browserImportTargets).map(([specifier, target]) => [
    specifier,
    `worker-modules/${target}`,
  ]),
);

function normalizeBase(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function route(target) {
  return `${base}${target.replace(/^\/+/u, "")}`;
}

async function exists(file) {
  try {
    const result = await stat(file);
    return result.isFile() || result.isDirectory();
  } catch {
    return false;
  }
}

async function assertFile(file, hint) {
  if (!(await exists(file))) {
    throw new Error(`${hint} is missing: ${path.relative(repoRoot, file)}`);
  }
}

async function copyDirectoryWithTransforms(
  sourceDir,
  targetDir,
  transform,
  options = {},
) {
  const shouldCopy = options.shouldCopy ?? (() => true);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryWithTransforms(source, target, transform, options);
      continue;
    }

    if (!entry.isFile() || !shouldCopy(source)) {
      continue;
    }

    await mkdir(path.dirname(target), { recursive: true });
    if (isTextRoute(entry.name)) {
      const sourceText = await readFile(source, "utf8");
      await writeFile(target, transform(sourceText, source), "utf8");
    } else {
      await cp(source, target, { dereference: true });
    }
  }
}

function isTextRoute(file) {
  return (
    file.endsWith(".html") ||
    file.endsWith(".js") ||
    file.endsWith(".mjs") ||
    file.endsWith(".css") ||
    file.endsWith(".json")
  );
}

function isRuntimeRoute(file) {
  return [".css", ".js", ".json", ".mjs", ".wasm", ".wgsl"].includes(
    path.extname(file),
  );
}

function isPublishedExampleRoute(file) {
  return !file.endsWith(".md") && !file.endsWith(".ts");
}

function rewriteImportSpecifier(source, specifier, target) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return source
    .replace(
      new RegExp(`(\\bfrom\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    )
    .replace(
      new RegExp(`(\\bimport\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    )
    .replace(
      new RegExp(`(\\bimport\\s*\\(\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    )
    .replace(
      new RegExp(`(\\bexport\\s+[^;]*?\\s+from\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    );
}

function rewriteImportSpecifiers(source, targets) {
  let rewritten = source;
  for (const [specifier, target] of Object.entries(targets)) {
    rewritten = rewriteImportSpecifier(rewritten, specifier, route(target));
  }
  return rewritten;
}

function rewriteAbsoluteRoutes(source) {
  let rewritten = source;
  for (const [sourcePrefix, targetPrefix] of Object.entries({
    examples: "examples",
    node_modules: "vendor",
    packages: "packages",
    vendor: "vendor",
    "worker-modules": "worker-modules",
  })) {
    rewritten = rewritten.replace(
      new RegExp(`(["'])/${sourcePrefix}/`, "g"),
      `$1${route(`${targetPrefix}/`)}`,
    );
  }
  return rewritten.replace(/(href=)(["'])\/\2/g, `$1$2${base}$2`);
}

function rewriteExampleHtml(source) {
  const withImportMap = source.replace(
    /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/u,
    (_match, json) => {
      const importMap = JSON.parse(json);
      importMap.imports = {
        ...(importMap.imports ?? {}),
        ...Object.fromEntries(
          Object.entries(browserImportTargets).map(([specifier, target]) => [
            specifier,
            route(target),
          ]),
        ),
      };
      const serialized = JSON.stringify(importMap, null, 2)
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n");
      return `<script type="importmap">\n${serialized}\n    </script>`;
    },
  );

  return rewriteAbsoluteRoutes(withImportMap);
}

function rewriteBrowserText(source) {
  return rewriteAbsoluteRoutes(source);
}

function rewriteWorkerText(source) {
  return rewriteAbsoluteRoutes(
    rewriteImportSpecifiers(source, workerImportTargets),
  );
}

async function stageExamples() {
  const examplesIndexHtml = await readFile(
    path.join(distExamplesDir, "index.html"),
    "utf8",
  );

  await rm(distExamplesDir, { recursive: true, force: true });
  await mkdir(distExamplesDir, { recursive: true });
  await writeFile(
    path.join(distExamplesDir, "index.html"),
    examplesIndexHtml,
    "utf8",
  );

  const entries = await readdir(examplesDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(examplesDir, entry.name);
    const target = path.join(distExamplesDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryWithTransforms(source, target, rewriteBrowserText, {
        shouldCopy: isPublishedExampleRoute,
      });
      continue;
    }

    if (
      !entry.isFile() ||
      entry.name === "index.html" ||
      !isPublishedExampleRoute(source)
    ) {
      continue;
    }

    if (entry.name.endsWith(".html")) {
      await writeFile(
        target,
        rewriteExampleHtml(await readFile(source, "utf8")),
        "utf8",
      );
      continue;
    }

    if (isTextRoute(entry.name)) {
      await writeFile(
        target,
        rewriteBrowserText(await readFile(source, "utf8")),
        "utf8",
      );
    } else {
      await cp(source, target, { dereference: true });
    }
  }
}

async function stagePackages() {
  await rm(distPackagesDir, { recursive: true, force: true });
  await rm(distNodeModulesDir, { recursive: true, force: true });
  await rm(distVendorDir, { recursive: true, force: true });
  await rm(distWorkerModulesDir, { recursive: true, force: true });
  await writeFile(
    distGitignorePath,
    [
      "# Generated by docs-site/scripts/stage-example-routes.mjs.",
      "# These files are published runtime assets for embedded examples.",
      "!packages/",
      "!packages/**",
      "!packages/*/dist/",
      "!packages/*/dist/**",
      "!vendor/",
      "!vendor/**",
      "!worker-modules/",
      "!worker-modules/**",
      "!worker-modules/packages/*/dist/",
      "!worker-modules/packages/*/dist/**",
      "!worker-modules/vendor/",
      "!worker-modules/vendor/**",
      "",
    ].join("\n"),
    "utf8",
  );

  for (const packageName of packageDistTargets) {
    const packageRoot = path.join(repoRoot, "packages", packageName);
    const packageDist = path.join(packageRoot, "dist");
    await assertFile(
      path.join(packageDist, "index.js"),
      `packages/${packageName}/dist/index.js`,
    );
    await copyDirectoryWithTransforms(
      packageDist,
      path.join(distPackagesDir, packageName, "dist"),
      rewriteBrowserText,
      { shouldCopy: isRuntimeRoute },
    );
    await copyDirectoryWithTransforms(
      packageDist,
      path.join(distWorkerModulesDir, "packages", packageName, "dist"),
      rewriteWorkerText,
      { shouldCopy: isRuntimeRoute },
    );
  }

  await copyDependency("node_modules/elics", "vendor/elics");
  await copyDependency("node_modules/wgpu-matrix", "vendor/wgpu-matrix");
  await copyDependency(
    "node_modules/@preact/signals-core",
    "vendor/@preact/signals-core",
  );
  await copyDependency(
    "packages/physics-rapier/node_modules/@dimforge/rapier3d-compat",
    "vendor/@dimforge/rapier3d-compat",
  );
}

async function copyDependency(sourceRelative, targetRelative) {
  const source = path.join(repoRoot, sourceRelative);
  const mainTarget = path.join(distDir, targetRelative);
  const workerTarget = path.join(distWorkerModulesDir, targetRelative);

  await assertFile(source, sourceRelative);
  await copyDirectoryWithTransforms(source, mainTarget, rewriteBrowserText, {
    shouldCopy: isRuntimeRoute,
  });
  await copyDirectoryWithTransforms(source, workerTarget, rewriteWorkerText, {
    shouldCopy: isRuntimeRoute,
  });
}

async function stageWorkerExamples() {
  await copyDirectoryWithTransforms(
    examplesDir,
    path.join(distWorkerModulesDir, "examples"),
    (source, sourceFile) => {
      if (sourceFile.endsWith(".html")) {
        return source;
      }
      return rewriteWorkerText(source);
    },
    { shouldCopy: isPublishedExampleRoute },
  );
}

async function main() {
  await assertFile(
    path.join(distDir, "examples", "index.html"),
    "docs-site examples route",
  );
  await stageExamples();
  await stagePackages();
  await stageWorkerExamples();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
