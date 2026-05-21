import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RenderPacketInspectorStatus extends ExampleStatusBase {
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly bounds: number;
    readonly diagnostics: number;
    readonly cullStats?: readonly {
      readonly tested: number;
      readonly culled: number;
      readonly included: number;
    }[];
  };
  readonly draw?: {
    readonly drawCalls: number;
  };
  readonly packetInspector?: {
    readonly counts: {
      readonly views: number;
      readonly meshDraws: number;
      readonly lights: number;
      readonly environments: number;
      readonly bounds: number;
      readonly diagnostics: number;
    };
    readonly handles: {
      readonly meshKeys: readonly string[];
      readonly materialKeys: readonly string[];
      readonly environmentMapKeys: readonly string[];
    };
    readonly views: readonly unknown[];
    readonly draws: readonly {
      readonly renderId: number;
      readonly meshKey: string;
      readonly materialKey: string;
      readonly sortKey: {
        readonly queue: string;
        readonly pipelineKey: string;
        readonly materialKey: string;
        readonly meshKey: string;
      };
      readonly batchKey: {
        readonly pipelineKey: string;
        readonly instanced: boolean;
      };
    }[];
    readonly lights: readonly unknown[];
    readonly environments: readonly {
      readonly handleKey: string | null;
      readonly intensity: number;
    }[];
    readonly bounds: readonly unknown[];
    readonly cullStats: readonly {
      readonly tested: number;
      readonly culled: number;
      readonly included: number;
    }[];
    readonly queueKeys: readonly {
      readonly renderId: number;
      readonly queue: string;
      readonly pipelineKey: string;
      readonly materialKey: string;
      readonly meshKey: string;
      readonly batchPipelineKey: string;
      readonly instanced: boolean;
    }[];
    readonly skippedEntities: {
      readonly visible?: {
        readonly status: string;
        readonly rendered: boolean;
        readonly skipped: boolean;
        readonly drawCount: number;
        readonly diagnosticCodes: readonly string[];
        readonly reasons: readonly string[];
      };
      readonly disabled?: {
        readonly status: string;
        readonly rendered: boolean;
        readonly skipped: boolean;
        readonly drawCount: number;
        readonly diagnosticCodes: readonly string[];
        readonly reasons: readonly string[];
      };
    };
    readonly diagnosticCodes: readonly string[];
  };
}

test("render packet inspector renders a worker snapshot and publishes packet tables", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/render-packet-inspector.html");

  const status = await waitForExampleStatus<RenderPacketInspectorStatus>(page);

  await attachExampleStatus("render-packet-inspector-status", status);
  expect(status, "render packet inspector status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-packet-inspector",
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    ok: true,
    phase: "inspect",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 1,
      environments: 1,
      bounds: 1,
      diagnostics: 1,
      cullStats: [{ tested: 121, culled: 120, included: 1 }],
    },
    draw: { drawCalls: 1 },
    packetInspector: {
      counts: {
        views: 1,
        meshDraws: 1,
        lights: 1,
        environments: 1,
        bounds: 1,
        diagnostics: 1,
      },
      handles: {
        meshKeys: ["mesh:render-packet-inspector-cube"],
        materialKeys: ["material:render-packet-inspector-unlit"],
        environmentMapKeys: ["environment-map:render-packet-inspector-studio"],
      },
      skippedEntities: {
        visible: {
          status: "rendered",
          rendered: true,
          skipped: false,
          drawCount: 1,
          diagnosticCodes: [],
          reasons: [],
        },
        disabled: {
          status: "skipped",
          rendered: false,
          skipped: true,
          drawCount: 0,
          diagnosticCodes: ["render.disabled"],
          reasons: ["disabled"],
        },
      },
      diagnosticCodes: ["render.disabled"],
      cullStats: [{ tested: 121, culled: 120, included: 1 }],
    },
  });

  expect(status.packetInspector?.views.length).toBe(1);
  expect(status.packetInspector?.draws.length).toBe(1);
  expect(status.packetInspector?.lights.length).toBe(1);
  expect(status.packetInspector?.environments.length).toBe(1);
  expect(status.packetInspector?.bounds.length).toBe(1);
  expect(status.packetInspector?.queueKeys).toEqual([
    {
      renderId: status.packetInspector?.draws[0]?.renderId,
      queue: "opaque",
      pipelineKey: "",
      materialKey: "material:render-packet-inspector-unlit",
      meshKey: "mesh:render-packet-inspector-cube",
      batchPipelineKey: "unlit|opaque|back|less|none",
      instanced: false,
    },
  ]);
  expect(status.packetInspector?.draws[0]).toMatchObject({
    meshKey: "mesh:render-packet-inspector-cube",
    materialKey: "material:render-packet-inspector-unlit",
    sortKey: {
      queue: "opaque",
      pipelineKey: "",
      materialKey: "material:render-packet-inspector-unlit",
      meshKey: "mesh:render-packet-inspector-cube",
    },
    batchKey: {
      pipelineKey: "unlit|opaque|back|less|none",
      instanced: false,
    },
  });
  expect(status.packetInspector?.environments[0]).toMatchObject({
    handleKey: "environment-map:render-packet-inspector-studio",
  });
  expect(status.packetInspector?.environments[0]?.intensity ?? 0).toBeCloseTo(
    0.35,
    5,
  );

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const center = readPngPixel(screenshot, 0.5, 0.5);
  const clear =
    status.clearColor === undefined
      ? { r: 5, g: 7, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);

  await test.info().attach("render-packet-inspector.png", {
    body: screenshot,
    contentType: "image/png",
  });
  expect(
    pixelDistance(center, clear),
    `center pixel should differ from clear color; center=${JSON.stringify(
      center,
    )} clear=${JSON.stringify(clear)}`,
  ).toBeGreaterThan(36);

  guard.expectNoWarnings();
});
