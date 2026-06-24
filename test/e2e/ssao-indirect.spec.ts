import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface SsaoIndirectStatus extends ExampleStatusBase {
  readonly ssao?: {
    readonly enabled: boolean;
    readonly appliesTo: string;
    readonly msaaSampleCount: number;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly extraction?: {
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

interface SsaoIndirectFrame {
  readonly status: SsaoIndirectStatus;
  readonly samples: Map<string, RgbaPixel>;
}

test("ssao-indirect darkens indirect-lit creases while preserving emissive", async ({
  page,
}) => {
  const off = await loadSsaoIndirect(page, "off");
  const on = await loadSsaoIndirect(page, "on");

  // (Done-when #2) Status reports SSAO applies to indirect, and the lit pass
  // emitted its indirect color channel (the standard pipeline uses the
  // indirect-channel shader variant).
  expect(on.status.ssao).toMatchObject({
    enabled: true,
    appliesTo: "indirect",
  });
  expect(on.status.pipeline?.cacheKey ?? "").toContain("indirect-channel");
  expect(off.status.pipeline?.cacheKey ?? "").not.toContain("indirect-channel");

  const creaseOff = off.samples.get("crease")!;
  const creaseOn = on.samples.get("crease")!;
  const cornerOff = off.samples.get("corner")!;
  const cornerOn = on.samples.get("corner")!;
  const cubeOff = off.samples.get("cube-face")!;
  const cubeOn = on.samples.get("cube-face")!;

  const creaseDelta = pixelDistance(creaseOff, creaseOn);
  const cornerDelta = pixelDistance(cornerOff, cornerOn);
  const cubeDelta = pixelDistance(cubeOff, cubeOn);

  // The emissive cube probe must actually be emissive (warm: r > b) so the
  // "emissive preserved" assertion is meaningful.
  expect(
    cubeOff.r - cubeOff.b,
    `cube-face probe should be emissive/warm; got ${JSON.stringify(cubeOff)}`,
  ).toBeGreaterThan(40);

  // (Done-when #1) Indirect-lit diffuse creases darken under SSAO...
  expect(
    creaseDelta,
    `diffuse crease should darken under SSAO; off=${JSON.stringify(creaseOff)} on=${JSON.stringify(creaseOn)}`,
  ).toBeGreaterThan(6);
  expect(creaseOn.r + creaseOn.g + creaseOn.b).toBeLessThan(
    creaseOff.r + creaseOff.g + creaseOff.b,
  );

  // ...and the emissive cube (also in a high-AO pocket) is preserved: AO touches
  // indirect light only, so the emissive probe barely changes — far less than
  // the diffuse crease. The old whole-image multiply would have darkened it
  // comparably to the crease.
  expect(
    cubeDelta,
    `emissive cube should be preserved under SSAO; off=${JSON.stringify(cubeOff)} on=${JSON.stringify(cubeOn)}`,
  ).toBeLessThan(8);
  expect(
    creaseDelta,
    `crease darkening (${creaseDelta}) should dwarf emissive change (${cubeDelta})`,
  ).toBeGreaterThan(cubeDelta + 4);

  // The corner crease also darkens (a second indirect-dominated probe).
  expect(
    cornerDelta,
    `corner crease should darken; ${cornerDelta}`,
  ).toBeGreaterThan(10);
});

async function loadSsaoIndirect(
  page: Page,
  mode: "on" | "off",
): Promise<SsaoIndirectFrame> {
  await page.goto(`/examples/ssao-indirect.html?ssao=${mode}`);

  const initialStatus = await waitForExampleStatus<SsaoIndirectStatus>(page);

  expect(initialStatus, `ssao-indirect ${mode} status publishes`).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`ssao-indirect ${mode} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction(() => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: SsaoIndirectStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && status.readback?.ok === true;
  });

  const status = await waitForExampleStatus<SsaoIndirectStatus>(page);

  if (status === undefined) {
    throw new Error(`ssao-indirect ${mode} status disappeared.`);
  }

  await attachExampleStatus(`ssao-indirect-${mode}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ssao-indirect",
    ok: true,
    extraction: { diagnostics: 0 },
  });

  const samples = new Map<string, RgbaPixel>();

  for (const sample of status.readback?.samples ?? []) {
    samples.set(sample.id, sample.pixel);
  }

  for (const id of ["cube-face", "crease", "corner", "open-floor"]) {
    if (!samples.has(id)) {
      throw new Error(`ssao-indirect ${mode} missing readback sample ${id}.`);
    }
  }

  return { status, samples };
}
