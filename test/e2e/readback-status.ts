import { expect } from "@playwright/test";

import type {
  ClearReadbackStatus,
  SceneReadbackStatus,
} from "./example-status-types.js";

export function expectClearReadbackStatus(
  readback: ClearReadbackStatus | undefined,
  statusJson: string,
): void {
  expect(readback, statusJson).toBeDefined();

  if (readback === undefined) {
    return;
  }

  if (readback.ok) {
    expect(readback.source, statusJson).toBe("current-texture");
    expect(readback.format, statusJson).toMatch(/^(bgra|rgba)8unorm(-srgb)?$/u);
    expect(readback.bytesPerRow, statusJson).toBe(256);
    expect(readback.origin.x, statusJson).toBeGreaterThanOrEqual(0);
    expect(readback.origin.y, statusJson).toBeGreaterThanOrEqual(0);
    expect(readback.pixel, statusJson).toEqual({
      r: expect.any(Number),
      g: expect.any(Number),
      b: expect.any(Number),
      a: expect.any(Number),
    });
    return;
  }

  expect(readback.reason, statusJson).toEqual(expect.any(String));
  expect(readback.message, statusJson).toEqual(expect.any(String));
  expect(readback.clearOk, statusJson).toBe(true);
}

export function expectSceneReadbackStatus(
  readback: SceneReadbackStatus | undefined,
  expectedSamples: number,
  statusJson: string,
): void {
  expect(readback, statusJson).toBeDefined();

  if (readback === undefined) {
    return;
  }

  if (readback.ok) {
    expect(readback.source, statusJson).toBe("current-texture");
    expect(readback.format, statusJson).toMatch(/^(bgra|rgba)8unorm(-srgb)?$/u);
    expect(readback.bytesPerRow, statusJson).toBe(256);
    expect(readback.samples, statusJson).toHaveLength(expectedSamples);

    for (const sample of readback.samples) {
      expect(sample.id, statusJson).toEqual(expect.any(String));
      expect(sample.origin.x, statusJson).toBeGreaterThanOrEqual(0);
      expect(sample.origin.y, statusJson).toBeGreaterThanOrEqual(0);
      expect(sample.pixel, statusJson).toEqual({
        r: expect.any(Number),
        g: expect.any(Number),
        b: expect.any(Number),
        a: expect.any(Number),
      });
    }
    return;
  }

  expect(readback.reason, statusJson).toEqual(expect.any(String));
  expect(readback.message, statusJson).toEqual(expect.any(String));
  expect(readback.clearOk, statusJson).toBe(true);
}
