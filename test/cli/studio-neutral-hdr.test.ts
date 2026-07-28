import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";

import { parseHdrRgbe } from "@aperture-engine/render";
import { createStudioNeutralHdr } from "../../packages/cli/src/create/templates/studio-neutral-hdr.js";
import { createStudioNeutralHdr as createReferenceStudioNeutralHdr } from "../../packages/reference-assets/scripts/studio-neutral-hdr.mjs";

describe("neutral studio reference environment", () => {
  it("is deterministic, compact, valid RGBE, and contains directional range", () => {
    const first = createStudioNeutralHdr();
    const second = createStudioNeutralHdr();
    const parsed = parseHdrRgbe(first);

    expect(first).toEqual(second);
    expect(first).toEqual(new Uint8Array(createReferenceStudioNeutralHdr()));
    expect(first.byteLength).toBeLessThanOrEqual(512 * 1024);
    expect(gzipSync(first).byteLength).toBeLessThanOrEqual(512 * 1024);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.image).toMatchObject({
      width: 32,
      height: 16,
      colorSpace: "linear",
      format: "rgba32float",
    });
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = 0;
    for (let index = 0; index < parsed.image.data.length; index += 4) {
      const luminance =
        (parsed.image.data[index] ?? 0) * 0.2126 +
        (parsed.image.data[index + 1] ?? 0) * 0.7152 +
        (parsed.image.data[index + 2] ?? 0) * 0.0722;
      minimum = Math.min(minimum, luminance);
      maximum = Math.max(maximum, luminance);
    }

    expect(minimum).toBeGreaterThan(0.1);
    expect(maximum).toBeGreaterThan(3);
    expect(maximum / minimum).toBeGreaterThan(10);
  });
});
