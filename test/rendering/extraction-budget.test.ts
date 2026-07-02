import { describe, expect, it } from "vitest";
import {
  extractRenderSnapshot,
  packSnapshotTransforms,
} from "@aperture-engine/render";
import { buildExtractionScene } from "./fixtures/extraction-scene.js";

// AI-76 budget gate: runs under the normal `pnpm test` CI gate (the bench
// suites in *.bench.ts report timings but do not gate). The budgets are
// deliberately generous — they exist to catch catastrophic regressions
// (accidental O(n²), per-frame disk IO) deterministically, not to benchmark.
const BUDGET_ENTITY_COUNT = 2_000;
const FRAMES = 5;
// Documented budget: median extract+pack of a 2k-entity scene must stay under
// 250ms/frame even on slow shared CI runners (typically <10ms on dev machines).
const MEDIAN_FRAME_BUDGET_MS = 250;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// The min of several samples is the cleanest estimator of intrinsic cost for
// relative comparisons: it is immune to the GC/scheduler excursions that make
// mean/median comparisons flaky on loaded shared runners.
function min(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.min(...values);
}

function timeExtractAndPack(
  scene: ReturnType<typeof buildExtractionScene>,
  frame: number,
): number {
  const start = performance.now();
  const snapshot = extractRenderSnapshot(scene.world, scene.assets, { frame });
  packSnapshotTransforms(snapshot);
  return performance.now() - start;
}

describe("extraction frame budget (AI-76)", () => {
  it("extracts the synthetic scene with counts matching the constructed entities", () => {
    const scene = buildExtractionScene(BUDGET_ENTITY_COUNT);
    const snapshot = extractRenderSnapshot(scene.world, scene.assets, {
      frame: 1,
    });

    expect(snapshot.meshDraws).toHaveLength(BUDGET_ENTITY_COUNT);
    expect(snapshot.bounds).toHaveLength(BUDGET_ENTITY_COUNT);
    expect(snapshot.report).toMatchObject({
      views: 1,
      meshDraws: BUDGET_ENTITY_COUNT,
      bounds: BUDGET_ENTITY_COUNT,
      diagnostics: 0,
    });

    const packed = packSnapshotTransforms(snapshot);
    expect(packed.offsets).toHaveLength(BUDGET_ENTITY_COUNT);
    expect(packed.diagnostics).toEqual([]);
  });

  it("keeps median extract+pack time inside the documented frame budget", () => {
    const scene = buildExtractionScene(BUDGET_ENTITY_COUNT);
    // Warm up module-level lazy state once before measuring.
    timeExtractAndPack(scene, 0);

    const samples: number[] = [];
    for (let frame = 1; frame <= FRAMES; frame += 1) {
      samples.push(timeExtractAndPack(scene, frame));
    }

    expect(median(samples)).toBeLessThan(MEDIAN_FRAME_BUDGET_MS);
  });

  it("scales with scene size rather than fixed overhead", () => {
    const small = buildExtractionScene(100);
    const large = buildExtractionScene(10_000);

    // Warm up both paths, then compare min-estimators across several frames;
    // a 100x entity gap plus intrinsic-cost estimators makes the ordering
    // robust to scheduler jitter (the large scene does strictly more work, so
    // only timer noise on a near-zero small-scene min could invert it).
    timeExtractAndPack(small, 0);
    timeExtractAndPack(large, 0);

    const smallSamples: number[] = [];
    const largeSamples: number[] = [];
    for (let frame = 1; frame <= FRAMES; frame += 1) {
      smallSamples.push(timeExtractAndPack(small, frame));
      largeSamples.push(timeExtractAndPack(large, frame));
    }

    expect(min(largeSamples)).toBeGreaterThan(min(smallSamples));
  });

  it("scales sub-quadratically with entity count", () => {
    // Upper bound on growth: a 10x entity step may cost at most 40x time
    // (linear would be ~10x; an accidental O(n²) lands at ~100x). Compare
    // min-estimators, and floor the small scene at 0.5ms: a 200-entity
    // extract sits near timer resolution, where a 0.05ms floor left the 40x
    // budget inside CI jitter.
    const small = buildExtractionScene(200);
    const large = buildExtractionScene(2_000);

    timeExtractAndPack(small, 0);
    timeExtractAndPack(large, 0);

    const smallSamples: number[] = [];
    const largeSamples: number[] = [];
    for (let frame = 1; frame <= FRAMES; frame += 1) {
      smallSamples.push(timeExtractAndPack(small, frame));
      largeSamples.push(timeExtractAndPack(large, frame));
    }

    expect(min(largeSamples)).toBeLessThan(
      Math.max(min(smallSamples), 0.5) * 40,
    );
  });
});
