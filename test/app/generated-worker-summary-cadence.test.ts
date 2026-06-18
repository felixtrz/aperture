import { describe, expect, it } from "vitest";
import {
  createGeneratedWorkerSummaryCadence,
  DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS,
} from "../../packages/app/src/worker/snapshot.js";

describe("generated worker summary cadence", () => {
  it("rate-limits full worker summaries by elapsed time instead of frame count", () => {
    const cadence = createGeneratedWorkerSummaryCadence({
      intervalMilliseconds: 500,
    });

    expect(cadence.shouldPublishFull(0, 10)).toBe(true);
    expect(cadence.shouldPublishFull(30, 10.125)).toBe(false);
    expect(cadence.shouldPublishFull(120, 10.499)).toBe(false);
    expect(cadence.shouldPublishFull(121, 10.5)).toBe(true);
  });

  it("resets when worker time moves backward", () => {
    const cadence = createGeneratedWorkerSummaryCadence({
      intervalMilliseconds: 500,
    });

    expect(cadence.shouldPublishFull(0, 10)).toBe(true);
    expect(cadence.shouldPublishFull(1, 9.5)).toBe(true);
  });

  it("defaults to the previous 60hz thirty-frame cadence in milliseconds", () => {
    const cadence = createGeneratedWorkerSummaryCadence();

    expect(cadence.intervalMilliseconds).toBe(
      DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS,
    );
    expect(DEFAULT_GENERATED_WORKER_FULL_SUMMARY_INTERVAL_MS).toBe(500);
  });
});
