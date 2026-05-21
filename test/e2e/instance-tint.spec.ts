import { expect, test } from "@playwright/test";

import {
  pixelDistance,
  readPngPixel,
  rgbaColorToPixel,
  type RgbaPixel,
} from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface InstanceTintStatus extends ExampleStatusBase {
  readonly instanceCount?: number;
  readonly grid?: {
    readonly columns: number;
    readonly rows: number;
  };
  readonly sharedHandles?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly uniqueMeshCount: number;
    readonly uniqueMaterialCount: number;
  };
  readonly pipelineKeys?: readonly string[];
  readonly samples?: readonly InstanceTintSample[];
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawPackages: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
}

interface InstanceTintSample {
  readonly id: "red" | "green" | "blue";
  readonly x: number;
  readonly y: number;
  readonly expectedTint: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
}

test("instance tint example renders one shared material as colored instanced cubes", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<InstanceTintStatus>(
    page,
    "/examples/instance-tint.html",
    "instance-tint-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "instance-tint",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    instanceCount: 256,
    grid: { columns: 16, rows: 16 },
    sharedHandles: {
      meshKey: "mesh:instance-tint-box",
      materialKey: "material:instance-tint-standard",
      uniqueMeshCount: 1,
      uniqueMaterialCount: 1,
    },
    pipelineKeys: ["standard|instance-tint|opaque|none|less|none"],
    counts: {
      meshDraws: 256,
      drawPackages: 256,
      diagnostics: 0,
    },
  });
  expect(status.counts?.drawCalls ?? 999).toBeLessThanOrEqual(
    (status.instanceCount ?? 0) / 16,
  );
  webGpuValidation.expectNoWarnings();

  await attachExampleStatus("instance-tint-status", status);

  const screenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("instance-tint.png", {
    body: screenshot,
    contentType: "image/png",
  });

  const clear = rgbaColorToPixel(
    status.clearColor ?? { r: 0.012, g: 0.016, b: 0.024, a: 1 },
  );
  const samples = status.samples ?? [];

  expect(samples.map((sample) => sample.id).sort()).toEqual([
    "blue",
    "green",
    "red",
  ]);

  const renderedSamples = samples.map((sample) => ({
    id: sample.id,
    pixel: closestRegionSample(
      screenshot,
      sample.x,
      sample.y,
      rgbaColorToPixel(sample.expectedTint),
    ),
  }));

  for (const sample of renderedSamples) {
    expect(
      pixelDistance(sample.pixel, clear),
      `${sample.id} region should differ from clear; pixel=${JSON.stringify(
        sample.pixel,
      )}`,
    ).toBeGreaterThan(55);
  }

  expectDominantChannel(renderedSamples, "red", "r");
  expectDominantChannel(renderedSamples, "green", "g");
  expectDominantChannel(renderedSamples, "blue", "b");
});

function closestRegionSample(
  screenshot: Buffer,
  x: number,
  y: number,
  expected: RgbaPixel,
): RgbaPixel {
  let best = readPngPixel(screenshot, x, y);
  let bestDistance = pixelDistance(best, expected);

  for (const dx of [-0.012, -0.006, 0, 0.006, 0.012]) {
    for (const dy of [-0.012, -0.006, 0, 0.006, 0.012]) {
      const pixel = readPngPixel(
        screenshot,
        Math.min(0.98, Math.max(0.02, x + dx)),
        Math.min(0.98, Math.max(0.02, y + dy)),
      );
      const distance = pixelDistance(pixel, expected);

      if (distance < bestDistance) {
        best = pixel;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function expectDominantChannel(
  samples: readonly { readonly id: string; readonly pixel: RgbaPixel }[],
  id: "red" | "green" | "blue",
  channel: "r" | "g" | "b",
): void {
  const sample = samples.find((candidate) => candidate.id === id);

  expect(sample, `${id} sample should be available`).toBeDefined();

  if (sample === undefined) {
    return;
  }

  const otherChannels = (["r", "g", "b"] as const).filter(
    (candidate) => candidate !== channel,
  );
  const strongestOther = Math.max(
    ...otherChannels.map((candidate) => sample.pixel[candidate]),
  );

  expect(
    sample.pixel[channel] - strongestOther,
    `${id} sample should be ${channel}-dominant; pixel=${JSON.stringify(
      sample.pixel,
    )}`,
  ).toBeGreaterThan(35);
}
