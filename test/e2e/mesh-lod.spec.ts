import { expect, test, type Page } from "@playwright/test";

import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MeshLodStatus extends ExampleStatusBase {
  readonly rockCount?: number;
  readonly farDistance?: number;
  readonly hysteresis?: number;
  readonly lodByLabel?: Record<string, readonly number[] | null>;
  readonly labels?: readonly string[];
  readonly distributionShifts?: boolean;
  readonly noPopping?: boolean;
  readonly lodDiagnostics?: readonly string[];
}

// E2 (three.js parity plan, THREE.LOD analog): a field of LOD'd rocks. As the
// worker dollies the camera the LOD subsystem selects a level per rock in
// extraction and overrides the drawn mesh handle. The per-level draw
// distribution rides `report.lod.levels`. This asserts, straight from that
// frame report: (1) the distribution shifts from all-high-detail (near) to
// all-low-detail (far), and (2) two camera nudges that straddle the raw
// threshold but stay inside the hysteresis band report the IDENTICAL
// distribution — no popping.
test("browser selects mesh-LOD levels by camera distance with a no-pop hysteresis band", async ({
  page,
}: {
  page: Page;
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/examples/mesh-lod.html");

  const status = await waitForExampleStatus<MeshLodStatus>(page);
  await attachExampleStatus("mesh-lod-status", status);
  expect(status, "status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mesh-lod",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
  });

  expect(status.lodDiagnostics ?? []).toEqual([]);
  const rockCount = status.rockCount ?? 0;
  expect(rockCount).toBeGreaterThan(0);

  const lodByLabel = status.lodByLabel ?? {};
  const near = lodByLabel["near"];
  const far = lodByLabel["far"];
  const bandA = lodByLabel["band-a"];
  const bandB = lodByLabel["band-b"];

  expect(near, "near histogram present").toBeDefined();
  expect(far, "far histogram present").toBeDefined();

  // 1) Draw-count shift with distance: near, every rock draws its highest-detail
  // level (level 0); far, every rock draws its lowest-detail level (last index).
  expect(near, "near: every rock high-detail").toEqual([rockCount, 0]);
  expect(far, "far: every rock low-detail").toEqual([0, rockCount]);
  expect((near ?? [])[0] ?? 0, "more high-detail draws near").toBeGreaterThan(
    (far ?? [])[0] ?? 0,
  );
  expect((far ?? [])[1] ?? 0, "more low-detail draws far").toBeGreaterThan(
    (near ?? [])[1] ?? 0,
  );

  // 2) No popping within the hysteresis band: the two band frames straddle the
  // raw threshold (their camera distances sit on opposite sides of it) yet
  // report the IDENTICAL level distribution, so the band suppressed the switch.
  expect(bandA, "band-a histogram present").toBeDefined();
  expect(bandB, "band-b histogram present").toBeDefined();
  expect(bandA, "no popping across the hysteresis band").toEqual(bandB);
  expect(status.noPopping, "no-popping flag").toBe(true);
  expect(status.distributionShifts, "distribution-shift flag").toBe(true);

  await page.evaluate(() => {
    const stop = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_MESH_LOD_STOP__?: () => void;
      }
    ).__APERTURE_MESH_LOD_STOP__;
    stop?.();
  });
  webGpuValidation.expectNoWarnings();
  await page.close({ runBeforeUnload: false });
});
