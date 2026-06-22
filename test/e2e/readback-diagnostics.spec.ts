import { expect, test } from "@playwright/test";

import {
  didMissingGpuBufferUsageOverrideWork,
  didMissingGpuMapModeOverrideWork,
  installMissingGpuBufferUsageOverride,
  installMissingGpuMapModeOverride,
} from "./browser-overrides.js";
import type { ClearExampleStatus } from "./example-status-types.js";
import { loadExampleStatus } from "./webgpu-status.js";

test("WebGPU clear example reports readback diagnostics when buffer usage flags are unavailable", async ({
  page,
}) => {
  await installMissingGpuBufferUsageOverride(page);

  const status = await loadExampleStatus<ClearExampleStatus>(
    page,
    "/",
    "webgpu-clear-readback-diagnostic-status",
  );

  const overrideWorked = await didMissingGpuBufferUsageOverrideWork(page);

  test.skip(
    !overrideWorked,
    "The browser did not allow GPUBufferUsage to be overridden before example startup.",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu-explicit",
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

  const status = await loadExampleStatus<ClearExampleStatus>(
    page,
    "/",
    "webgpu-clear-map-mode-diagnostic-status",
  );

  const overrideWorked = await didMissingGpuMapModeOverrideWork(page);

  test.skip(
    !overrideWorked,
    "The browser did not allow GPUMapMode to be overridden before example startup.",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "webgpu-clear",
    ok: true,
    phase: "clear",
    renderingBackend: "webgpu-explicit",
    readback: {
      ok: false,
      reason: "map-mode-unavailable",
      clearOk: true,
    },
  });
});
