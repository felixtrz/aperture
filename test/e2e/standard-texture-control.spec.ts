import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase, RgbaTuple } from "./example-status-types.js";

const missingTextureScenario = "missing-texture";

interface StandardTextureControlStatus extends ExampleStatusBase {
  readonly renderingBackend?: string;
  readonly expectedFailure?: boolean;
  readonly expectedDiagnostic?: string;
  readonly diagnosticCodes?: readonly string[];
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly standardTexture?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly expectedScalarColor: RgbaTuple;
    readonly expectedTextureColor: RgbaTuple;
    readonly samples: {
      readonly scalar: { readonly x: number; readonly y: number };
      readonly textured: { readonly x: number; readonly y: number };
    };
  };
  readonly resources?: {
    readonly textureResourcesCreated: number;
    readonly samplerResourcesCreated: number;
    readonly materialBuffersCreated: number;
    readonly bindGroupsCreated: number;
  };
  readonly pipelines?: {
    readonly keys: readonly string[];
  };
  readonly draw?: {
    readonly packages: number;
    readonly commands: number;
    readonly drawCalls: number;
  };
}

test("standard texture control renders a distinct base-color textured material", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/standard-texture-control.html");

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus("standard-texture-control-status", status);
  expect(
    status,
    "standard texture control status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    ok: true,
    phase: "rendered",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 2, lights: 2, diagnostics: 0 },
    resources: {
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
      materialBuffersCreated: 2,
    },
    draw: { packages: 2, drawCalls: 2 },
  });
  expect(status.pipelines?.keys).toContain(
    "standard|baseColorTexture|opaque|back|less|none",
  );

  if (status.standardTexture === undefined) {
    throw new Error("standard texture status is missing");
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const scalarSample = readPngPixel(
    screenshot,
    status.standardTexture.samples.scalar.x,
    status.standardTexture.samples.scalar.y,
  );
  const texturedSample = readPngPixel(
    screenshot,
    status.standardTexture.samples.textured.x,
    status.standardTexture.samples.textured.y,
  );
  const expectedTexture = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedTextureColor),
  );
  const expectedScalar = rgbaColorToPixel(
    rgbaTupleToColor(status.standardTexture.expectedScalarColor),
  );

  expect(pixelDistance(texturedSample, expectedTexture)).toBeLessThan(
    pixelDistance(scalarSample, expectedTexture),
  );
  expect(pixelDistance(scalarSample, expectedScalar)).toBeLessThan(
    pixelDistance(texturedSample, expectedScalar),
  );
  expect(pixelDistance(scalarSample, texturedSample)).toBeGreaterThan(40);
  webGpuValidation.expectNoWarnings();
});

test("standard texture control reports missing base-color texture without submitting draws", async ({
  page,
}) => {
  await page.goto(
    `/examples/standard-texture-control.html?scenario=${missingTextureScenario}`,
  );

  const status = await waitForExampleStatus<StandardTextureControlStatus>(page);

  await attachExampleStatus(
    "standard-texture-control-missing-texture-status",
    status,
  );
  expect(status, "missing texture status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "standard-texture-control",
    scenario: missingTextureScenario,
    ok: true,
    phase: "expected-failure",
    expectedFailure: true,
    expectedDiagnostic: "render.standardMaterialTexture.textureNotReady",
    extraction: { views: 1, meshDraws: 1, lights: 2, diagnostics: 1 },
    draw: { drawCalls: 0 },
  });
  expect(status.diagnosticCodes).toContain(
    "render.standardMaterialTexture.textureNotReady",
  );
});

function rgbaTupleToColor(color: RgbaTuple): {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
} {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}
