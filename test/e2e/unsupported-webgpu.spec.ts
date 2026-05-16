import { expect, test } from "@playwright/test";

import {
  didMissingNavigatorGpuOverrideWork,
  installMissingNavigatorGpuOverride,
} from "./browser-overrides.js";
import type { ClearExampleStatus } from "./example-status-types.js";
import { attachExampleStatus, waitForExampleStatus } from "./webgpu-status.js";

test("WebGPU clear example reports missing navigator.gpu", async ({ page }) => {
  await installMissingNavigatorGpuOverride(page);

  await page.goto("/");

  const overrideWorked = await didMissingNavigatorGpuOverrideWork(page);

  test.skip(
    !overrideWorked,
    "The browser did not allow navigator.gpu to be overridden before example startup.",
  );

  const status = await waitForExampleStatus<ClearExampleStatus>(page);

  await attachExampleStatus("webgpu-clear-unsupported-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: false,
    phase: "initialize-webgpu",
    renderingBackend: "webgpu",
    reason: "navigator-gpu-unavailable",
  });
});
