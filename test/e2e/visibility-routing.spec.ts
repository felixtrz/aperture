import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "render-layer-filter",
    expected: { layerFiltering: { extracted: 1, skipped: 1 } },
  },
  {
    scenario: "disabled-visible-peer",
    expected: { disabled: { enabled: 1, disabled: 1, extracted: 1 } },
  },
  {
    scenario: "render-order-overlap",
    expected: { renderOrder: { expectedTopMaterial: "order-front-blue" } },
  },
  {
    scenario: "depth-overlap",
    expected: {
      depth: { format: "depth24plus" },
      renderOrder: { expectedTopMaterial: "depth-near-green" },
    },
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to submit status`, async ({
    page,
  }) => {
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-visibility-route`, status);

    expect(status, "example status should be published").toBeDefined();

    if (status === undefined) {
      return;
    }

    skipIfUnsupportedWebGpu(status);

    expect(status, JSON.stringify(status, null, 2)).toMatchObject({
      example: "ecs-multi-entity",
      scenario: fixture.scenario,
      ok: true,
      phase: "submit",
      renderingBackend: "webgpu",
      ...fixture.expected,
    });
  });
}
