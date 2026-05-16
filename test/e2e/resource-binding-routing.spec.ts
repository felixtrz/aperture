import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "missing-resource",
    missing: "material",
    reason: "missing-material-resource",
    diagnosticCode: "renderFrameSnapshotBinding.missingMaterialResource",
  },
  {
    scenario: "missing-mesh-resource",
    missing: "mesh",
    reason: "missing-mesh-resource",
    diagnosticCode: "renderFrameSnapshotBinding.missingMeshResource",
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to resource-binding status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-resource-binding-route`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: false,
      phase: "resource-bindings",
      reason: fixture.reason,
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
      resources: { materials: 0, bindGroups: 0, missing: fixture.missing },
      binding: {
        planned: 1,
        applied: 1,
        ready: 0,
        diagnostics: 1,
        diagnosticCodes: [fixture.diagnosticCode],
      },
      renderWorld: { active: 1, ready: 0, blocked: 1 },
      diagnosticCounts: expectedDiagnosticCounts({ binding: 1, draw: 1 }),
    });
    expectNoDrawSubmissionStatus(status);
    expect(status.submission?.drawCalls, JSON.stringify(status, null, 2)).toBe(
      0,
    );
    expectStatusJsonSafeForGpu(status);
  });
}
