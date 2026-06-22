import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectedDiagnosticCounts,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";
import type {
  ExampleStatusBase,
  SceneReadbackStatus,
} from "./example-status-types.js";

const material = { r: 0.2, g: 0.95, b: 0.75, a: 1 };

interface OrthographicRouteStatus extends ExampleStatusBase {
  readonly clearColor?: typeof material;
  readonly extraction: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly resources: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly perViewBindGroups: number;
  };
  readonly binding: {
    readonly planned: number;
    readonly applied: number;
    readonly diagnostics: number;
  };
  readonly renderWorld: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command: {
    readonly drawCount: number;
    readonly indexedDrawCount: number;
    readonly nonIndexedDrawCount: number;
  };
  readonly viewports: readonly {
    readonly viewportPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }[];
  readonly submission: {
    readonly commandBuffers: number;
    readonly viewPasses: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly readback: SceneReadbackStatus;
  readonly camera: {
    readonly projections: readonly {
      readonly label: string;
      readonly projection: string;
      readonly distance: number;
      readonly orthographicHeight?: number;
    }[];
    readonly orthographicHeight: number;
    readonly proof: string;
  };
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("ECS browser example renders primitive through orthographic camera", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "orthographic-camera",
    "orthographic-camera-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "orthographic-camera",
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
      meshLabel: "OrthographicPlane",
      vertexStreams: 1,
      vertexCount: 4,
      indexCount: 6,
      topology: "triangle-list",
      source: "aperture.createPlaneMeshAsset",
    },
    camera: {
      projection: "orthographic",
      orthographicHeight: 2.2,
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.clearColor, JSON.stringify(status, null, 2)).toBeDefined();

  if (status.clearColor === undefined || !status.readback?.ok) {
    test.skip(true, "Orthographic camera pixel assertion requires readback.");
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
    `center GPU readback sample should match orthographic material; status=${JSON.stringify(
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

test("orthographic camera route keeps object size stable across camera distance", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<OrthographicRouteStatus>(
    page,
    "/examples/orthographic-camera.html",
    "orthographic-camera-route-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "orthographic-camera",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 3, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, perViewBindGroups: 3 },
    binding: { planned: 3, applied: 3, diagnostics: 0 },
    renderWorld: { active: 3, ready: 3, blocked: 0 },
    draw: { packages: 3, descriptors: 3, drawList: 3, resolved: 3 },
    command: {
      drawCount: 3,
      indexedDrawCount: 3,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 1,
      viewPasses: 3,
      drawCalls: 3,
      indexedDrawCalls: 3,
    },
    camera: {
      orthographicHeight: 2.2,
      proof: "orthographic-size-stability",
      projections: [
        { label: "perspective-reference", projection: "perspective" },
        {
          label: "orthographic-near",
          projection: "orthographic",
          distance: 2.4,
          orthographicHeight: 2.2,
        },
        {
          label: "orthographic-far",
          projection: "orthographic",
          distance: 6,
          orthographicHeight: 2.2,
        },
      ],
    },
  });
  expect(status.viewports.map((viewport) => viewport.viewportPixels)).toEqual([
    { x: 0, y: 0, width: 320, height: 540 },
    { x: 320, y: 0, width: 320, height: 540 },
    { x: 640, y: 0, width: 320, height: 540 },
  ]);
  expectStatusJsonSafeForGpu(status);

  test.skip(
    status.clearColor === undefined || status.readback.ok !== true,
    "Orthographic route pixel proof requires readback.",
  );

  if (status.clearColor === undefined || !status.readback.ok) {
    return;
  }

  expect(status.diagnosticCounts).toEqual(expectedDiagnosticCounts({}));

  const samples = new Map(
    status.readback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const materialPixel = rgbaColorToPixel(material);
  const clearPixel = rgbaColorToPixel(status.clearColor);

  for (const id of [
    "ortho-near-center",
    "ortho-far-center",
    "ortho-near-left-inside",
    "ortho-near-right-inside",
    "ortho-far-left-inside",
    "ortho-far-right-inside",
  ]) {
    const pixel = samples.get(id);

    expect(pixel, `${id} sample should exist`).toBeDefined();
    if (pixel !== undefined) {
      expect(
        pixelDistance(pixel, materialPixel),
        `${id} material`,
      ).toBeLessThan(90);
      expect(
        pixelDistance(pixel, clearPixel),
        `${id} non-clear`,
      ).toBeGreaterThan(40);
    }
  }

  for (const id of [
    "ortho-near-left-outside",
    "ortho-near-right-outside",
    "ortho-far-left-outside",
    "ortho-far-right-outside",
  ]) {
    const pixel = samples.get(id);

    expect(pixel, `${id} sample should exist`).toBeDefined();
    if (pixel !== undefined) {
      expect(pixelDistance(pixel, clearPixel), `${id} clear`).toBeLessThan(30);
    }
  }

  expect(
    pixelDistance(
      samples.get("ortho-near-left-inside") ?? clearPixel,
      samples.get("ortho-far-left-inside") ?? clearPixel,
    ),
    "near/far orthographic left-inside samples should match",
  ).toBeLessThan(20);
  expect(
    pixelDistance(
      samples.get("ortho-near-right-inside") ?? clearPixel,
      samples.get("ortho-far-right-inside") ?? clearPixel,
    ),
    "near/far orthographic right-inside samples should match",
  ).toBeLessThan(20);
  validationGuard.expectNoWarnings();
});
