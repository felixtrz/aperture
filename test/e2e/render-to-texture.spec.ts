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
  readonly renderTargetResize?: {
    readonly mode?: string;
    readonly reason?: string;
    readonly renderTargetKey?: string;
    readonly before?: {
      readonly width?: number;
      readonly height?: number;
    };
    readonly after?: {
      readonly width?: number;
      readonly height?: number;
    };
    readonly reusedHandle?: boolean;
    readonly textureRecreated?: boolean;
    readonly previousTextureDestroyed?: boolean;
    readonly staleSizeGuard?: string;
  };
  readonly renderTargetReuseStress?: {
    readonly mode?: string;
    readonly renderTargetKey?: string;
    readonly framesRequested?: number;
    readonly framesRendered?: number;
    readonly displayedFrame?: number;
    readonly reusedHandle?: boolean;
    readonly textureRecreated?: boolean;
    readonly targetResourcePressure?: {
      readonly createdTextures?: number;
      readonly reusedTextures?: number;
      readonly stableDimensions?: boolean;
    };
    readonly frames?: readonly {
      readonly frame?: number;
      readonly workerVariant?: string;
      readonly centerExpectation?: string;
      readonly renderTargetKey?: string;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly diagnostics?: number;
    }[];
    readonly staleFirstFrameStatus?: boolean;
  };
  readonly mixedCameraTargets?: {
    readonly mode?: string;
    readonly renderTargetKey?: string;
    readonly source?: string;
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly preview?: string;
        readonly screenClear?: string;
      };
    };
    readonly canvasReadback?: {
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
    } | null;
    readonly expectedSamples?: {
      readonly canvas?: {
        readonly sampleId?: string;
        readonly materialKey?: string;
        readonly expectedColor?: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      };
      readonly offscreenPreview?: {
        readonly sampleId?: string;
        readonly materialKey?: string;
        readonly expectedColor?: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      };
    };
  };
  readonly multiRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
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
    readonly materialKey?: string;
    readonly canvasMaterialKey?: string;
    readonly secondaryRenderTargetKey?: string;
    readonly materialKind?: string;
    readonly expectedCenterColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedCanvasColor?: {
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
    readonly quads?: readonly {
      readonly id?: string;
      readonly role?: string;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly sampleId?: string | null;
      readonly vertexCount?: number;
      readonly widthNdc?: number;
      readonly heightNdc?: number;
    }[];
    readonly samples?: {
      readonly preview?: string;
      readonly leftPreview?: string;
      readonly rightPreview?: string;
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

test("mixed camera targets route keeps canvas and off-screen target passes distinct", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-camera-targets.html",
    "mixed-camera-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-camera-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
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
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    mixedCameraTargets: {
      mode: "current-texture-plus-offscreen-render-target",
      renderTargetKey,
      source: "ViewPacket.renderTarget",
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "swapchain",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "offscreen-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        preview: "offscreen-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("mixed-camera-targets-rendered-status", status);

  if (!status.readback?.ok || !status.mixedCameraTargets?.canvasReadback?.ok) {
    test.skip(true, "Mixed camera target pixel assertion requires readback.");
    return;
  }

  const canvasSample = status.mixedCameraTargets.canvasReadback.samples?.find(
    (entry) => entry.id === "canvas-direct-left",
  );
  const previewSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-preview-center",
  );

  expect(canvasSample, "expected direct canvas sample").toBeDefined();
  expect(previewSample, "expected off-screen preview sample").toBeDefined();

  if (canvasSample === undefined || previewSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      canvasSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "left canvas sample should come from the current-texture camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      previewSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "right preview sample should come from the off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(canvasSample.pixel, previewSample.pixel),
    "mixed route should show distinct canvas and off-screen pixels",
  ).toBeGreaterThan(80);
});

test("multiple render targets route displays two distinct off-screen previews", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/multi-render-targets.html",
    "multi-render-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "multi-render-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
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
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    multiRenderTargets: {
      mode: "two-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("multi-render-targets-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Multiple render-target pixel assertion requires readback.");
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(leftSample, "expected primary render-target preview sample").toBeDefined();
  expect(
    rightSample,
    "expected secondary render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the secondary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "two displayed off-screen render targets should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, screenClearSample.pixel),
    "left preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(rightSample.pixel, screenClearSample.pixel),
    "right preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("render-target resize route displays the resized off-screen pass", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-resize.html",
    "render-target-resize-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-resize",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 384,
      height: 384,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    renderTargetResize: {
      mode: "renderer-owned-render-target-resize",
      reason: "route-config-canvas-resize-simulation",
      renderTargetKey: status.renderTarget?.key,
      before: { width: 128, height: 128 },
      after: { width: 384, height: 384 },
      reusedHandle: true,
      textureRecreated: true,
      previousTextureDestroyed: true,
      staleSizeGuard: "source-assets-markReady-before-render",
    },
    sourceView: {
      ok: true,
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
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
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: status.renderTarget?.key,
      width: 384,
      height: 384,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-resize-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-target resize pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(sample, "expected resized render-target preview sample").toBeDefined();
  expect(
    screenClearSample,
    "expected resized route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "resized target preview should retain the rendered plane color",
  ).toBeLessThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "resized target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("render-target reuse route displays the second snapshot through one off-screen target", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-reuse.html",
    "render-target-reuse-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-reuse",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
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
    renderTargetReuseStress: {
      mode: "same-render-target-two-worker-snapshots",
      renderTargetKey: status.renderTarget?.key,
      framesRequested: 2,
      framesRendered: 2,
      displayedFrame: 2,
      reusedHandle: true,
      textureRecreated: false,
      targetResourcePressure: {
        createdTextures: 1,
        reusedTextures: 1,
        stableDimensions: true,
      },
      frames: [
        {
          frame: 1,
          workerVariant: "left-clear-center",
          centerExpectation: "offscreen-clear",
          renderTargetKey: status.renderTarget?.key,
          width: 256,
          height: 256,
          drawCalls: 1,
          diagnostics: 0,
        },
        {
          frame: 2,
          workerVariant: "center-plane",
          centerExpectation: "plane",
          renderTargetKey: status.renderTarget?.key,
          width: 256,
          height: 256,
          drawCalls: 1,
          diagnostics: 0,
        },
      ],
      staleFirstFrameStatus: false,
    },
    sourceView: {
      ok: true,
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
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
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
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

  await attachExampleStatus("render-target-reuse-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-target reuse pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(sample, "expected reused render-target preview sample").toBeDefined();
  expect(
    screenClearSample,
    "expected reuse route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "reused target preview should show the second centered snapshot",
  ).toBeLessThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "reused target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});
