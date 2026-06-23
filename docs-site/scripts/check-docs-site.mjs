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

async function existsPath(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function normalizeBase(value) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function distRouteFromPublicUrl(url) {
  const base = normalizeBase(process.env.APERTURE_DOCS_BASE ?? "/");
  if (!url.startsWith("/")) {
    return null;
  }
  if (base !== "/" && url.startsWith(base)) {
    return url.slice(base.length);
  }
  return url.slice(1);
}

async function checkImportMapTargets(route) {
  const file = path.join(docsSiteDir, "dist", route);
  const html = await readFile(file, "utf8");
  if (html.includes("/node_modules/")) {
    fail(`${route} still references /node_modules/ in browser-visible HTML`);
  }

  const importMapMatch = html.match(
    /<script\s+type=["']importmap["']>\s*([\s\S]*?)\s*<\/script>/u,
  );
  if (!importMapMatch) {
    return;
  }

  const importMap = JSON.parse(importMapMatch[1]);
  for (const target of Object.values(importMap.imports ?? {})) {
    if (typeof target !== "string") {
      continue;
    }
    const distRoute = distRouteFromPublicUrl(target);
    if (distRoute === null) {
      continue;
    }
    if (!(await exists(path.join(docsSiteDir, "dist", distRoute)))) {
      fail(`${route} import map target is missing from dist: ${target}`);
    }
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
  const stagedShowcaseHtml = path.join(
    docsSiteDir,
    "dist",
    "showcase",
    showcase,
    "index.html",
  );
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
  } else if (!(await exists(stagedShowcaseHtml))) {
    fail(`docs-site dist is missing staged showcase ${showcase}`);
  } else {
    const showcaseHtml = await readFile(stagedShowcaseHtml, "utf8");
    if (!showcaseHtml.includes(`/showcase/${showcase}/`)) {
      fail(`staged showcase ${showcase} does not use a base-aware asset path`);
    }
    if (showcaseHtml.includes("Aperture — the agent-first 3D engine")) {
      fail(`staged showcase ${showcase} resolved to the docs-site home page`);
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
  "about/index.html",
  "examples/index.html",
  "examples/triangle.html",
  "showcases/index.html",
  "showcase/city-builder/index.html",
  "showcase/fps/index.html",
  "showcase/platformer/index.html",
  "showcase/racing/index.html",
]) {
  if (!(await exists(path.join(docsSiteDir, "dist", route)))) {
    fail(`docs-site dist is missing ${route}`);
  }
}
if (await exists(path.join(docsSiteDir, "dist", "status", "index.html"))) {
  fail("docs-site dist must not include the removed status route");
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
  path.join(docsSiteDir, "dist", "about", "index.html"),
  "utf8",
);
if (!docsHtml.includes("ECS is authoritative")) {
  fail("about page is missing core concepts content");
}
if (!docsHtml.includes("Transformer-powered search")) {
  fail("about page is missing reference search content");
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
  "vendor/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
  "vendor/elics/lib/index.js",
  "vendor/@preact/signals-core/dist/signals-core.mjs",
  "vendor/@dimforge/rapier3d-compat/rapier.mjs",
  "worker-modules/examples/triangle.main.js",
  "worker-modules/packages/simulation/dist/index.js",
  "worker-modules/vendor/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
]) {
  if (!(await exists(path.join(docsSiteDir, "dist", stagedRoute)))) {
    fail(`docs-site dist is missing staged example asset ${stagedRoute}`);
  }
}
if (await existsPath(path.join(docsSiteDir, "dist", "node_modules"))) {
  fail("docs-site dist must not publish browser assets under /node_modules");
}
for (const file of expectedExamples) {
  await checkImportMapTargets(path.join("examples", file));
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
}
