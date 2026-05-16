import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

const material = { r: 0.72, g: 0.28, b: 1, a: 1 };

test("ECS browser example renders primitive through non-default perspective FOV", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "perspective-fov-camera",
    "perspective-fov-camera-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "perspective-fov-camera",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    geometry: {
      primitive: "plane",
      meshLabel: "PerspectiveFovPlane",
      vertexStreams: 1,
      vertexCount: 4,
      indexCount: 6,
      topology: "triangle-list",
      source: "aperture.createPlaneMeshAsset",
    },
    camera: {
      projection: "perspective",
      fovYRadians: Math.PI / 4,
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.camera?.fovYRadians).not.toBeCloseTo(Math.PI / 3, 6);
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Perspective FOV pixel assertion requires readback.");
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
    pixelDistance(centerSample.pixel, rgbaColorToPixel(material)),
    `center GPU readback sample should match perspective FOV material; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(90);
  expect(
    pixelDistance(centerSample.pixel, rgbaColorToPixel(status.clearColor)),
    `center GPU readback sample should differ from clear color; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(40);
});
