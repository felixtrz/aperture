import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface HdrExposureStatus extends ExampleStatusBase {
  readonly requestedExposure?: number;
  readonly clearColor?: RgbaPixel;
  readonly output?: {
    readonly sceneBufferFormat?: string;
    readonly swapchainFormat?: string;
    readonly hdrSceneBuffer?: boolean;
    readonly tonemapStage?: string;
    readonly tonemapOperator?: string;
    readonly exposure?: number;
    readonly outputColorSpace?: string;
  };
  readonly extraction?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly postEffects?: readonly {
    readonly effectId: string;
    readonly ok: boolean;
    readonly output: string;
  }[];
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

interface HdrExposureReadback {
  readonly status: HdrExposureStatus;
  readonly center: RgbaPixel;
  readonly background: RgbaPixel;
}

const brightness = (pixel: RgbaPixel): number => pixel.r + pixel.g + pixel.b;

test("hdr-exposure scales a > 1.0 emissive highlight through the post tonemap stage", async ({
  page,
}) => {
  const dim = await loadHdrExposureReadback(page, 0.25);
  const base = await loadHdrExposureReadback(page, 1);
  const bright = await loadHdrExposureReadback(page, 4);

  // (Done-when #1) The lit scene renders into a persistent rgba16float HDR
  // buffer and tonemap moved to the final post stage (not in-material).
  for (const { status } of [dim, base, bright]) {
    expect(status.output).toMatchObject({
      sceneBufferFormat: "rgba16float",
      hdrSceneBuffer: true,
      tonemapStage: "post",
      tonemapOperator: "aces",
      outputColorSpace: "srgb",
    });
    expect(status.output?.swapchainFormat).not.toBe("rgba16float");
    // The HDR tonemap post effect is the last stage and writes the swapchain.
    const last = status.postEffects?.at(-1);
    expect(last?.effectId, JSON.stringify(status.postEffects)).toBe(
      "hdr-tonemap",
    );
    expect(last?.output).toBe("swapchain");
    expect(last?.ok).toBe(true);
  }

  // (Done-when #2) The reported exposure is the requested value — it reached
  // the GPU post stage, not baked at author time.
  expect(dim.status.output?.exposure).toBeCloseTo(0.25, 5);
  expect(base.status.output?.exposure).toBeCloseTo(1, 5);
  expect(bright.status.output?.exposure).toBeCloseTo(4, 5);

  // (Done-when #3) The STANDARD lit pipeline renders into the rgba16float HDR
  // buffer and bakes NO output transform: tonemap+sRGB moved to the post stage,
  // so the lit shader variant carries neither a `tonemap:` nor `output-color:`
  // token (those are appended to the shader label only when applied in-material).
  for (const { status } of [dim, base, bright]) {
    const cacheKey = status.pipeline?.cacheKey ?? "";

    expect(cacheKey, JSON.stringify(status, null, 2)).toContain("rgba16float");
    expect(
      cacheKey,
      "lit pipeline must not bake a tonemap operator",
    ).not.toContain("tonemap:");
    expect(
      cacheKey,
      "lit pipeline must not bake an output color-space transform",
    ).not.toContain("output-color:");
  }

  // (Done-when #2) Higher exposure brightens the resolved highlight
  // monotonically — exposure genuinely scales the HDR signal before tonemapping.
  expect(
    brightness(base.center),
    `exposure 1 (${JSON.stringify(base.center)}) should brighten the highlight over exposure 0.25 (${JSON.stringify(dim.center)})`,
  ).toBeGreaterThan(brightness(dim.center) + 30);
  expect(
    brightness(bright.center),
    `exposure 4 (${JSON.stringify(bright.center)}) should brighten the highlight over exposure 1 (${JSON.stringify(base.center)})`,
  ).toBeGreaterThan(brightness(base.center) + 12);

  // (Done-when #2) The 0.25×→4× swing produces a large, measurable swapchain
  // delta on the same probe — the HDR buffer preserved the > 1.0 signal.
  expect(
    pixelDistance(dim.center, bright.center),
    `0.25x vs 4x highlight should differ strongly; dim=${JSON.stringify(dim.center)} bright=${JSON.stringify(bright.center)}`,
  ).toBeGreaterThan(40);

  // The background probe never lands on the sphere: exposure changes the
  // highlight, not the near-black clear, so it stays dim at every exposure.
  for (const { background } of [dim, base, bright]) {
    expect(brightness(background)).toBeLessThan(brightness(dim.center));
  }
});

async function loadHdrExposureReadback(
  page: Page,
  exposure: number,
): Promise<HdrExposureReadback> {
  await page.goto(`/examples/hdr-exposure.html?exposure=${exposure}`);

  const initialStatus = await waitForExampleStatus<HdrExposureStatus>(page);

  expect(
    initialStatus,
    `hdr-exposure ${exposure} status should publish`,
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`hdr-exposure ${exposure} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction((expected) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: HdrExposureStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    if (
      status?.ok !== true ||
      status.output?.exposure !== expected ||
      status.readback?.ok !== true
    ) {
      return false;
    }

    const center = status.readback.samples?.find(
      (candidate) => candidate.id === "sphere-center",
    );
    const background = status.readback.samples?.find(
      (candidate) => candidate.id === "background",
    );

    if (center === undefined || background === undefined) {
      return false;
    }

    // The center probe must land on the lit emissive sphere, clearly brighter
    // than the near-black background probe.
    return (
      center.pixel.r + center.pixel.g + center.pixel.b >
      background.pixel.r + background.pixel.g + background.pixel.b + 60
    );
  }, exposure);

  const status = await waitForExampleStatus<HdrExposureStatus>(page);

  if (status === undefined) {
    throw new Error(`hdr-exposure ${exposure} status disappeared.`);
  }

  await attachExampleStatus(`hdr-exposure-${exposure}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "hdr-exposure",
    ok: true,
    requestedExposure: exposure,
    extraction: { meshDraws: 1, diagnostics: 0 },
  });

  return {
    status,
    center: findSample(status, "sphere-center"),
    background: findSample(status, "background"),
  };
}

function findSample(status: HdrExposureStatus, id: string): RgbaPixel {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  if (sample === undefined) {
    throw new Error(
      `hdr-exposure status is missing the ${id} readback sample.`,
    );
  }

  return sample.pixel;
}
