#!/usr/bin/env node
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const examplesDir = path.join(repoRoot, "examples");
const outputFile = path.join(
  docsSiteDir,
  "src",
  "content",
  "examples.generated.json",
);

const categoryRules = [
  ["Physics", /physics|character|joint|settling|worker-mode/u],
  ["Materials", /material|matcap|clearcoat|iridescence|alpha|standard/u],
  ["Lighting And Shadows", /light|shadow|ibl|hdr|exposure|environment/u],
  ["Assets And GLB", /glb|gltf|compressed|asset|animation|skin|morph/u],
  [
    "Cameras And Render Targets",
    /camera|viewport|render-target|picture|msaa|clear-load|mixed/u,
  ],
  ["Post Processing", /post|tonemap|bloom|ssao|dof|fog|atmosphere/u],
  ["Particles And UI", /particle|sprite|ui|text|content|msdf/u],
  ["Interaction", /pointer|picking|pick|orbit|gizmo/u],
  [
    "Diagnostics And Performance",
    /diagnostic|profiler|packet|sab|batch|instanc|persistent/u,
  ],
];

const titleOverrides = new Map([
  ["glb-viewer", "GLB Viewer"],
  ["gltf-scene", "glTF Scene"],
  ["csm-directional-shadow", "CSM Directional Shadow"],
  ["hdr-exposure", "HDR Exposure"],
  ["ibl-brdf", "IBL BRDF"],
  ["ibl-equirect", "IBL Equirect"],
  ["ibl-irradiance", "IBL Irradiance"],
  ["msaa", "MSAA"],
  ["msdf-text", "MSDF Text"],
  ["sab-cube", "SAB Cube"],
]);

function toTitle(id) {
  const override = titleOverrides.get(id);
  if (override !== undefined) {
    return override;
  }

  return id
    .split("-")
    .map((part) => {
      if (/^(glb|gltf|hdr|ibl|msaa|msdf|sab|ui)$/u.test(part)) {
        return part.toUpperCase();
      }
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function categorize(id) {
  for (const [category, pattern] of categoryRules) {
    if (pattern.test(id)) {
      return category;
    }
  }
  return "Basics";
}

// Low-level render-target / MSAA / multi-camera permutation routes are exhaustive
// conformance fixtures that drive the browser e2e suite. They render near-identical
// geometry to probe pipeline plumbing, so they add noise to the public gallery
// without showcasing engine capability. They stay in the manifest (and keep their
// e2e specs) but are flagged `internal` so the gallery hides them by default.
const internalPrefixes = ["render-target-", "mixed-", "camera-"];

function isInternal(id) {
  return internalPrefixes.some((prefix) => id.startsWith(prefix));
}

async function exists(file) {
  try {
    const result = await stat(file);
    return result.isFile();
  } catch {
    return false;
  }
}

const entries = (await readdir(examplesDir))
  .filter((entry) => entry.endsWith(".html") && entry !== "index.html")
  .sort();

const examples = [];
for (const file of entries) {
  const id = file.replace(/\.html$/u, "");
  const sourceFiles = [file];
  for (const suffix of [".main.js", ".worker.js"]) {
    const candidate = `${id}${suffix}`;
    if (await exists(path.join(examplesDir, candidate))) {
      sourceFiles.push(candidate);
    }
  }

  examples.push({
    id,
    title: toTitle(id),
    category: categorize(id),
    internal: isInternal(id),
    file,
    href: `/examples/${file}`,
    localDevUrl: `http://127.0.0.1:5173/examples/${file}`,
    sourceFiles: sourceFiles.map((sourceFile) => `examples/${sourceFile}`),
  });
}

const categories = [
  ...new Set(
    examples
      .filter((example) => !example.internal)
      .map((example) => example.category),
  ),
].sort();
const manifest = {
  generatedAt: new Date(0).toISOString(),
  sourceDirectory: "examples",
  count: examples.length,
  categories,
  examples,
};

await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
