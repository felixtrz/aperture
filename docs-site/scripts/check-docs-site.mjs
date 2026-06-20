#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function exists(file) {
  try {
    const result = await stat(file);
    return result.isFile();
  } catch {
    return false;
  }
}

const examplesDir = path.join(repoRoot, "examples");
const expectedExamples = (await readdir(examplesDir))
  .filter((entry) => entry.endsWith(".html") && entry !== "index.html")
  .sort();
const examplesManifest = await readJson(
  path.join(docsSiteDir, "src", "content", "examples.generated.json"),
);
const manifestExamples = examplesManifest.examples
  .map((example) => example.file)
  .sort();

for (const file of expectedExamples) {
  if (!manifestExamples.includes(file)) {
    fail(`docs examples manifest is missing ${file}`);
  }
}
for (const file of manifestExamples) {
  if (!expectedExamples.includes(file)) {
    fail(`docs examples manifest includes stale file ${file}`);
  }
}

const showcaseSource = await readFile(
  path.join(docsSiteDir, "src", "content", "showcases.ts"),
  "utf8",
);
for (const showcase of ["city-builder", "fps", "platformer", "racing"]) {
  if (!showcaseSource.includes(`id: "${showcase}"`)) {
    fail(`docs showcase manifest is missing ${showcase}`);
  }
  const showcaseDistHtml = path.join(
    repoRoot,
    "showcase",
    showcase,
    "dist",
    "index.html",
  );
  if (!(await exists(showcaseDistHtml))) {
    fail(
      `built showcase output is missing showcase/${showcase}/dist/index.html`,
    );
  } else {
    const showcaseHtml = await readFile(showcaseDistHtml, "utf8");
    if (!showcaseHtml.includes(`/showcase/${showcase}/`)) {
      fail(`built showcase ${showcase} does not use a base-aware asset path`);
    }
  }
}
if (showcaseSource.includes(`id: "hero-city"`)) {
  fail("docs showcase manifest must not list hero-city");
}

const api = await readJson(
  path.join(docsSiteDir, "src", "content", "api.generated.json"),
);
const packageNames = new Set(api.packages.map((entry) => entry.name));
for (const packageName of [
  "@aperture-engine/app",
  "@aperture-engine/simulation",
  "@aperture-engine/render",
  "@aperture-engine/webgpu",
  "@aperture-engine/runtime",
  "@aperture-engine/physics",
  "@aperture-engine/vite-plugin",
]) {
  if (!packageNames.has(packageName)) {
    fail(`API reference is missing ${packageName}`);
  }
}

function hasApiSymbol(packageName, symbolName) {
  const packageEntry = api.packages.find((entry) => entry.name === packageName);
  return (
    packageEntry?.entries.some((entry) =>
      entry.symbols.some((symbol) => symbol.name === symbolName),
    ) ?? false
  );
}

for (const [packageName, symbolName] of [
  ["@aperture-engine/app", "createSystem"],
  ["@aperture-engine/simulation", "defineComponent"],
  ["@aperture-engine/simulation", "saveScene"],
  ["@aperture-engine/webgpu", "createWebGpuApp"],
]) {
  if (!hasApiSymbol(packageName, symbolName)) {
    fail(`API reference is missing ${packageName} export ${symbolName}`);
  }
}

for (const route of [
  "index.html",
  "docs/index.html",
  "examples/index.html",
  "examples/triangle.html",
  "showcases/index.html",
  "api/index.html",
]) {
  if (!(await exists(path.join(docsSiteDir, "dist", route)))) {
    fail(`docs-site dist is missing ${route}`);
  }
}
if (!(await exists(path.join(docsSiteDir, "dist", "status", "index.html")))) {
  fail("docs-site dist is missing status endpoint output");
}
const statusHtml = await readFile(
  path.join(docsSiteDir, "dist", "status", "index.html"),
  "utf8",
);
if (!statusHtml.includes("GitHub Pages-ready dashboard")) {
  fail("status endpoint output does not contain the project dashboard");
}

const homeHtml = await readFile(
  path.join(docsSiteDir, "dist", "index.html"),
  "utf8",
);
if (!homeHtml.includes("3D engine for the agentic age.")) {
  fail("docs-site home no longer contains the preserved front-page tagline");
}
const homeSource = await readFile(
  path.join(docsSiteDir, "src", "pages", "index.astro"),
  "utf8",
);
if (!homeSource.includes("virtual:aperture/browser-entry")) {
  fail("docs-site home source does not import the Aperture browser entry");
}

const docsHtml = await readFile(
  path.join(docsSiteDir, "dist", "docs", "index.html"),
  "utf8",
);
if (!docsHtml.includes("ECS is authoritative")) {
  fail("docs page is missing core concepts content");
}
const docsLayoutSource = await readFile(
  path.join(docsSiteDir, "src", "layouts", "DocsLayout.astro"),
  "utf8",
);
if (!docsLayoutSource.includes("lumin/styles.css")) {
  fail("docs layout does not import Lumin styles");
}

const examplesHtml = await readFile(
  path.join(docsSiteDir, "dist", "examples", "index.html"),
  "utf8",
);
if (!examplesHtml.includes("docs-browser")) {
  fail("examples page is missing the embedded browser layout");
}
const triangleHtml = await readFile(
  path.join(docsSiteDir, "dist", "examples", "triangle.html"),
  "utf8",
);
if (
  !triangleHtml.includes(`${process.env.APERTURE_DOCS_BASE ?? "/"}packages/`)
) {
  fail("staged triangle example does not use base-aware package imports");
}
for (const stagedRoute of [
  "packages/webgpu/dist/index.js",
  "node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
  "worker-modules/examples/triangle.main.js",
  "worker-modules/packages/simulation/dist/index.js",
]) {
  if (!(await exists(path.join(docsSiteDir, "dist", stagedRoute)))) {
    fail(`docs-site dist is missing staged example asset ${stagedRoute}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
}
