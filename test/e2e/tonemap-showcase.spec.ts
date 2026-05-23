import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type TonemapShowcaseOperator = "linear" | "reinhard" | "aces" | "agx";

interface TonemapShowcaseStatus extends ExampleStatusBase {
  readonly selectedOperator?: string;
  readonly operators?: readonly string[];
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly extraction?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly environment?: {
    readonly extracted: number;
    readonly source?: {
      readonly loader?: string;
      readonly format?: string;
      readonly colorSpace?: string;
      readonly faceCount?: number;
    };
    readonly specularPrefiltering?: boolean;
    readonly specularDiagnosticCodes?: readonly string[];
  };
  readonly tonemap?: {
    readonly operator: string;
    readonly requested: string;
    readonly pipelineKey: string;
    readonly outputColorSpace: string;
    readonly outputPipelineKey: string;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
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
  readonly command?: {
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
}

test("tonemap showcase switches named operators over the HDR probe scene", async ({
  page,
}) => {
  const linear = await waitForShowcaseReadback(page, "linear");

  await page.getByRole("button", { name: "ACES" }).click();
  const aces = await waitForShowcaseReadback(page, "aces", false);
  const reinhard = await loadShowcaseReadback(page, "reinhard");
  const agx = await loadShowcaseReadback(page, "agx");

  expect(
    pixelDistance(linear.pixel, aces.pixel),
    `Linear and ACES should map the HDR highlight differently; linear=${JSON.stringify(
      linear.pixel,
    )} aces=${JSON.stringify(aces.pixel)}`,
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(linear.pixel, reinhard.pixel),
    `Linear and Reinhard should map the HDR highlight differently; linear=${JSON.stringify(
      linear.pixel,
    )} reinhard=${JSON.stringify(reinhard.pixel)}`,
  ).toBeGreaterThan(6);
  expect(
    pixelDistance(aces.pixel, agx.pixel),
    `ACES and AgX should map the HDR highlight differently; aces=${JSON.stringify(
      aces.pixel,
    )} agx=${JSON.stringify(agx.pixel)}`,
  ).toBeGreaterThan(3);
});

async function loadShowcaseReadback(
  page: Page,
  operator: TonemapShowcaseOperator,
): Promise<{
  readonly status: TonemapShowcaseStatus;
  readonly pixel: NonNullable<
    NonNullable<TonemapShowcaseStatus["readback"]>["samples"]
  >[number]["pixel"];
}> {
  await page.goto(`/examples/tonemap-showcase.html?tonemap=${operator}`);

  return waitForShowcaseReadback(page, operator, false);
}

async function waitForShowcaseReadback(
  page: Page,
  operator: TonemapShowcaseOperator,
  navigate = true,
): Promise<{
  readonly status: TonemapShowcaseStatus;
  readonly pixel: NonNullable<
    NonNullable<TonemapShowcaseStatus["readback"]>["samples"]
  >[number]["pixel"];
}> {
  if (navigate) {
    await page.goto(`/examples/tonemap-showcase.html?tonemap=${operator}`);
  }

  const initialStatus = await waitForExampleStatus<TonemapShowcaseStatus>(page);

  expect(
    initialStatus,
    `tonemap showcase ${operator} status should publish`,
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`Tonemap showcase ${operator} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction((expected) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: TonemapShowcaseStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;
    const sample = status?.readback?.samples?.find(
      (candidate) => candidate.id === "highlight-probe",
    );

    if (
      status?.ok !== true ||
      status.tonemap?.operator !== expected ||
      status.readback?.ok !== true ||
      sample === undefined
    ) {
      return false;
    }

    const clear = status.clearColor ?? { r: 0.015, g: 0.025, b: 0.035 };
    const clearPixel = {
      r: Math.round(clear.r * 255),
      g: Math.round(clear.g * 255),
      b: Math.round(clear.b * 255),
      a: 255,
    };
    const pixel = sample.pixel;

    return (
      Math.hypot(
        pixel.r - clearPixel.r,
        pixel.g - clearPixel.g,
        pixel.b - clearPixel.b,
        pixel.a - clearPixel.a,
      ) > 24
    );
  }, operator);

  const status = await waitForExampleStatus<TonemapShowcaseStatus>(page);

  if (status === undefined) {
    throw new Error(`Tonemap showcase ${operator} status disappeared.`);
  }

  await attachExampleStatus(`tonemap-showcase-${operator}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "tonemap-showcase",
    ok: true,
    phase: "animate",
    selectedOperator: operator,
    operators: ["linear", "reinhard", "aces", "agx"],
    extraction: {
      meshDraws: 3,
      lights: 2,
      environments: 1,
      diagnostics: 0,
    },
    environment: {
      extracted: 1,
      source: {
        loader: "loadHdrFromUri",
        format: "rgba32float",
        colorSpace: "linear",
        faceCount: 6,
      },
      specularPrefiltering: true,
      specularDiagnosticCodes: [],
    },
    tonemap: {
      operator,
      requested: operator,
      pipelineKey: `tonemap:${operator}`,
      outputColorSpace: "srgb",
      outputPipelineKey: "output-color:srgb",
    },
    command: {
      drawCount: 3,
      indexedDrawCount: 3,
    },
  });
  expect(
    status.pipeline?.cacheKey ?? "",
    JSON.stringify(status, null, 2),
  ).toContain(`tonemap:${operator}`);
  expect(
    status.pipeline?.cacheKey ?? "",
    JSON.stringify(status, null, 2),
  ).toContain("output-color:srgb");

  if (status.readback?.ok !== true) {
    test.skip(
      true,
      `Tonemap showcase readback unavailable: ${status.readback?.reason ?? "unknown"}`,
    );
  }

  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === "highlight-probe",
  );

  expect(
    sample,
    `expected highlight-probe GPU readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    throw new Error(`Missing highlight-probe readback for ${operator}.`);
  }

  return { status, pixel: sample.pixel };
}
