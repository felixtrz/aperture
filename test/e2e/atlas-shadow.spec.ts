import { expect, test } from "@playwright/test";

import {
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface Region {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

interface AtlasShadowStatus extends ExampleStatusBase {
  readonly atlas?: {
    readonly sharedTexture: number;
    readonly subRegions: readonly Region[];
    readonly dropped: readonly number[];
  };
  readonly regions?: readonly {
    readonly shadowId: number;
    readonly writtenTexels: number;
  }[];
  readonly scheduler?: {
    readonly frame1Rendered: readonly number[];
    readonly frame2Rendered: readonly number[];
    readonly staticLightSkippedAfterFirstFrame: boolean;
  };
}

// M4-T9 proof: two shadow-casting lights share ONE atlas depth texture (the
// deterministic packer assigns non-overlapping sub-regions), both shadows are
// rendered (written) into their sub-rects, and an 'once' static light's caster
// pass is skipped after the first frame.
test("M4-T9: two lights share one atlas texture (2 sub-regions) and a static light skips re-render", async ({
  page,
}) => {
  await page.goto("/examples/atlas-shadow.html");
  const status = await waitForExampleStatus<AtlasShadowStatus>(page);
  expect(status, "atlas-shadow status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);

  // One shared atlas texture holding two non-overlapping sub-regions.
  expect(status.atlas?.sharedTexture).toBe(1);
  expect(status.atlas?.subRegions).toHaveLength(2);
  expect(status.atlas?.dropped).toEqual([]);
  expect(
    overlaps(status.atlas!.subRegions[0]!, status.atlas!.subRegions[1]!),
  ).toBe(false);

  // Both lights' shadows are visible (written depth) in their atlas sub-regions.
  expect(status.regions).toHaveLength(2);
  for (const region of status.regions ?? []) {
    expect(
      region.writtenTexels,
      `shadow ${region.shadowId} should be rendered into its atlas region`,
    ).toBeGreaterThan(0);
  }

  // The 'once' static light renders on frame 1 then is skipped (its caster-pass
  // draw count drops to 0 on the next frame while its region stays valid).
  expect(status.scheduler?.frame1Rendered).toEqual(
    expect.arrayContaining([1, 2]),
  );
  expect(status.scheduler?.frame2Rendered).toEqual([1]);
  expect(status.scheduler?.staticLightSkippedAfterFirstFrame).toBe(true);

  await page.goto("about:blank");
});

function overlaps(a: Region, b: Region): boolean {
  return (
    a.originX < b.originX + b.width &&
    a.originX + a.width > b.originX &&
    a.originY < b.originY + b.height &&
    a.originY + a.height > b.originY
  );
}
