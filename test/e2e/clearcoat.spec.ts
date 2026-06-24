import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type ClearcoatExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

interface ClearcoatStatus extends ExampleStatusBase {
  readonly clearcoat?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly roughnessMaterialKey: string;
    readonly clearcoatTextureKey: string;
    readonly clearcoatSamplerKey: string;
    readonly roughnessTextureKey: string;
    readonly roughnessSamplerKey: string;
    readonly clearcoatFactor: number;
    readonly textureBackedFactor: boolean;
    readonly clearcoatRoughnessFactor: number;
    readonly textureBackedRoughness: boolean;
    readonly roughnessTextureFactor: number;
  };
  readonly frame?: ClearcoatFrameStatus;
}

interface ClearcoatFrameStatus {
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

test("browser renders texture-backed clearcoat with a distinct coating highlight", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/clearcoat.html");

  await page.waitForFunction(
    () =>
      (globalThis as ClearcoatExampleGlobal).__APERTURE_EXAMPLE_STATUS__ !==
      undefined,
    null,
    { timeout: 30000 },
  );
  const status = await page.evaluate(
    () =>
      (globalThis as ClearcoatExampleGlobal)
        .__APERTURE_EXAMPLE_STATUS__ as ClearcoatStatus,
  );

  await attachExampleStatus("clearcoat-status", status);
  expect(status, "clearcoat status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "clearcoat",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    canvas: {
      width: 960,
      height: 960,
    },
    clearcoat: {
      meshKey: "mesh:clearcoat-panel-mesh",
      materialKey: "material:clearcoat-textured-material",
      roughnessMaterialKey: "material:clearcoat-roughness-textured-material",
      clearcoatTextureKey: "texture:clearcoat-factor-texture",
      clearcoatSamplerKey: "sampler:clearcoat-factor-nearest",
      roughnessTextureKey: "texture:clearcoat-roughness-factor-texture",
      roughnessSamplerKey: "sampler:clearcoat-roughness-factor-nearest",
      clearcoatFactor: 1,
      textureBackedFactor: true,
      clearcoatRoughnessFactor: 0.12,
      textureBackedRoughness: true,
      roughnessTextureFactor: 1,
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

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(1);
  expect(frame.pipelineKeys).toEqual(
    expect.arrayContaining([
      "standard|clearcoat|clearcoatTexture|opaque|none|less|none",
      "standard|clearcoat|clearcoatRoughnessTexture|opaque|none|less|none",
    ]),
  );

  if (frame.readback?.ok !== true) {
    test.skip(
      true,
      `Clearcoat pixel assertion requires readback: ${
        frame.readback?.reason ?? "unknown"
      }`,
    );
  }

  assertClearcoatSamples(frame);
  webGpuValidation.expectNoWarnings();
});

function assertClearcoatSamples(frame: ClearcoatFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.02, b: 0.024, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const basePanel = requiredSample(samples, "base-panel");
  const clearcoatPanel = requiredSample(samples, "clearcoat-panel");
  const roughnessBroad = requiredSample(samples, "roughness-broad");
  const roughnessSharp = requiredSample(samples, "roughness-sharp");
  const background = requiredSample(samples, "background");

  expect(pixelDistance(basePanel.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(clearcoatPanel.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(roughnessBroad.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(roughnessSharp.pixel, clear)).toBeGreaterThan(35);
  expect(pixelDistance(background.pixel, clear)).toBeLessThan(8);
  expect(luminance(clearcoatPanel.pixel)).toBeGreaterThan(
    luminance(basePanel.pixel) + 18,
  );
  expect(clearcoatPanel.pixel.g).toBeGreaterThan(basePanel.pixel.g + 12);
  expect(clearcoatPanel.pixel.b).toBeGreaterThan(basePanel.pixel.b + 10);
  expect(
    pixelDistance(roughnessSharp.pixel, roughnessBroad.pixel),
  ).toBeGreaterThan(6);
  expect(luminance(roughnessSharp.pixel)).toBeGreaterThan(
    luminance(roughnessBroad.pixel) + 3,
  );
}

function luminance(pixel: {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}): number {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}

function requiredSample(
  samples: NonNullable<
    NonNullable<ClearcoatFrameStatus["readback"]>["samples"]
  >,
  id: string,
): NonNullable<
  NonNullable<ClearcoatFrameStatus["readback"]>["samples"]
>[number] {
  const sample = samples.find((entry) => entry.id === id);

  expect(sample, `missing readback sample '${id}'`).toBeDefined();

  return sample as NonNullable<
    NonNullable<ClearcoatFrameStatus["readback"]>["samples"]
  >[number];
}
