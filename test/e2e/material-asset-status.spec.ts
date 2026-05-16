import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  expectNoDrawSubmissionStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "loading-material-asset",
    status: "loading",
    reason: "material-asset-loading",
    diagnostic: "render.material.loading",
    registryDiagnostic: null,
  },
  {
    scenario: "failed-material-asset",
    status: "failed",
    reason: "material-asset-failed",
    diagnostic: "render.material.failed",
    registryDiagnostic: {
      code: "browser.fixture.failedMaterial",
      message: "Intentional browser fixture failed material asset.",
      severity: "error",
    },
  },
] as const) {
  test(`ECS browser example reports ${fixture.status} material asset without submitting draws`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-status`,
    );

    if (status === undefined) {
      return;
    }

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: false,
      phase: "extract",
      reason: fixture.reason,
      renderingBackend: "webgpu",
      extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
      assetStatus: {
        material: fixture.status,
        diagnostics: [fixture.diagnostic],
        registryDiagnostics:
          fixture.registryDiagnostic === null
            ? []
            : [fixture.registryDiagnostic],
      },
      resources: { materials: 0, bindGroups: 0, missing: "material" },
      binding: { planned: 0, applied: 0, ready: 0, diagnostics: 0 },
      renderWorld: {
        active: 0,
        ready: 0,
        blocked: 0,
        diagnostics: ["renderWorld.empty"],
      },
      diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
    });
    expectNoDrawSubmissionStatus(status);
    expect(status.diagnostics, JSON.stringify(status, null, 2)).toEqual([
      expect.objectContaining({
        code: fixture.diagnostic,
      }),
    ]);
    if (fixture.registryDiagnostic !== null) {
      expect(
        status.assetStatus?.registryDiagnostics,
        JSON.stringify(status, null, 2),
      ).toEqual([expect.objectContaining(fixture.registryDiagnostic)]);
      expect(
        JSON.stringify(status.assetStatus?.registryDiagnostics),
      ).not.toContain("baseColorFactor");
      expect(
        JSON.stringify(status.assetStatus?.registryDiagnostics),
      ).not.toContain("GPU");
    }
  });
}
