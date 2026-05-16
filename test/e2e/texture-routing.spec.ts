import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

for (const fixture of [
  {
    scenario: "textured-unlit",
    expected: { texture: { materialKey: "material:textured-unlit" } },
  },
  {
    scenario: "sampler-filter-address",
    expected: { sampler: { samplerKey: "sampler:mirror-linear" } },
  },
  {
    scenario: "sampler-v-address",
    expected: { samplerVAddress: { samplerKey: "sampler:mirror-v-linear" } },
  },
  {
    scenario: "textured-unlit-tint",
    expected: { texturedTint: { materialKey: "material:textured-unlit-tint" } },
  },
  {
    scenario: "shared-texture-tinted-unlit",
    expected: {
      sharedTextureTinted: { textureKey: "texture:shared-tint-albedo" },
    },
  },
  {
    scenario: "multi-textured-unlit",
    expected: {
      multiTextured: { left: { materialKey: "material:multi-textured-red" } },
    },
  },
  {
    scenario: "shared-sampler-multi-textured",
    expected: {
      multiTextured: { sharedSamplerKey: "sampler:multi-red-nearest" },
    },
  },
  {
    scenario: "mixed-unlit-pipelines",
    expected: {
      pipelines: { count: 2 },
      mixedPipelines: { factorMaterialKey: "material:mixed-factor-unlit" },
    },
  },
] as const) {
  test(`ECS browser example routes ${fixture.scenario} to submit status`, async ({
    page,
  }) => {
    await page.goto(`/examples/multi-entity.html?scenario=${fixture.scenario}`);
    const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

    await attachExampleStatus(`${fixture.scenario}-texture-route`, status);

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
