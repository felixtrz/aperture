import { test, type Page } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";

type ExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

const unsupportedWebGpuReasons = new Set<string>([
  "navigator-gpu-unavailable",
  "adapter-unavailable",
  "device-request-failed",
  "context-unavailable",
  "device-lost",
]);

export async function waitForExampleStatus<T>(
  page: Page,
): Promise<T | undefined> {
  await page.waitForFunction(
    () =>
      (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__ !== undefined,
  );

  return page.evaluate(
    () => (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__ as T,
  );
}

export async function attachExampleStatus(
  name: string,
  status: unknown,
): Promise<void> {
  await test.info().attach(name, {
    body: JSON.stringify(status ?? null, null, 2),
    contentType: "application/json",
  });
}

export function skipIfUnsupportedWebGpu(status: ExampleStatusBase): void {
  if (
    !status.ok &&
    status.reason !== undefined &&
    unsupportedWebGpuReasons.has(status.reason)
  ) {
    test.skip(
      true,
      `WebGPU unsupported in this browser: ${status.reason} - ${
        status.message ?? "no message"
      }`,
    );
  }
}
