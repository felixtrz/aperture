import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface TransmissionStatus extends ExampleStatusBase {
  readonly transmission?: {
    readonly sphereMeshKey: string;
    readonly panelMeshKey: string;
    readonly glassMaterialKey: string;
    readonly backgroundMaterialKey: string;
    readonly transmissionFactor: number;
  };
  readonly frame?: TransmissionFrameStatus;
}

interface TransmissionFrameStatus {
  readonly snapshot?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly pipelineKeys?: readonly string[];
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
}

test("browser renders scalar transmission with background visible through glass", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/transmission.html");

  const status = await waitForExampleStatus<TransmissionStatus>(page);

  await attachExampleStatus("transmission-status", status);
  expect(status, "transmission status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "transmission",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    transmission: {
      sphereMeshKey: "mesh:transmission-sphere-mesh",
      panelMeshKey: "mesh:transmission-panel-mesh",
      glassMaterialKey: "material:transmission-glass-material",
      backgroundMaterialKey: "material:transmission-background-material",
      transmissionFactor: 0.65,
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 2,
        lights: 2,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 2,
        diagnostics: 0,
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(2);
  expect(frame.pipelineKeys).toEqual(
    expect.arrayContaining([
      "standard|opaque|none|less|none",
      "standard|transmission|blend|none|less|alpha",
    ]),
  );

  if (frame.readback?.ok !== true) {
    test.skip(
      true,
      `Transmission pixel assertion requires readback: ${
        frame.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertTransmissionSamples(frame);
  webGpuValidation.expectNoWarnings();
});

function assertTransmissionSamples(frame: TransmissionFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.022, b: 0.028, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const throughGlass = requiredSample(samples, "through-glass");
  const background = requiredSample(samples, "background");
  const clearSample = requiredSample(samples, "clear");

  expect(pixelDistance(background.pixel, clear)).toBeGreaterThan(80);
  expect(pixelDistance(throughGlass.pixel, clear)).toBeGreaterThan(60);
  expect(pixelDistance(clearSample.pixel, clear)).toBeLessThan(8);
  expect(throughGlass.pixel.r).toBeGreaterThan(90);
  expect(throughGlass.pixel.g).toBeGreaterThan(80);
  expect(throughGlass.pixel.b).toBeGreaterThan(70);
  expect(throughGlass.pixel.r).toBeGreaterThan(background.pixel.r * 0.3);
}

function requiredSample(
  samples: NonNullable<
    NonNullable<TransmissionFrameStatus["readback"]>["samples"]
  >,
  id: string,
): NonNullable<
  NonNullable<TransmissionFrameStatus["readback"]>["samples"]
>[number] {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<TransmissionFrameStatus["readback"]>["samples"]
  >[number];
}
