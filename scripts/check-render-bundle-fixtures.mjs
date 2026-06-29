#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureDir = path.join(rootDir, "test/e2e/fixtures");
const cliIndex = path.join(rootDir, "packages/cli/dist/index.js");

const {
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_SNAPSHOT_BUNDLE_VERSION,
  preflightApertureSnapshotBundle,
} = await import(pathToFileURL(cliIndex).href);

const failures = [];
const fixtureFiles = await collectBundleFixtures(fixtureDir);

for (const fixture of fixtureFiles) {
  await checkFixture(fixture);
}

if (fixtureFiles.length === 0) {
  failures.push("No render-bundle fixtures found under test/e2e/fixtures.");
}

if (failures.length > 0) {
  console.error(
    `Render-bundle fixture check failed:\n- ${failures.join("\n- ")}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Render-bundle fixture check passed (${fixtureFiles.length} fixture(s)).`,
  );
}

async function checkFixture(fixture) {
  const relative = displayPath(fixture);
  let bundle;

  try {
    bundle = JSON.parse(await readFile(fixture, "utf8"));
  } catch (error) {
    failures.push(
      `${relative} must be valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }

  if (
    bundle === null ||
    typeof bundle !== "object" ||
    bundle.format !== APERTURE_SNAPSHOT_BUNDLE_FORMAT
  ) {
    failures.push(
      `${relative} must use format '${APERTURE_SNAPSHOT_BUNDLE_FORMAT}'.`,
    );
    return;
  }

  if (bundle.version !== APERTURE_SNAPSHOT_BUNDLE_VERSION) {
    failures.push(
      `${relative} must use bundle version ${APERTURE_SNAPSHOT_BUNDLE_VERSION}.`,
    );
    return;
  }

  const preflight = preflightApertureSnapshotBundle(bundle);

  if (!preflight.ok) {
    failures.push(
      `${relative} is not render-complete: ${preflight.violations.join("; ")}`,
    );
    return;
  }

  if (!sameJson(bundle.closure, preflight.closure)) {
    failures.push(
      `${relative} has stale closure metadata. Regenerate it with 'aperture headless'.`,
    );
  }
}

async function collectBundleFixtures(directory) {
  const result = [];
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...(await collectBundleFixtures(absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".bundle.json")) {
      result.push(absolutePath);
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function displayPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}
