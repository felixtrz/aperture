import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

interface DebugNormalAppStatus {
  readonly example: "debug-normal-app";
  readonly ok: boolean;
  readonly phase?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly renderingBackend?: string;
  readonly clearColor?: RgbaStatus;
  readonly debugNormal?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly materialLabel: string;
    readonly materialFamily: string | null;
    readonly pipelineKey: string | null;
    readonly expectedNormalColor: RgbaStatus;
    readonly sample: {
      readonly id: string;
      readonly x: number;
      readonly y: number;
    };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly diagnosticsSummary?: {
    readonly sectionCount: number;
    readonly materialQueue?: {
      readonly itemCount: number;
      readonly byFamily: readonly {
        readonly family: string;
        readonly itemCount: number;
      }[];
    };
    readonly routedResourceSet?: {
      readonly itemCount: number;
      readonly byFamily: readonly {
        readonly family: string;
        readonly itemCount: number;
      }[];
      readonly byFamilyAndPipeline: readonly {
        readonly family: string;
        readonly pipelineKey: string;
        readonly itemCount: number;
      }[];
    };
  };
  readonly resources?: {
    readonly drawCalls: number;
    readonly bindGroups: number;
    readonly materialQueueFamilies: readonly {
      readonly family: string;
      readonly itemCount: number;
    }[];
    readonly routedResourceFamilies: readonly {
      readonly family: string;
      readonly itemCount: number;
    }[];
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
  readonly counts?: {
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly diagnostics?: readonly unknown[];
}

interface RgbaStatus {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

test("DebugNormalMaterial browser app renders the active route", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/debug-normal-app.html");

  const status = await waitForExampleStatus<DebugNormalAppStatus>(page);

  await attachExampleStatus("debug-normal-app-status", status);
  expect(status, "debug-normal status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "debug-normal-app",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    debugNormal: {
      meshKey: "mesh:debug-normal-cube",
      materialKey: "material:debug-normal-material",
      materialFamily: "debug-normal",
      pipelineKey: "debug-normal|opaque|back|less|none",
      sample: { id: "front-face-normal", x: 0.5, y: 0.5 },
    },
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    counts: { drawCalls: 1, diagnostics: 0 },
    resources: {
      drawCalls: 1,
      bindGroups: 3,
      materialQueueFamilies: [{ family: "debug-normal", itemCount: 1 }],
      routedResourceFamilies: [{ family: "debug-normal", itemCount: 1 }],
    },
    diagnosticsSummary: {
      sectionCount: 2,
      materialQueue: {
        itemCount: 1,
        byFamily: [{ family: "debug-normal", itemCount: 1 }],
      },
      routedResourceSet: {
        itemCount: 1,
        byFamily: [{ family: "debug-normal", itemCount: 1 }],
        byFamilyAndPipeline: [
          {
            family: "debug-normal",
            pipelineKey: "debug-normal|opaque|back|less|none",
            itemCount: 1,
          },
        ],
      },
    },
    diagnostics: [],
  });

  const debugNormal = required(status.debugNormal);
  const expected = rgbaColorToPixel(debugNormal.expectedNormalColor);
  const clear = rgbaColorToPixel(required(status.clearColor));
  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const screenshotPixel = readPngPixel(
    screenshot,
    debugNormal.sample.x,
    debugNormal.sample.y,
  );

  expect(pixelDistance(screenshotPixel, expected)).toBeLessThan(
    pixelDistance(screenshotPixel, clear),
  );
  expect(pixelDistance(screenshotPixel, clear)).toBeGreaterThan(40);

  if (status.readback?.ok) {
    const sample = status.readback.samples?.find(
      (entry) => entry.id === "front-face-normal",
    );

    expect(sample).toBeDefined();

    if (sample !== undefined) {
      expect(pixelDistance(sample.pixel, expected)).toBeLessThan(
        pixelDistance(sample.pixel, clear),
      );
      expect(pixelDistance(sample.pixel, clear)).toBeGreaterThan(40);
    }
  } else {
    expect(status.readback, JSON.stringify(status, null, 2)).toMatchObject({
      ok: false,
    });
  }

  guard.expectNoWarnings();
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
