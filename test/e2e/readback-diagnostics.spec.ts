import { expect, test } from "@playwright/test";

import {
  didMissingGpuBufferUsageOverrideWork,
  didMissingGpuMapModeOverrideWork,
  installMissingGpuBufferUsageOverride,
  installMissingGpuMapModeOverride,
} from "./browser-overrides.js";
import type { ClearExampleStatus } from "./example-status-types.js";
import {
  attachExampleStatus,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

test("WebGPU clear example reports readback diagnostics when buffer usage flags are unavailable", async ({
  page,
}) => {
  await installMissingGpuBufferUsageOverride(page);

  await page.goto("/");

  const overrideWorked = await didMissingGpuBufferUsageOverrideWork(page);

  test.skip(
    !overrideWorked,
    "The browser did not allow GPUBufferUsage to be overridden before example startup.",
  );

  const status = await waitForExampleStatus<ClearExampleStatus>(page);

  await attachExampleStatus("webgpu-clear-readback-diagnostic-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu",
    readback: {
      ok: false,
      reason: "buffer-usage-unavailable",
      clearOk: true,
    },
  });
});

test("WebGPU clear example reports readback diagnostics when map mode flags are unavailable", async ({
  page,
}) => {
  await installMissingGpuMapModeOverride(page);

  await page.goto("/");

  const overrideWorked = await didMissingGpuMapModeOverrideWork(page);

  test.skip(
    !overrideWorked,
    "The browser did not allow GPUMapMode to be overridden before example startup.",
  );

  const status = await waitForExampleStatus<ClearExampleStatus>(page);

  await attachExampleStatus("webgpu-clear-map-mode-diagnostic-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu",
    readback: {
      ok: false,
      reason: "map-mode-unavailable",
      clearOk: true,
    },
  });
});
