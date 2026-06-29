import { expect, test, type Page } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface ParticleBurstsStatus extends ExampleStatusBase {
  readonly state?: string;
  readonly assets?: {
    readonly texture?: { readonly ready: boolean } | null;
    readonly effect?: {
      readonly ready: boolean;
      readonly runtimeFeatures?: {
        readonly version: number;
        readonly supportedFields: readonly string[];
        readonly partiallySupportedFields: readonly string[];
        readonly unsupportedFields: readonly string[];
        readonly diagnostics: readonly {
          readonly code: string;
          readonly field: string;
          readonly message: string;
        }[];
      };
    } | null;
  };
  readonly worker?: {
    readonly snapshots?: number;
    readonly particles?: {
      readonly maxActive: number;
      readonly maxPerFrame: number;
      readonly pending: number;
      readonly active: number;
      readonly enqueued: number;
      readonly promoted: number;
      readonly dropped: number;
      readonly rejectedNotReady: number;
      readonly rejectedInvalid: number;
    } | null;
  };
  readonly frame?: {
    readonly counts?: {
      readonly particleEmitters?: number;
      readonly drawCalls?: number;
      readonly diagnostics?: number;
    } | null;
    readonly particles?: {
      readonly emitters?: number;
      readonly liveParticles?: number;
      readonly texturedEmitters?: number;
      readonly textureResourcesCreated?: number;
      readonly textureResourcesReused?: number;
    } | null;
    readonly diagnosticCodes?: readonly string[];
  };
}

test("browser renders worker-emitted textured particle bursts", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/particle-bursts.html");

  const status = await waitForParticleBurstsStatus(page);

  await attachExampleStatus("particle-bursts-status", status);
  expect(status, "particle bursts status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "particle-bursts",
    ok: true,
    phase: "rendered",
    assets: {
      texture: { ready: true },
      effect: {
        ready: true,
        runtimeFeatures: {
          version: 2,
          supportedFields: expect.arrayContaining([
            "version",
            "label",
            "main",
            "emission",
            "renderer",
            "forceOverLifetime",
            "sizeOverLifetime",
            "colorOverLifetime",
          ]),
          partiallySupportedFields: [],
          unsupportedFields: [],
          diagnostics: [],
        },
      },
    },
    worker: {
      particles: {
        maxActive: 1024,
        maxPerFrame: 64,
        pending: expect.any(Number),
        active: expect.any(Number),
        enqueued: expect.any(Number),
        promoted: expect.any(Number),
        dropped: 0,
        rejectedNotReady: 0,
        rejectedInvalid: 0,
      },
    },
  });
  expect(status.worker?.snapshots ?? 0).toBeGreaterThan(0);
  expect(status.worker?.particles?.enqueued ?? 0).toBeGreaterThan(0);
  expect(status.worker?.particles?.promoted ?? 0).toBeGreaterThan(0);
  expect(status.worker?.particles?.active ?? 0).toBeGreaterThan(0);
  expect(status.frame?.counts?.particleEmitters ?? 0).toBeGreaterThan(0);
  expect(status.frame?.counts?.drawCalls ?? 0).toBeGreaterThan(0);
  expect(status.frame?.counts?.diagnostics ?? 0).toBe(0);
  expect(status.frame?.particles?.emitters ?? 0).toBeGreaterThan(0);
  expect(status.frame?.particles?.liveParticles ?? 0).toBeGreaterThan(0);
  expect(status.frame?.particles?.texturedEmitters ?? 0).toBeGreaterThan(0);
  expect(
    (status.frame?.particles?.textureResourcesCreated ?? 0) +
      (status.frame?.particles?.textureResourcesReused ?? 0),
  ).toBeGreaterThan(0);
  expect(status.frame?.diagnosticCodes ?? []).toEqual([]);

  webGpuValidation.expectNoWarnings();
});

async function waitForParticleBurstsStatus(
  page: Page,
): Promise<ParticleBurstsStatus | undefined> {
  await page.waitForFunction(
    () => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: ParticleBurstsStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true ||
        status?.state === "webgpu-failed" ||
        status?.state === "failed"
      );
    },
    undefined,
    { timeout: 20_000 },
  );

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: ParticleBurstsStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}
