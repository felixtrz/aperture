import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const intentionalUnknownScenarios = new Set(["not-a-scenario"]);

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
});

async function readExampleScript() {
  return readFile(path.join(projectRoot, "examples/multi-entity.js"), "utf8");
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

    for (const match of content.matchAll(
      /\/examples\/multi-entity\.html\?scenario=([a-z0-9-]+)/gu,
    )) {
      if (!intentionalUnknownScenarios.has(match[1])) {
        scenarios.push(match[1]);
      }
    }

    for (const match of content.matchAll(/\bscenario:\s*"([a-z0-9-]+)"/gu)) {
      if (!intentionalUnknownScenarios.has(match[1])) {
        scenarios.push(match[1]);
      }
    }
  }

  return scenarios;
}

function extractBlock(script, pattern, label) {
  const match = script.match(pattern);

  if (match === null) {
    throw new Error(`Could not find ${label} in multi-entity example.`);
  }

  return match[1];
}
