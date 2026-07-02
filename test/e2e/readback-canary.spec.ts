import { expect, test } from "@playwright/test";

import type { ClearExampleStatus } from "./example-status-types.js";
import { attachExampleStatus, loadExampleStatus } from "./webgpu-status.js";

// Canary for the skip allowlist. scripts/check-e2e-skips.mjs allows
// "requires readback" skips because some environments genuinely lack GPU
// readback — but that means a regression in readback support itself would
// turn every pixel assertion in the suite into a silent skip and CI would
// stay green forever. The canonical CI renderer (SwiftShader + headed
// Chrome, docs/RENDER_CONTROL.md) DOES support readback, so under CI this
// test hard-fails when readback is gone instead of letting the suite skip.
test("GPU readback stays available on the canonical CI renderer", async ({
  page,
}) => {
  const status = await loadExampleStatus<ClearExampleStatus>(
    page,
    "/",
    "readback-canary-status",
  );

  if (status === undefined) {
    return;
  }

  await attachExampleStatus("readback-canary-readback", status.readback);

  if (process.env.CI === "true") {
    expect(
      status.readback?.ok,
      "GPU readback must stay available under the canonical CI renderer. " +
        "If this fails, every 'requires readback' pixel assertion in the " +
        "suite is silently skipping (see scripts/check-e2e-skips.mjs).",
    ).toBe(true);
    return;
  }

  test.info().annotations.push({
    type: "readback-availability",
    description: String(status.readback?.ok ?? false),
  });
});
