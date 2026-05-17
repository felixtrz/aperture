import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AppDiagnosticsStatus extends ExampleStatusBase {
  readonly diagnosticOnly?: boolean;
  readonly diagnosticCodes?: readonly string[];
  readonly clearColor?: unknown;
  readonly scenarios?: {
    readonly mixedMaterials?: AppDiagnosticScenarioStatus;
    readonly materialDependencies?: AppDiagnosticScenarioStatus;
    readonly standardMaterialDependencies?: AppDiagnosticScenarioStatus;
    readonly mixedMaterialSuccess?: AppDiagnosticScenarioStatus;
  };
}

interface AppDiagnosticScenarioStatus {
  readonly caseId: string;
  readonly ok: boolean;
  readonly expectedFailure: boolean;
  readonly expectedDiagnostic?: string;
  readonly submitted: boolean;
  readonly failedMaterialKind?: string;
  readonly failedMaterialKey?: string;
  readonly failedDependencyFields?: readonly string[];
  readonly failedResourceKeys?: readonly string[];
  readonly diagnosticCodes: readonly string[];
  readonly message: string;
  readonly report: {
    readonly ok: boolean;
    readonly counts: {
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly diagnostics: readonly {
      readonly code?: string;
      readonly message?: string;
    }[];
    readonly materialDependencyReadiness?: readonly unknown[];
  };
}

test("app diagnostics example exposes app-facade failure reports", async ({
  page,
}) => {
  await page.goto("/examples/app-diagnostics.html");

  const status = await waitForExampleStatus<AppDiagnosticsStatus>(page);

  await attachExampleStatus("app-diagnostics-status", status);
  expect(status, "app diagnostics status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "app-diagnostics",
    diagnosticOnly: true,
    ok: true,
    phase: "diagnostics-ready",
    renderingBackend: "webgpu-explicit",
  });

  const mixed = status.scenarios?.mixedMaterials;
  const dependencies = status.scenarios?.materialDependencies;
  const standardDependencies = status.scenarios?.standardMaterialDependencies;
  const success = status.scenarios?.mixedMaterialSuccess;

  expect(mixed, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "mixed-materials",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    submitted: false,
    failedMaterialKind: "matcap",
    report: {
      ok: false,
      counts: { meshDraws: 2, drawCalls: 0 },
    },
  });
  expect(mixed?.diagnosticCodes).toContain(
    "webGpuApp.materialDependenciesNotReady",
  );
  expect(mixed?.diagnosticCodes).not.toContain(
    "webGpuApp.additionalDrawResourceUnsupported",
  );
  expect(mixed?.failedResourceKeys).toEqual(
    expect.arrayContaining([
      "texture:diagnostic-missing-matcap",
      "sampler:diagnostic-loading-matcap",
    ]),
  );
  expect(mixed?.message).toContain("source asset dependencies");

  expect(dependencies, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "material-dependencies",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    report: {
      ok: false,
      counts: { meshDraws: 0, drawCalls: 0 },
    },
  });
  expect(dependencies?.diagnosticCodes).toEqual(
    expect.arrayContaining([
      "render.texture.missing",
      "render.sampler.loading",
      "webGpuApp.materialDependenciesNotReady",
      "webGpuApp.emptySnapshot",
    ]),
  );
  expect(dependencies?.message).toContain("source asset dependencies");
  expect(dependencies?.report.materialDependencyReadiness).toHaveLength(1);

  expect(standardDependencies, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "standard-material-dependencies",
    ok: false,
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    submitted: false,
    failedMaterialKind: "standard",
    report: {
      ok: false,
      counts: { meshDraws: 1, drawCalls: 0 },
    },
  });
  expect(standardDependencies?.diagnosticCodes).toContain(
    "webGpuApp.materialDependenciesNotReady",
  );
  expect(standardDependencies?.failedDependencyFields).toEqual([
    "baseColorTexture",
    "baseColorTexture",
  ]);
  expect(standardDependencies?.failedResourceKeys).toEqual(
    expect.arrayContaining([
      "texture:standard-missing-base-color",
      "sampler:standard-loading-base-color",
    ]),
  );
  expect(standardDependencies?.report.materialDependencyReadiness).toHaveLength(
    1,
  );
  expect(standardDependencies?.message).toContain("source asset dependencies");

  expect(success, JSON.stringify(status, null, 2)).toMatchObject({
    caseId: "mixed-material-success",
    ok: true,
    expectedFailure: false,
    submitted: true,
    report: {
      ok: true,
      counts: { meshDraws: 2, drawCalls: 2, diagnostics: 0 },
      diagnostics: [],
    },
  });
  expect(success?.diagnosticCodes).toEqual([]);

  await page.waitForTimeout(100);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("app-diagnostics-mixed-success.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expectVisibleMixedMaterialPixels(screenshot, status);
});

function expectVisibleMixedMaterialPixels(
  screenshot: Buffer,
  status: AppDiagnosticsStatus,
): void {
  const clear =
    status.clearColor !== undefined &&
    typeof status.clearColor === "object" &&
    status.clearColor !== null
      ? rgbaColorToPixel(
          status.clearColor as { r: number; g: number; b: number; a: number },
        )
      : { r: 5, g: 6, b: 8, a: 255 };
  const samples = [
    strongestRegionSample(screenshot, 0.25, 0.34, 0.46, 0.66, clear),
    strongestRegionSample(screenshot, 0.54, 0.34, 0.75, 0.66, clear),
  ];

  for (const sample of samples) {
    expect(
      pixelDistance(sample, clear),
      `mixed material success should leave non-background pixels; sample=${JSON.stringify(
        sample,
      )} clear=${JSON.stringify(clear)}`,
    ).toBeGreaterThan(30);
  }
}

function strongestRegionSample(
  screenshot: Buffer,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  clear: ReturnType<typeof readPngPixel>,
): ReturnType<typeof readPngPixel> {
  let strongest = clear;
  let strongestDistance = 0;

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const sample = readPngPixel(
        screenshot,
        minX + ((maxX - minX) * x) / 4,
        minY + ((maxY - minY) * y) / 4,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > strongestDistance) {
        strongest = sample;
        strongestDistance = distance;
      }
    }
  }

  return strongest;
}
