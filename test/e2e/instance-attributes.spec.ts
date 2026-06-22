import { expect, test } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface InstanceAttributesStatus extends ExampleStatusBase {
  readonly scenario?: string;
  readonly customMaterial?: {
    readonly family: string;
    readonly sourceMaterialKey: string;
    readonly materialResourceKey: string;
    readonly pipelineKey: string;
    readonly bindGroupResourceKey: string;
    readonly validationDiagnostics: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly scene?: {
      readonly instanceCount: number;
      readonly grid: { readonly columns: number; readonly rows: number };
      readonly meshKey: string;
      readonly materialKey: string;
      readonly materialFamily: string;
    };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
    readonly instanceAttributePackets: number;
    readonly instanceAttributeFloats: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command?: {
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
  readonly instanceAttributes?: {
    readonly layoutKey: string;
    readonly attributes: readonly {
      readonly name: string;
      readonly format: string;
      readonly shaderLocation: number;
    }[];
    readonly strideFloats: number;
    readonly packedFloats: number;
    readonly offsets: number;
    readonly diagnostics: number;
    readonly vertexCount: number;
  };
  readonly submission?: {
    readonly commandBuffers: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly animation?: {
    readonly frame: number;
    readonly sampleHistory: readonly {
      readonly frame: number;
      readonly shaderTime: number;
      readonly samples: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    }[];
  };
  readonly readback?: { readonly ok: boolean };
}

test("custom WGSL consumes per-instance attributes in a visible instanced swarm", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const firstStatus = await loadExampleStatus<InstanceAttributesStatus>(
    page,
    "/examples/instance-attributes.html",
    "instance-attributes-initial-status",
  );

  if (firstStatus === undefined) {
    return;
  }

  await page.waitForFunction(
    () => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: InstanceAttributesStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        (status.animation?.frame ?? 0) >= 5 &&
        (status.animation?.sampleHistory.length ?? 0) >= 3
      );
    },
    undefined,
    { timeout: 15000 },
  );

  const status = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: InstanceAttributesStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );

  await attachExampleStatus("instance-attributes-animated-status", status);
  expect(
    status,
    "instance attributes status should be published",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "instance-attributes",
    scenario: "custom-wind-sway",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    customMaterial: {
      family: "example/wind",
      sourceMaterialKey: "material:instance-attributes-wind-material",
      materialResourceKey: "material:instance-attributes-wind-material",
      validationDiagnostics: 0,
      diagnostics: 0,
    },
    worker: {
      scene: {
        instanceCount: 576,
        grid: { columns: 24, rows: 24 },
        meshKey: "mesh:instance-attributes-blade",
        materialKey: "material:instance-attributes-wind-material",
        materialFamily: "example/wind",
      },
    },
    extraction: {
      views: 1,
      meshDraws: 576,
      diagnostics: 0,
      instanceAttributePackets: 576,
      instanceAttributeFloats: 1152,
    },
    draw: {
      packages: 576,
      descriptors: 576,
      drawList: 1,
      resolved: 1,
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    instanceAttributes: {
      attributes: [
        { name: "phase", format: "float32", shaderLocation: 6 },
        { name: "swayAmount", format: "float32", shaderLocation: 7 },
      ],
      strideFloats: 2,
      packedFloats: 1152,
      offsets: 576,
      diagnostics: 0,
      vertexCount: 576,
    },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    readback: { ok: true },
  });
  expect(status.customMaterial?.pipelineKey).toContain("example/wind|shader:");
  expect(status.customMaterial?.pipelineKey).toContain("instance-attributes:");
  expect(status.submission?.drawCalls ?? 999).toBeLessThanOrEqual(
    (status.worker?.scene?.instanceCount ?? 0) / 16,
  );

  const history = status.animation?.sampleHistory ?? [];
  const firstFrame = history[0];
  const lastFrame = history.at(-1);

  expect(firstFrame, "expected first readback frame").toBeDefined();
  expect(lastFrame, "expected later readback frame").toBeDefined();

  if (firstFrame === undefined || lastFrame === undefined) {
    return;
  }

  expect(lastFrame.frame).toBeGreaterThan(firstFrame.frame);
  expect(lastFrame.shaderTime).toBeGreaterThan(firstFrame.shaderTime);
  expect(firstFrame.samples.map((sample) => sample.id).sort()).toEqual([
    "center-wave",
    "left-wave",
    "right-wave",
  ]);

  for (const firstSample of firstFrame.samples) {
    const lastSample = lastFrame.samples.find(
      (candidate) => candidate.id === firstSample.id,
    );

    expect(
      lastSample,
      `${firstSample.id} should be sampled in the later frame`,
    ).toBeDefined();

    if (lastSample === undefined) {
      continue;
    }

    expect(
      pixelDistance(firstSample.pixel, lastSample.pixel),
      `${firstSample.id} should animate via per-instance attributes; first=${JSON.stringify(
        firstSample.pixel,
      )} last=${JSON.stringify(lastSample.pixel)}`,
    ).toBeGreaterThan(18);
  }

  guard.expectNoWarnings();
});
