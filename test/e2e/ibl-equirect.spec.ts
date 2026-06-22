import { expect, test } from "@playwright/test";

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

interface IblEquirectStatus extends ExampleStatusBase {
  readonly clearColor?: RgbaPixel;
  readonly extraction?: {
    readonly meshDraws: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly environment?: {
    readonly source?: {
      readonly loader?: string;
      readonly projection?: string;
      readonly faceCount?: number;
      readonly width?: number;
      readonly height?: number;
    };
    readonly specularPrefiltering?: boolean;
    readonly diffuseConvolved?: boolean;
    readonly genericAssetInput?: boolean;
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
      readonly pixel: RgbaPixel;
    }[];
  };
}

test("ibl-equirect auto-derives IBL from one equirect HDR and reflects it", async ({
  page,
}) => {
  await page.goto("/examples/ibl-equirect.html");

  const initial = await waitForExampleStatus<IblEquirectStatus>(page);
  expect(initial, "ibl-equirect status should publish").toBeDefined();
  if (initial === undefined) {
    throw new Error("ibl-equirect status did not publish.");
  }
  skipIfUnsupportedWebGpu(initial);

  await page.waitForFunction(() => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: IblEquirectStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    if (status?.ok !== true || status.readback?.ok !== true) {
      return false;
    }

    const reflect = status.readback.samples?.find(
      (s) => s.id === "reflect-probe",
    );
    return reflect !== undefined;
  });

  const status = await waitForExampleStatus<IblEquirectStatus>(page);
  if (status === undefined) {
    throw new Error("ibl-equirect status disappeared.");
  }

  await attachExampleStatus("ibl-equirect", status);
  expectStatusJsonSafeForGpu(status);

  // (Done-when #1) One equirect HDR auto-derived the whole chain.
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ibl-equirect",
    ok: true,
    extraction: { meshDraws: 1, environments: 1, diagnostics: 0 },
    environment: {
      source: {
        loader: "loadHdrFromUri",
        projection: "equirect-to-cube",
        faceCount: 6,
      },
      genericAssetInput: true,
      specularPrefiltering: true,
    },
  });

  // (Done-when #2) The bright equirect band appears in the centre reflection
  // probe: pixelDistance from the flat-clear baseline exceeds a threshold.
  const reflect = findSample(status, "reflect-probe");
  const clear = status.clearColor ?? { r: 0.015, g: 0.025, b: 0.035, a: 1 };
  const clearPixel = {
    r: Math.round(clear.r * 255),
    g: Math.round(clear.g * 255),
    b: Math.round(clear.b * 255),
    a: 255,
  };
  expect(
    pixelDistance(reflect, clearPixel),
    `the centre mirror probe should reflect the bright equirect band; reflect=${JSON.stringify(
      reflect,
    )}`,
  ).toBeGreaterThan(40);
});

function findSample(status: IblEquirectStatus, id: string): RgbaPixel {
  const sample = status.readback?.samples?.find((s) => s.id === id);
  if (sample === undefined) {
    throw new Error(
      `ibl-equirect status is missing the ${id} readback sample.`,
    );
  }
  return sample.pixel;
}
