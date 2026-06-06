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

interface UiInteractionStatus extends ExampleStatusBase {
  readonly domListeners: boolean;
  readonly scene: {
    readonly ui: EntityRef | null;
    readonly blockedMesh: EntityRef | null;
  };
  readonly interaction: {
    readonly counts: {
      readonly uiEnter: number;
      readonly uiDown: number;
      readonly uiUp: number;
      readonly uiClick: number;
      readonly meshClick: number;
    };
    readonly hoveredEntity: EntityRef | null;
    readonly clickPoint: readonly [number, number, number] | null;
    readonly blocks3dPick: boolean;
  };
}

test("browser route proves UI click blocks a 3D pick behind it", async ({
  page,
}) => {
  await page.goto("/examples/ui-interaction.html");
  const status = await waitForExampleStatus<UiInteractionStatus>(page);

  await attachExampleStatus("ui-interaction-status", status);
  expect(status, "ui-interaction status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ui-interaction",
    ok: true,
    phase: "ready",
    domListeners: false,
    interaction: {
      counts: {
        uiEnter: 1,
        uiDown: 1,
        uiUp: 1,
        uiClick: 1,
        meshClick: 0,
      },
      blocks3dPick: true,
    },
  });
  expect(status.scene.ui).not.toBeNull();
  expect(status.scene.blockedMesh).not.toBeNull();
  expect(status.interaction.hoveredEntity).toEqual(status.scene.ui);
  expect(status.interaction.clickPoint).not.toBeNull();
});
