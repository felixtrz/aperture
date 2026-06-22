import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface DepthAppOverlapStatus extends ExampleStatusBase {
  readonly pipelineKeys?: readonly string[];
  readonly queues?: readonly string[];
  readonly overlap?: {
    readonly expectedTopColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedRejectedColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly webGpuApp?: {
    readonly depthAttachment?: {
      readonly format: string;
      readonly attached: boolean;
      readonly width: number;
      readonly height: number;
      readonly opaquePipelineDepthWriteCount: number;
    };
  };
  readonly report?: {
    readonly depthAttachment?: DepthAppOverlapStatus["webGpuApp"] extends {
      readonly depthAttachment?: infer T;
    }
      ? T
      : never;
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

test("WebGPU app attaches depth and rejects later far inter-family draws", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<DepthAppOverlapStatus>(
    page,
    "/examples/depth-app-overlap.html",
    "depth-app-overlap-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "depth-app-overlap",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    queues: ["opaque", "opaque"],
    pipelineKeys: [
      "unlit|opaque|back|less|none",
      "standard|opaque|back|less|none",
    ],
    webGpuApp: {
      depthAttachment: {
        format: "depth24plus",
        attached: true,
        width: 960,
        height: 540,
        opaquePipelineDepthWriteCount: 2,
      },
    },
    report: {
      depthAttachment: {
        format: "depth24plus",
        attached: true,
        width: 960,
        height: 540,
        opaquePipelineDepthWriteCount: 2,
      },
    },
    counts: {
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
  });
  webGpuValidation.expectNoWarnings();

  await attachExampleStatus("depth-app-overlap-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Depth overlap pixel assertion requires readback.");
    return;
  }

  const centerSample = status.readback.samples?.find(
    (sample) => sample.id === "center",
  );

  expect(
    centerSample,
    `expected center GPU readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (centerSample === undefined) {
    return;
  }

  const expectedTop = rgbaColorToPixel(
    status.overlap?.expectedTopColor ?? { r: 0.16, g: 0.9, b: 0.32, a: 1 },
  );
  const expectedRejected = rgbaColorToPixel(
    status.overlap?.expectedRejectedColor ?? {
      r: 1,
      g: 0.08,
      b: 0.04,
      a: 1,
    },
  );

  expect(
    pixelDistance(centerSample.pixel, expectedTop),
    `near unlit draw should remain visible after later far standard draw; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(100);
  expect(
    pixelDistance(centerSample.pixel, expectedRejected),
    `far standard draw should fail depth test at the overlap center; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeGreaterThan(100);
});
