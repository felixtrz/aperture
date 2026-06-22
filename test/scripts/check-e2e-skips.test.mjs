import { describe, expect, it } from "vitest";

import {
  ALLOWED_SKIP_REASON_PATTERNS,
  collectSkippedTests,
  evaluateSkips,
} from "../../scripts/check-e2e-skips.mjs";

function reportWith(tests) {
  return {
    suites: [
      {
        title: "example.spec.ts",
        file: "example.spec.ts",
        specs: tests.map((test, index) => ({
          title: test.title ?? `case ${index}`,
          file: "example.spec.ts",
          tests: [
            {
              annotations:
                test.reason === undefined
                  ? []
                  : [{ type: "skip", description: test.reason }],
              results: test.results ?? [{ status: test.status ?? "skipped" }],
            },
          ],
        })),
      },
    ],
  };
}

describe("check-e2e-skips", () => {
  it("collects only tests whose final result is skipped", () => {
    const report = reportWith([
      { title: "passes", status: "passed" },
      { title: "skips", status: "skipped", reason: "requires readback" },
      {
        title: "recovers on retry",
        results: [{ status: "skipped" }, { status: "passed" }],
      },
    ]);

    const skipped = collectSkippedTests(report);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({
      title: "example.spec.ts › skips",
      reason: "requires readback",
    });
  });

  it("walks nested suites", () => {
    const report = {
      suites: [
        {
          title: "outer.spec.ts",
          suites: [
            {
              title: "inner group",
              specs: [
                {
                  title: "skipped case",
                  file: "outer.spec.ts",
                  tests: [
                    {
                      annotations: [
                        {
                          type: "skip",
                          description:
                            "WebGPU is not available in this browser.",
                        },
                      ],
                      results: [{ status: "skipped" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { allowed, violations } = evaluateSkips(report);
    expect(allowed).toHaveLength(1);
    expect(allowed[0]?.title).toBe(
      "outer.spec.ts › inner group › skipped case",
    );
    expect(violations).toEqual([]);
  });

  it("accepts every documented environment-capability reason family", () => {
    const reasons = [
      "WebGPU is not available in this browser.",
      "WebGPU adapter is not available.",
      "Sphere primitive pixel assertion requires readback.",
      "GPU readback unavailable in this browser",
      "Current-texture readback returned transparent samples.",
      "GPU timestamp queries are unavailable in this browser.",
      "The browser did not allow GPUMapMode to be overridden before example startup.",
      "Headless Chromium screenshot did not provide a parseable canvas CSS background; center pixel was x.",
    ];

    for (const reason of reasons) {
      expect(
        ALLOWED_SKIP_REASON_PATTERNS.some((pattern) => pattern.test(reason)),
        reason,
      ).toBe(true);
    }
  });

  it("flags skips with unknown or missing reasons as violations", () => {
    const report = reportWith([
      { title: "mystery", reason: "the feature is broken today" },
      { title: "reasonless" },
      { title: "fine", reason: "requires readback" },
    ]);

    const { allowed, violations } = evaluateSkips(report);
    expect(allowed.map((entry) => entry.title)).toEqual([
      "example.spec.ts › fine",
    ]);
    expect(violations.map((entry) => entry.title)).toEqual([
      "example.spec.ts › mystery",
      "example.spec.ts › reasonless",
    ]);
  });
});
