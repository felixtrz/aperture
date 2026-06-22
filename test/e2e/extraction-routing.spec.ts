import { test } from "@playwright/test";

import {
  expectMultiEntityRouteFailureStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

for (const fixture of [
  { scenario: "layer-mismatch", reason: "layer-mismatch" },
  { scenario: "disabled-renderable", reason: "disabled-renderable" },
  { scenario: "missing-mesh-asset", reason: "missing-mesh-asset" },
  { scenario: "missing-material-asset", reason: "missing-material-asset" },
  { scenario: "loading-mesh-asset", reason: "mesh-asset-loading" },
  { scenario: "failed-mesh-asset", reason: "mesh-asset-failed" },
  { scenario: "loading-material-asset", reason: "material-asset-loading" },
  { scenario: "failed-material-asset", reason: "material-asset-failed" },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to extraction failure status`, async ({
    page,
  }) => {
    const status = await loadMultiEntityScenarioStatus(
      page,
      fixture.scenario,
      `${fixture.scenario}-extraction-route`,
    );

    if (status === undefined) {
      return;
    }

    expectMultiEntityRouteFailureStatus(status, {
      scenario: fixture.scenario,
      phase: "extract",
      reason: fixture.reason,
      diagnosticCounts: { extraction: 1 },
      matchObject: {
        extraction: { views: 1, meshDraws: 0, diagnostics: 1 },
      },
    });
  });
}
