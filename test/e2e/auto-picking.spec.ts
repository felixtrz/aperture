import { expect, test } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

interface EntityRef {
  readonly index: number;
  readonly generation: number;
}

interface AutoPickingStatus extends ExampleStatusBase {
  readonly manualSpatialSetup: boolean;
  readonly scene: {
    readonly target: EntityRef | null;
    readonly decoy: EntityRef | null;
  };
  readonly picking: {
    readonly pointer: readonly [number, number];
    readonly ray: {
      readonly origin: readonly [number, number, number];
      readonly direction: readonly [number, number, number];
    };
    readonly hit: {
      readonly entity: EntityRef;
      readonly source: string;
      readonly distance: number;
      readonly point: readonly [number, number, number];
      readonly normal: readonly [number, number, number] | null;
      readonly uv: readonly [number, number] | null;
      readonly faceIndex: number | null;
      readonly submeshIndex: number | null;
      readonly materialSlot: number | null;
    } | null;
  };
}

test("Playwright proves app meshes populate the picking spatial index automatically", async ({
  page,
}) => {
  await page.goto("/examples/auto-picking.html");
  const status = await waitForExampleStatus<AutoPickingStatus>(page);

  await attachExampleStatus("auto-picking-status", status);
  expect(status, "auto-picking status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "auto-picking",
    ok: true,
    phase: "ready",
    manualSpatialSetup: false,
    picking: {
      pointer: [0.5, 0.5],
      hit: {
        source: "mesh-bvh",
      },
    },
  });
  expect(status.scene.target).not.toBeNull();
  expect(status.scene.decoy).not.toBeNull();
  expect(status.picking.hit).not.toBeNull();

  if (
    status.scene.target === null ||
    status.scene.decoy === null ||
    status.picking.hit === null
  ) {
    return;
  }

  expect(status.picking.hit.entity).toEqual(status.scene.target);
  expect(status.picking.hit.entity).not.toEqual(status.scene.decoy);
  expect(status.picking.hit.distance).toBeGreaterThan(0);
  expect(status.picking.hit.point[0]).toBeCloseTo(0);
  expect(status.picking.hit.point[1]).toBeCloseTo(0);
  expect(status.picking.hit.point[2]).toBeCloseTo(0);
  expect(status.picking.hit.normal).toEqual([0, 0, 1]);
  expect(status.picking.hit.uv?.[0]).toBeCloseTo(0.5);
  expect(status.picking.hit.uv?.[1]).toBeCloseTo(0.5);
  expect(status.picking.hit.faceIndex).not.toBeNull();
  expect(status.picking.hit.submeshIndex).toBe(0);
  expect(status.picking.hit.materialSlot).toBe(0);
});
