import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const intentionalUnknownScenarios = new Set(["not-a-scenario"]);
const shallowFailureRouteHelpers = new Map([
  ["extraction-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
  ["texture-dependency-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
  ["shared-texture-asset-routing.spec.ts", "expectTextureAssetRouteStatus"],
  ["shared-sampler-asset-routing.spec.ts", "expectTextureAssetRouteStatus"],
  ["resource-binding-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
  ["texture-resource-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
  ["texture-upload-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
  ["scenario-routing.spec.ts", "expectMultiEntityRouteFailureStatus"],
]);
const sharedFailureRouteHelpers = new Map([
  ["texture-asset-routing.ts", "expectMultiEntityRouteFailureStatus"],
]);

describe("multi-entity example scenarios", () => {
  it("keeps known scenarios aligned with the dispatch table", async () => {
    const script = await readExampleScript();
    const knownScenarios = extractKnownScenarios(script);
    const rendererScenarios = extractScenarioRendererKeys(script);

    expect(new Set(knownScenarios).size).toBe(knownScenarios.length);
    expect(new Set(rendererScenarios).size).toBe(rendererScenarios.length);
    expect(rendererScenarios.toSorted()).toEqual(knownScenarios.toSorted());
    expect(knownScenarios[0]).toBe("default");
  });

  it("keeps e2e scenario routes and fixtures registered", async () => {
    const script = await readExampleScript();
    const knownScenarios = new Set(extractKnownScenarios(script));
    const routedScenarios = await extractE2eScenarioReferences();

    expect(routedScenarios.length).toBeGreaterThan(0);

    for (const scenario of routedScenarios) {
      expect(knownScenarios.has(scenario), scenario).toBe(true);
    }
  });

  it("keeps e2e specs on the shared multi-entity route loader", async () => {
    await expect(findDirectMultiEntityNavigations()).resolves.toEqual([]);
  });

  it("keeps route smoke specs on shared multi-entity helpers", async () => {
    await expect(findRouteSpecsWithoutSharedLoader()).resolves.toEqual([]);
  });

  it("keeps shallow failure route specs on shared failure helpers", async () => {
    await expect(findFailureRoutesWithoutSharedHelper()).resolves.toEqual([]);
  });
});

async function readExampleScript() {
  return readFile(
    path.join(projectRoot, "examples/multi-entity.main.js"),
    "utf8",
  );
}

function extractKnownScenarios(script) {
  const block = extractBlock(
    script,
    /const knownScenarioIds = \[([\s\S]*?)\];/u,
    "knownScenarioIds",
  );

  return [...block.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

function extractScenarioRendererKeys(script) {
  const block = extractBlock(
    script,
    /const scenarioRenderers = \{([\s\S]*?)\n\};\n\ntry/u,
    "scenarioRenderers",
  );

  return [...block.matchAll(/^[ ]{2}(?:"([^"]+)"|(default)):/gmu)].map(
    (match) => match[1] ?? match[2],
  );
}

async function extractE2eScenarioReferences() {
  const e2eRoot = path.join(projectRoot, "test/e2e");
  const entries = await readdir(e2eRoot, { withFileTypes: true });
  const scenarios = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const content = await readFile(path.join(e2eRoot, entry.name), "utf8");
    const referencesMultiEntity =
      content.includes("/examples/multi-entity.html") ||
      content.includes("loadMultiEntityScenarioStatus") ||
      content.includes("expectMultiEntityRouteFailureStatus") ||
      content.includes("expectTextureAssetRouteStatus");

    for (const match of content.matchAll(
      /\/examples\/multi-entity\.html\?scenario=([a-z0-9-]+)/gu,
    )) {
      if (!intentionalUnknownScenarios.has(match[1])) {
        scenarios.push(match[1]);
      }
    }

    if (referencesMultiEntity) {
      for (const match of content.matchAll(/\bscenario:\s*"([a-z0-9-]+)"/gu)) {
        if (!intentionalUnknownScenarios.has(match[1])) {
          scenarios.push(match[1]);
        }
      }
    }

    for (const match of content.matchAll(
      /loadMultiEntityScenarioStatus\(\s*[^,]+,\s*"([a-z0-9-]+)"/gu,
    )) {
      if (!intentionalUnknownScenarios.has(match[1])) {
        scenarios.push(match[1]);
      }
    }
  }

  return scenarios;
}

async function findDirectMultiEntityNavigations() {
  const e2eRoot = path.join(projectRoot, "test/e2e");
  const entries = await readdir(e2eRoot, { withFileTypes: true });
  const navigations = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const content = await readFile(path.join(e2eRoot, entry.name), "utf8");

    for (const match of content.matchAll(
      /page\.goto\(\s*(["'`])\/examples\/multi-entity\.html(?:\?scenario=[^"'`]*)?\1/gu,
    )) {
      navigations.push(`${entry.name}:${lineNumberAt(content, match.index)}`);
    }
  }

  return navigations;
}

async function findRouteSpecsWithoutSharedLoader() {
  const e2eRoot = path.join(projectRoot, "test/e2e");
  const entries = await readdir(e2eRoot, { withFileTypes: true });
  const missing = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith("-routing.spec.ts")) {
      continue;
    }

    const content = await readFile(path.join(e2eRoot, entry.name), "utf8");
    const usesSharedRouteLoader =
      content.includes("loadMultiEntityScenarioStatus") ||
      content.includes("expectTextureAssetRouteStatus");

    if (!usesSharedRouteLoader) {
      missing.push(entry.name);
    }
  }

  return missing;
}

async function findFailureRoutesWithoutSharedHelper() {
  const e2eRoot = path.join(projectRoot, "test/e2e");
  const missing = [];

  for (const [fileName, helperName] of [
    ...shallowFailureRouteHelpers,
    ...sharedFailureRouteHelpers,
  ]) {
    const filePath = path.join(e2eRoot, fileName);
    let content;

    try {
      content = await readFile(filePath, "utf8");
    } catch {
      missing.push(`${fileName}:missing file`);
      continue;
    }

    if (!content.includes(`${helperName}(`)) {
      missing.push(`${fileName}:missing ${helperName}`);
    }
  }

  return missing;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/u).length;
}

function extractBlock(script, pattern, label) {
  const match = script.match(pattern);

  if (match === null) {
    throw new Error(`Could not find ${label} in multi-entity example.`);
  }

  return match[1];
}
