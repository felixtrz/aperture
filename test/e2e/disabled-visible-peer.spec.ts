import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const visibleMaterial = { r: 0.18, g: 0.78, b: 1, a: 1 };
const disabledMaterial = { r: 1, g: 0.08, b: 0.08, a: 1 };

test("ECS browser example renders enabled peer and skips disabled renderable", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "disabled-visible-peer",
    "disabled-visible-peer-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "disabled-visible-peer",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 1 },
    resources: { materials: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    disabled: {
      authored: 2,
      enabled: 1,
      disabled: 1,
      extracted: 1,
      disabledMaterialKey: "material:disabled-peer-red",
      disabledMaterialColor: [1, 0.08, 0.08, 1],
      diagnostics: ["render.disabled"],
      explanations: {
        visible: {
          status: "rendered",
          rendered: true,
          skipped: false,
          drawCount: 1,
          diagnosticCodes: [],
          reasons: [],
        },
        disabled: {
          status: "skipped",
          rendered: false,
          skipped: true,
          drawCount: 0,
          diagnosticCodes: ["render.disabled"],
          reasons: ["disabled"],
        },
      },
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Disabled visible peer pixel assertion requires readback.");
    return;
  }

  const centerSample = status.readback.samples.find(
    (sample) => sample.id === "center",
  );

  expect(
    centerSample,
    `expected center GPU readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (centerSample === undefined) {
    return;
  }

  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(visibleMaterial)),
    `center GPU readback sample should match enabled peer material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(disabledMaterial)),
    `center GPU readback sample should not match disabled material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(80);
});
