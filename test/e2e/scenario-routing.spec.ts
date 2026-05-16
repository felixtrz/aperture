import { test } from "@playwright/test";

import {
  expectMultiEntityRouteFailureStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example routes unknown scenarios to scenario failure status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "not-a-scenario",
    "not-a-scenario-route",
  );

  if (status === undefined) {
    return;
  }

  expectMultiEntityRouteFailureStatus(status, {
    scenario: "not-a-scenario",
    phase: "scenario",
    reason: "unknown-scenario",
    matchObject: {
      extraction: { views: 0, meshDraws: 0, diagnostics: 0 },
    },
  });
});
