import { expect, test } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MultiMaterialGroupsStatus extends ExampleStatusBase {
  readonly groupStatus?: {
    readonly ok: boolean;
    readonly meshDraws: number;
    readonly sameMesh: boolean;
    readonly groups: readonly {
      readonly submesh: number;
      readonly materialSlot: number;
      readonly meshKey: string;
      readonly materialKey: string;
      readonly vertexStart: number | null;
      readonly vertexCount: number | null;
      readonly indexStart: number | null;
      readonly indexCount: number | null;
    }[];
    readonly materialKeys: readonly string[];
    readonly indexStarts: readonly number[];
    readonly indexCounts: readonly number[];
  };
  readonly readbackStatus?: {
    readonly ok: boolean;
    readonly colorDelta: number;
    readonly leftFromClear: number;
    readonly rightFromClear: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly worker?: {
    readonly step?: {
      readonly meshDraws: number;
      readonly sameMesh: boolean;
      readonly diagnostics: number;
    };
  };
}

test("browser renders one mesh as two material-slot draw ranges", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/multi-material-groups.html");

  const status = await waitForExampleStatus<MultiMaterialGroupsStatus>(page);

  await attachExampleStatus("multi-material-groups-status", status);
  expect(status, "multi-material group status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "multi-material-groups",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    groupStatus: {
      ok: true,
      meshDraws: 2,
      sameMesh: true,
      materialKeys: [
        "material:multi-material-groups-left",
        "material:multi-material-groups-right",
      ],
      indexStarts: [0, 6],
      indexCounts: [6, 6],
    },
    counts: {
      meshDraws: 2,
      diagnostics: 0,
    },
    worker: {
      step: {
        meshDraws: 2,
        sameMesh: true,
        diagnostics: 0,
      },
    },
  });
  expect(status.groupStatus?.groups).toMatchObject([
    {
      submesh: 0,
      materialSlot: 0,
      vertexStart: 0,
      vertexCount: 4,
      indexStart: 0,
      indexCount: 6,
    },
    {
      submesh: 1,
      materialSlot: 1,
      vertexStart: 4,
      vertexCount: 4,
      indexStart: 6,
      indexCount: 6,
    },
  ]);
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.colorDelta ?? 0).toBeGreaterThan(60);
  webGpuValidation.expectNoWarnings();
});
