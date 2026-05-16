import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
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
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(
      `${fixture.scenario}-resource-binding-route`,
      status,
    );

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

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
