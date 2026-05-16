import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const missingTextureResourceCode =
  "unlitBindGroupResource.missingTextureResource";
const missingSamplerResourceCode =
  "unlitBindGroupResource.missingSamplerResource";

for (const fixture of [
  {
    scenario: "missing-texture-sampler-resources",
    meshDraws: 1,
    resourceDiagnostics: 2,
    diagnosticCodeCounts: {
      [missingTextureResourceCode]: 1,
      [missingSamplerResourceCode]: 1,
    },
  },
  {
    scenario: "multi-textured-missing-texture-resource",
    meshDraws: 2,
    resourceDiagnostics: 1,
    diagnosticCodeCounts: { [missingTextureResourceCode]: 1 },
  },
  {
    scenario: "multi-textured-missing-sampler-resource",
    meshDraws: 2,
    resourceDiagnostics: 1,
    diagnosticCodeCounts: { [missingSamplerResourceCode]: 1 },
  },
  {
    scenario: "multi-textured-missing-texture-sampler-resources",
    meshDraws: 2,
    resourceDiagnostics: 2,
    diagnosticCodeCounts: {
      [missingTextureResourceCode]: 1,
      [missingSamplerResourceCode]: 1,
    },
  },
  {
    scenario: "shared-texture-missing-texture-resource",
    meshDraws: 2,
    resourceDiagnostics: 2,
    diagnosticCodeCounts: { [missingTextureResourceCode]: 2 },
  },
  {
    scenario: "shared-texture-missing-sampler-resource",
    meshDraws: 2,
    resourceDiagnostics: 2,
    diagnosticCodeCounts: { [missingSamplerResourceCode]: 2 },
  },
  {
    scenario: "shared-texture-missing-texture-sampler-resources",
    meshDraws: 2,
    resourceDiagnostics: 4,
    diagnosticCodeCounts: {
      [missingTextureResourceCode]: 2,
      [missingSamplerResourceCode]: 2,
    },
  },
  {
    scenario: "shared-sampler-missing-texture-resource",
    meshDraws: 2,
    resourceDiagnostics: 1,
    diagnosticCodeCounts: { [missingTextureResourceCode]: 1 },
  },
  {
    scenario: "shared-sampler-missing-sampler-resource",
    meshDraws: 2,
    resourceDiagnostics: 2,
    diagnosticCodeCounts: { [missingSamplerResourceCode]: 2 },
  },
  {
    scenario: "shared-sampler-missing-texture-sampler-resources",
    meshDraws: 2,
    resourceDiagnostics: 3,
    diagnosticCodeCounts: {
      [missingTextureResourceCode]: 1,
      [missingSamplerResourceCode]: 2,
    },
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to texture resource status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-texture-resource-route`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: false,
      phase: "resources",
      reason: "frame-resources-unavailable",
      renderingBackend: "webgpu",
      extraction: {
        views: 1,
        meshDraws: fixture.meshDraws,
        diagnostics: 0,
      },
      resources: { bindGroups: 0, missing: "texture/sampler" },
      diagnosticCounts: expectedDiagnosticCounts({
        resources: fixture.resourceDiagnostics,
      }),
    });
    expect(
      diagnosticCodeCounts(status),
      JSON.stringify(status, null, 2),
    ).toEqual(fixture.diagnosticCodeCounts);
    expectNoDrawSubmissionStatus(status);
    expectStatusJsonSafeForGpu(status);
  });
}

function diagnosticCodeCounts(
  status: MultiEntityExampleStatus,
): Readonly<Record<string, number>> | undefined {
  if (status.diagnostics === undefined) {
    return undefined;
  }

  const counts: Record<string, number> = {};

  for (const diagnostic of status.diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}
