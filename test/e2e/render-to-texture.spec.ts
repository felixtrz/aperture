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
    readonly quad?: {
      readonly source?: string;
      readonly vertexCount?: number;
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
      quad: {
        source: "off-screen render target",
        vertexCount: 6,
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

  const expected = rgbaColorToPixel(
    status.scene?.expectedCenterColor ?? { r: 0.06, g: 0.88, b: 0.22, a: 1 },
  );

  expect(
    pixelDistance(sample.pixel, expected),
    `canvas quad center should sample the off-screen render target; sample=${JSON.stringify(
      sample.pixel,
    )} expected=${JSON.stringify(expected)}`,
  ).toBeLessThan(80);
});
