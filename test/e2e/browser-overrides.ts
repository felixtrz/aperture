import type { Page } from "@playwright/test";

type BrowserOverrideGlobal = typeof globalThis & {
  readonly __APERTURE_GPU_OVERRIDE_WORKED__?: boolean;
  readonly __APERTURE_BUFFER_USAGE_OVERRIDE_WORKED__?: boolean;
  readonly __APERTURE_MAP_MODE_OVERRIDE_WORKED__?: boolean;
};

export async function installMissingNavigatorGpuOverride(
  page: Page,
): Promise<void> {
  await page.addInitScript(() => {
    let overrideWorked: boolean;

    try {
      Object.defineProperty(Navigator.prototype, "gpu", {
        configurable: true,
        get: () => undefined,
      });
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: undefined,
      });
      overrideWorked = navigator.gpu === undefined;
    } catch {
      overrideWorked = false;
    }

    Object.defineProperty(globalThis, "__APERTURE_GPU_OVERRIDE_WORKED__", {
      configurable: true,
      value: overrideWorked,
    });
  });
}

export async function installMissingGpuBufferUsageOverride(
  page: Page,
): Promise<void> {
  await page.addInitScript(() => {
    let overrideWorked: boolean;
    const webGpuGlobal = globalThis as typeof globalThis & {
      GPUBufferUsage?: unknown;
    };

    try {
      Object.defineProperty(webGpuGlobal, "GPUBufferUsage", {
        configurable: true,
        value: undefined,
      });
      overrideWorked = webGpuGlobal.GPUBufferUsage === undefined;
    } catch {
      overrideWorked = false;
    }

    Object.defineProperty(
      globalThis,
      "__APERTURE_BUFFER_USAGE_OVERRIDE_WORKED__",
      {
        configurable: true,
        value: overrideWorked,
      },
    );
  });
}

export async function installMissingGpuMapModeOverride(
  page: Page,
): Promise<void> {
  await page.addInitScript(() => {
    let overrideWorked: boolean;
    const webGpuGlobal = globalThis as typeof globalThis & {
      GPUMapMode?: unknown;
    };

    try {
      Object.defineProperty(webGpuGlobal, "GPUMapMode", {
        configurable: true,
        value: undefined,
      });
      overrideWorked = webGpuGlobal.GPUMapMode === undefined;
    } catch {
      overrideWorked = false;
    }

    Object.defineProperty(globalThis, "__APERTURE_MAP_MODE_OVERRIDE_WORKED__", {
      configurable: true,
      value: overrideWorked,
    });
  });
}

export async function didMissingNavigatorGpuOverrideWork(
  page: Page,
): Promise<boolean> {
  return page.evaluate(
    () =>
      (globalThis as BrowserOverrideGlobal).__APERTURE_GPU_OVERRIDE_WORKED__ ===
      true,
  );
}

export async function didMissingGpuBufferUsageOverrideWork(
  page: Page,
): Promise<boolean> {
  return page.evaluate(
    () =>
      (globalThis as BrowserOverrideGlobal)
        .__APERTURE_BUFFER_USAGE_OVERRIDE_WORKED__ === true,
  );
}

export async function didMissingGpuMapModeOverrideWork(
  page: Page,
): Promise<boolean> {
  return page.evaluate(
    () =>
      (globalThis as BrowserOverrideGlobal)
        .__APERTURE_MAP_MODE_OVERRIDE_WORKED__ === true,
  );
}
