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
    readonly maskMeshKey: string;
    readonly glassMaterialKey: string;
    readonly roughGlassMaterialKey: string;
    readonly texturedGlassMaterialKey: string;
    readonly transmissionTextureKey: string;
    readonly transmissionSamplerKey: string;
    readonly backgroundMaterialKey: string;
    readonly brightBackgroundMaterialKey: string;
    readonly darkBackgroundMaterialKey: string;
    readonly transmissionFactor: number;
    readonly roughness: {
      readonly glossy: number;
      readonly rough: number;
    };
    readonly stripeCount: number;
    readonly expectedMeshDraws: number;
    readonly roughnessContrast?: {
      readonly ok: boolean;
      readonly reason?: string;
      readonly glossy?: number;
      readonly rough?: number;
      readonly backgroundGlossy?: number;
      readonly backgroundRough?: number;
      readonly roughToGlossyRatio?: number;
    } | null;
    readonly textureContrast?: {
      readonly ok: boolean;
      readonly reason?: string;
      readonly highLowDistance?: number;
      readonly highBackgroundDistance?: number;
      readonly lowBackgroundDistance?: number;
    } | null;
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
  readonly transmissionGrabPass?: {
    readonly enabled: boolean;
    readonly ok: boolean;
    readonly width: number;
    readonly height: number;
    readonly commands: number;
    readonly drawCalls: number;
    readonly textureResourceKey: string;
    readonly samplerResourceKey: string;
  };
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

test("browser renders roughness-filtered transmission through scene color", async ({
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
      maskMeshKey: "mesh:transmission-mask-panel-mesh",
      glassMaterialKey: "material:transmission-glass-material",
      roughGlassMaterialKey: "material:transmission-rough-glass-material",
      texturedGlassMaterialKey: "material:transmission-textured-glass-material",
      transmissionTextureKey: "texture:transmission-factor-texture",
      transmissionSamplerKey: "sampler:transmission-factor-nearest",
      backgroundMaterialKey: "material:transmission-background-bright-material",
      brightBackgroundMaterialKey:
        "material:transmission-background-bright-material",
      darkBackgroundMaterialKey:
        "material:transmission-background-dark-material",
      transmissionFactor: 0.9,
      roughness: {
        glossy: 0.02,
        rough: 0.85,
      },
      stripeCount: 24,
      expectedMeshDraws: 28,
    },
    frame: {
      snapshot: {
        views: 1,
        meshDraws: 28,
        lights: 2,
        diagnostics: 0,
      },
      counts: {
        meshDraws: 28,
        diagnostics: 0,
      },
      transmissionGrabPass: {
        enabled: true,
        ok: true,
        width: 960,
        height: 960,
        textureResourceKey:
          "standard-transmission-grab:scene-color:960:960:bgra8unorm",
        samplerResourceKey: "standard-transmission-grab:sampler",
      },
    },
  });

  const frame = status.frame;

  expect(frame, JSON.stringify(status, null, 2)).toBeDefined();

  if (frame === undefined) {
    return;
  }

  expect(frame.counts?.drawCalls).toBeGreaterThanOrEqual(2);
  expect(frame.transmissionGrabPass?.commands).toBeGreaterThan(0);
  expect(frame.transmissionGrabPass?.drawCalls).toBeGreaterThanOrEqual(1);
  expect(frame.pipelineKeys).toEqual(
    expect.arrayContaining([
      "standard|opaque|none|less|none",
      "standard|transmission|blend|none|less|alpha",
      "standard|transmission|transmissionTexture|blend|none|less|alpha",
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
  assertTransmissionRoughnessContrast(status, frame);
  assertTransmissionTextureContrast(status, frame);
  webGpuValidation.expectNoWarnings();
});

function assertTransmissionSamples(frame: TransmissionFrameStatus): void {
  const clear = rgbaColorToPixel({ r: 0.018, g: 0.022, b: 0.028, a: 1 });
  const samples = frame.readback?.samples ?? [];
  const throughGlass = requiredSample(samples, "through-glass");
  const background = requiredSample(samples, "background");
  const glossyDark = requiredSample(samples, "glossy-dark");
  const glossyBright = requiredSample(samples, "glossy-bright");
  const roughDark = requiredSample(samples, "rough-dark");
  const roughBright = requiredSample(samples, "rough-bright");
  const textureLow = requiredSample(samples, "texture-low");
  const textureHigh = requiredSample(samples, "texture-high");
  const textureBackground = requiredSample(samples, "texture-background");
  const backgroundGlossyDark = requiredSample(
    samples,
    "background-glossy-dark",
  );
  const backgroundGlossyBright = requiredSample(
    samples,
    "background-glossy-bright",
  );
  const backgroundRoughDark = requiredSample(samples, "background-rough-dark");
  const backgroundRoughBright = requiredSample(
    samples,
    "background-rough-bright",
  );
  const clearSample = requiredSample(samples, "clear");
  const glossyContrast = pixelDistance(glossyDark.pixel, glossyBright.pixel);
  const roughContrast = pixelDistance(roughDark.pixel, roughBright.pixel);
  const backgroundGlossyContrast = pixelDistance(
    backgroundGlossyDark.pixel,
    backgroundGlossyBright.pixel,
  );
  const backgroundRoughContrast = pixelDistance(
    backgroundRoughDark.pixel,
    backgroundRoughBright.pixel,
  );
  const textureDistance = pixelDistance(textureHigh.pixel, textureLow.pixel);
  const textureHighBackgroundDistance = pixelDistance(
    textureHigh.pixel,
    textureBackground.pixel,
  );
  const textureLowBackgroundDistance = pixelDistance(
    textureLow.pixel,
    textureBackground.pixel,
  );

  expect(pixelDistance(background.pixel, clear)).toBeGreaterThan(80);
  expect(pixelDistance(throughGlass.pixel, clear)).toBeGreaterThan(60);
  expect(pixelDistance(clearSample.pixel, clear)).toBeLessThan(8);
  expect(throughGlass.pixel.r).toBeGreaterThan(90);
  expect(throughGlass.pixel.g).toBeGreaterThan(80);
  expect(throughGlass.pixel.b).toBeGreaterThan(70);
  expect(throughGlass.pixel.r).toBeGreaterThan(background.pixel.r * 0.3);
  expect(backgroundGlossyContrast).toBeGreaterThan(70);
  expect(backgroundRoughContrast).toBeGreaterThan(70);
  expect(glossyContrast).toBeGreaterThan(25);
  expect(roughContrast).toBeLessThan(glossyContrast * 0.85);
  expect(textureDistance).toBeGreaterThan(45);
  expect(textureHighBackgroundDistance).toBeLessThan(
    textureLowBackgroundDistance * 0.85,
  );
}

function assertTransmissionRoughnessContrast(
  status: TransmissionStatus,
  frame: TransmissionFrameStatus,
): void {
  const samples = frame.readback?.samples ?? [];
  const glossy = pixelDistance(
    requiredSample(samples, "glossy-dark").pixel,
    requiredSample(samples, "glossy-bright").pixel,
  );
  const rough = pixelDistance(
    requiredSample(samples, "rough-dark").pixel,
    requiredSample(samples, "rough-bright").pixel,
  );
  const reported = status.transmission?.roughnessContrast;

  expect(reported, JSON.stringify(status, null, 2)).toMatchObject({
    ok: true,
  });
  expect(reported?.glossy).toBeCloseTo(glossy, 6);
  expect(reported?.rough).toBeCloseTo(rough, 6);
  expect(reported?.roughToGlossyRatio).toBeLessThan(0.85);
}

function assertTransmissionTextureContrast(
  status: TransmissionStatus,
  frame: TransmissionFrameStatus,
): void {
  const samples = frame.readback?.samples ?? [];
  const textureHigh = requiredSample(samples, "texture-high").pixel;
  const textureLow = requiredSample(samples, "texture-low").pixel;
  const textureBackground = requiredSample(samples, "texture-background").pixel;
  const highLowDistance = pixelDistance(textureHigh, textureLow);
  const highBackgroundDistance = pixelDistance(textureHigh, textureBackground);
  const lowBackgroundDistance = pixelDistance(textureLow, textureBackground);
  const reported = status.transmission?.textureContrast;

  expect(reported, JSON.stringify(status, null, 2)).toMatchObject({
    ok: true,
  });
  expect(reported?.highLowDistance).toBeCloseTo(highLowDistance, 6);
  expect(reported?.highBackgroundDistance).toBeCloseTo(
    highBackgroundDistance,
    6,
  );
  expect(reported?.lowBackgroundDistance).toBeCloseTo(lowBackgroundDistance, 6);
  expect(reported?.highLowDistance).toBeGreaterThan(45);
  expect(reported?.highBackgroundDistance).toBeLessThan(
    lowBackgroundDistance * 0.85,
  );
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
