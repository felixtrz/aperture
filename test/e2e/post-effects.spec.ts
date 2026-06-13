import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, type RgbaPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface PostEffectsStatus extends ExampleStatusBase {
  readonly effects?: {
    readonly fxaa: boolean;
    readonly bloom: boolean;
    readonly enabledIds: readonly string[];
    readonly report: readonly {
      readonly effectId: string;
      readonly ok: boolean;
      readonly output: string;
      readonly drawCalls: number;
      readonly graph?: {
        readonly topology: string;
        readonly passCount: number;
        readonly resourceCount: number;
        readonly downsamplePasses: number;
        readonly upsamplePasses: number;
        readonly compositePasses: number;
        readonly levels: readonly {
          readonly width: number;
          readonly height: number;
        }[];
      };
    }[];
  };
  readonly extraction?: {
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly draw?: {
    readonly drawCalls: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

test("post effects example toggles FXAA and bloom with visible pixel changes", async ({
  page,
}) => {
  const direct = await loadPostEffectsStatus(page, {
    fxaa: false,
    bloom: false,
  });

  await page.getByRole("button", { name: "FXAA" }).click();
  const fxaa = await waitForPostEffectsStatus(page, {
    fxaa: true,
    bloom: false,
  });

  await page.getByRole("button", { name: "FXAA" }).click();
  const directAgain = await waitForPostEffectsStatus(page, {
    fxaa: false,
    bloom: false,
  });

  await page.getByRole("button", { name: "Bloom" }).click();
  const bloom = await waitForPostEffectsStatus(page, {
    fxaa: false,
    bloom: true,
  });

  await page.getByRole("button", { name: "FXAA" }).click();
  const both = await waitForPostEffectsStatus(page, {
    fxaa: true,
    bloom: true,
  });

  expect(effectIds(direct.status)).toEqual([]);
  expect(effectIds(fxaa.status)).toEqual(["fxaa"]);
  expect(effectIds(bloom.status)).toEqual(["bloom"]);
  expect(effectIds(both.status)).toEqual(["fxaa", "bloom"]);
  expect(direct.status.draw?.drawCalls).toBe(2);
  expect(fxaa.status.draw?.drawCalls).toBe(3);
  // Bloom-enabled frames gained one pass when the FrameGraph route became the
  // default (AI-25); verified identical on Metal and SwiftShader.
  expect(bloom.status.draw?.drawCalls).toBe(7);
  expect(both.status.draw?.drawCalls).toBe(8);
  // Bloom gained an explicit brightpass stage on the FrameGraph route — the
  // same change that put bloom frames at 7 draw calls above.
  expect(bloom.status.effects?.report[0]?.graph).toMatchObject({
    topology: "brightpass-downsample-upsample",
    passCount: 5,
    resourceCount: 4,
    downsamplePasses: 2,
    upsamplePasses: 1,
    compositePasses: 1,
  });
  expect(bloom.status.effects?.report[0]?.graph?.levels.length).toBe(2);
  expect(
    maxSharedSampleDistance(direct.samples, fxaa.samples),
    "FXAA should alter at least one sampled high-contrast edge pixel.",
  ).toBeGreaterThan(2);
  expect(
    maxDarkSampleBrightening(directAgain.samples, bloom.samples),
    "Bloom should brighten at least one sampled dark pixel near the bright planes.",
  ).toBeGreaterThan(8);
});

test("post effects FrameGraph path matches the legacy path's pixels + report", async ({
  page,
}) => {
  // M3-T3 Done-when #4: fxaa + bloom through the single-encoder graph path
  // produces the same per-effect report and the same readback pixels as the
  // legacy per-pass path (the win is one command buffer, not new pixels).
  const legacy = await loadPostEffectsStatus(page, { fxaa: true, bloom: true });
  const graph = await loadPostEffectsStatus(page, {
    fxaa: true,
    bloom: true,
    useFrameGraph: true,
  });

  expect(effectIds(graph.status)).toEqual(["fxaa", "bloom"]);
  expect(graph.status.draw?.drawCalls).toBe(legacy.status.draw?.drawCalls);
  // byte-identical per-effect submission reports (incl. the bloom graph report)
  expect(graph.status.effects?.report).toEqual(legacy.status.effects?.report);

  // identical pixels at every shared readback sample — one encoder, same draws
  let maxDelta = 0;
  let compared = 0;
  for (const [id, graphPixel] of graph.samples) {
    const legacyPixel = legacy.samples.get(id);
    if (legacyPixel !== undefined) {
      compared += 1;
      maxDelta = Math.max(maxDelta, pixelDistance(graphPixel, legacyPixel));
    }
  }
  expect(
    compared,
    "graph + legacy should share readback samples",
  ).toBeGreaterThan(100);
  expect(
    maxDelta,
    "graph-path pixels should match the legacy path",
  ).toBeLessThanOrEqual(2);
});

async function loadPostEffectsStatus(
  page: Page,
  config: {
    readonly fxaa: boolean;
    readonly bloom: boolean;
    readonly useFrameGraph?: boolean;
  },
): Promise<{
  readonly status: PostEffectsStatus;
  readonly samples: Map<string, RgbaPixel>;
}> {
  await page.goto(
    `/examples/post-effects.html?fxaa=${config.fxaa ? "1" : "0"}&bloom=${
      config.bloom ? "1" : "0"
    }${config.useFrameGraph === true ? "&graph=1" : ""}`,
  );

  return waitForPostEffectsStatus(page, config);
}

async function waitForPostEffectsStatus(
  page: Page,
  config: { readonly fxaa: boolean; readonly bloom: boolean },
): Promise<{
  readonly status: PostEffectsStatus;
  readonly samples: Map<string, RgbaPixel>;
}> {
  const initialStatus = await waitForExampleStatus<PostEffectsStatus>(page);

  expect(initialStatus, "post effects status should publish").toBeDefined();

  if (initialStatus === undefined) {
    throw new Error("Post effects status did not publish.");
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction((expected) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: PostEffectsStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      status.effects?.fxaa === expected.fxaa &&
      status.effects?.bloom === expected.bloom &&
      status.readback?.ok === true &&
      (status.readback.samples?.length ?? 0) >= 200
    );
  }, config);

  const status = await waitForExampleStatus<PostEffectsStatus>(page);

  if (status === undefined) {
    throw new Error("Post effects status disappeared.");
  }

  await attachExampleStatus(
    `post-effects-${config.fxaa ? "fxaa" : "no-fxaa"}-${
      config.bloom ? "bloom" : "no-bloom"
    }`,
    status,
  );
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "post-effects",
    ok: true,
    phase: "animate",
    effects: {
      fxaa: config.fxaa,
      bloom: config.bloom,
    },
    extraction: {
      meshDraws: 2,
      diagnostics: 0,
    },
  });

  if (status.readback?.ok !== true) {
    test.skip(
      true,
      `Post effects readback unavailable: ${status.readback?.reason ?? "unknown"}`,
    );
  }

  const samples = new Map(
    status.readback?.samples?.map((sample) => [sample.id, sample.pixel]) ?? [],
  );

  return { status, samples };
}

function effectIds(status: PostEffectsStatus): readonly string[] {
  return status.effects?.report.map((effect) => effect.effectId) ?? [];
}

function maxSharedSampleDistance(
  first: ReadonlyMap<string, RgbaPixel>,
  second: ReadonlyMap<string, RgbaPixel>,
): number {
  let maxDistance = 0;

  for (const [id, pixel] of first) {
    const candidate = second.get(id);

    if (candidate !== undefined) {
      maxDistance = Math.max(maxDistance, pixelDistance(pixel, candidate));
    }
  }

  return maxDistance;
}

function maxDarkSampleBrightening(
  direct: ReadonlyMap<string, RgbaPixel>,
  bloom: ReadonlyMap<string, RgbaPixel>,
): number {
  let maxBrightening = 0;

  for (const [id, directPixel] of direct) {
    const bloomPixel = bloom.get(id);

    if (bloomPixel === undefined || luminance(directPixel) > 32) {
      continue;
    }

    maxBrightening = Math.max(
      maxBrightening,
      luminance(bloomPixel) - luminance(directPixel),
    );
  }

  return maxBrightening;
}

function luminance(pixel: RgbaPixel): number {
  return pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114;
}
