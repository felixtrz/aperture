import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RenderToTextureStatus extends ExampleStatusBase {
  readonly clearColors?: {
    readonly offscreen?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly screen?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly renderTarget?: {
    readonly width?: number;
    readonly height?: number;
    readonly source?: string;
    readonly key?: string;
    readonly textureUsage?: {
      readonly renderAttachment?: boolean;
      readonly textureBinding?: boolean;
      readonly copySource?: boolean;
    };
  };
  readonly sourceView?: {
    readonly ok?: boolean;
    readonly viewId?: number;
    readonly priority?: number;
    readonly layerMask?: number;
    readonly viewport?: readonly number[];
    readonly scissor?: readonly number[];
    readonly clearColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly renderTargetKey?: string | null;
    readonly expectedRenderTargetKey?: string;
    readonly renderTargetMatches?: boolean;
  };
  readonly scene?: {
    readonly materialKind?: string;
    readonly expectedCenterColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly counts?: {
    readonly views?: number;
    readonly meshDraws?: number;
    readonly drawCalls?: number;
    readonly diagnostics?: number;
  };
  readonly report?: {
    readonly renderTargets?: readonly {
      readonly source: string;
      readonly renderTargetKey: string | null;
      readonly width: number;
      readonly height: number;
      readonly ok: boolean;
      readonly drawCalls: number;
    }[];
  };
  readonly screenPass?: {
    readonly phase?: string;
    readonly drawCalls?: number;
    readonly quad?: {
      readonly source?: string;
      readonly vertexCount?: number;
      readonly widthNdc?: number;
      readonly heightNdc?: number;
    };
    readonly samples?: {
      readonly preview?: string;
      readonly screenClear?: string;
    };
  };
  readonly readback?: {
    readonly ok: boolean;
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
  readonly renderControl?: {
    readonly capabilities?: {
      readonly status?: boolean;
      readonly warnings?: boolean;
      readonly screenshot?: boolean;
      readonly snapshot?: boolean;
      readonly readback?: boolean;
    };
  };
}

test("render-to-texture example displays the off-screen pass on the canvas", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-to-texture.html",
    "render-to-texture-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-to-texture",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    clearColors: {
      offscreen: {
        r: 0.02,
        g: 0.035,
        b: 0.07,
        a: 1,
      },
      screen: {
        r: 0.015,
        g: 0.018,
        b: 0.023,
        a: 1,
      },
    },
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      viewport: [0, 0, 1, 1],
      scissor: [0, 0, 1, 1],
      clearColor: {
        r: 0.02,
        g: 0.035,
        b: 0.07,
        a: 1,
      },
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
    },
    scene: {
      materialKind: "unlit",
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      quad: {
        source: "off-screen render target",
        vertexCount: 6,
        widthNdc: 1.24,
        heightNdc: 1.24,
      },
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
    renderControl: {
      capabilities: {
        status: true,
        warnings: true,
        screenshot: true,
        snapshot: true,
        readback: false,
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: status.renderTarget?.key,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-to-texture-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-to-texture pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    sample,
    `expected render-to-texture center readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    return;
  }

  expect(
    screenClearSample,
    `expected render-to-texture screen clear readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (screenClearSample === undefined) {
    return;
  }

  const expected = rgbaColorToPixel(
    status.scene?.expectedCenterColor ?? { r: 0.06, g: 0.88, b: 0.22, a: 1 },
  );
  const expectedScreenClear = rgbaColorToPixel(
    status.clearColors?.screen ?? { r: 0.015, g: 0.018, b: 0.023, a: 1 },
  );
  const expectedOffscreenClear = rgbaColorToPixel(
    status.clearColors?.offscreen ?? { r: 0.02, g: 0.035, b: 0.07, a: 1 },
  );

  expect(
    pixelDistance(sample.pixel, expected),
    `canvas quad center should sample the off-screen render target; sample=${JSON.stringify(
      sample.pixel,
    )} expected=${JSON.stringify(expected)}`,
  ).toBeLessThan(80);
  expect(
    pixelDistance(screenClearSample.pixel, expectedScreenClear),
    `screen clear readback should come from the main canvas clear region; sample=${JSON.stringify(
      screenClearSample.pixel,
    )} expected=${JSON.stringify(expectedScreenClear)}`,
  ).toBeLessThan(12);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    `canvas quad preview should differ from the untouched main-canvas clear region; preview=${JSON.stringify(
      sample.pixel,
    )} clear=${JSON.stringify(screenClearSample.pixel)}`,
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(sample.pixel, expectedOffscreenClear),
    `canvas quad preview should differ from the off-screen render target clear color; preview=${JSON.stringify(
      sample.pixel,
    )} clear=${JSON.stringify(expectedOffscreenClear)}`,
  ).toBeGreaterThan(40);
});
