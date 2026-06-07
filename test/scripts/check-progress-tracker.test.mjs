import { describe, expect, it } from "vitest";

import { evaluateProgressTracker } from "../../scripts/check-progress-tracker.mjs";

const PHASE_NAMES = [
  [1, "extract"],
  [2, "collect"],
  [3, "prepare"],
  [4, "queue"],
  [5, "sort"],
  [6, "submit"],
];

function indexHtml(updated) {
  const phases = PHASE_NAMES.map(
    ([n, name]) => `<h3>${n}. ${name}</h3><span class="percent">100%</span>`,
  ).join("\n");
  return `<dl><dt>Updated</dt><dd>${updated}</dd></dl>\n${phases}`;
}

function comparisonHtml(updated) {
  const phases = PHASE_NAMES.map(
    ([n, name]) => `<b>${n} P${n} ${name}</b><span class="pct">100%</span>`,
  ).join("\n");
  return `Updated ${updated}\n${phases}`;
}

const NOW = new Date("2026-06-30T12:00:00Z");
const FRESH = "2026-06-29";
const STALE = "2026-01-01";

describe("evaluateProgressTracker", () => {
  it("passes with fresh dates and a complete phase board", () => {
    const { failures, warnings } = evaluateProgressTracker({
      indexHtml: indexHtml(FRESH),
      comparisonHtml: comparisonHtml(FRESH),
      now: NOW,
    });
    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("treats staleness as a non-fatal warning by default (the defused time-bomb)", () => {
    const { failures, warnings } = evaluateProgressTracker({
      indexHtml: indexHtml(STALE),
      comparisonHtml: comparisonHtml(STALE),
      now: NOW,
    });
    expect(failures).toEqual([]);
    expect(warnings.length).toBe(2);
    expect(warnings[0]).toContain("non-fatal");
  });

  it("promotes staleness to a failure only when enforceFreshness is set", () => {
    const { failures, warnings } = evaluateProgressTracker({
      indexHtml: indexHtml(STALE),
      comparisonHtml: comparisonHtml(STALE),
      now: NOW,
      enforceFreshness: true,
    });
    expect(failures.length).toBe(2);
    expect(warnings).toEqual([]);
  });

  it("keeps a missing date fatal regardless of freshness enforcement", () => {
    const { failures } = evaluateProgressTracker({
      indexHtml: indexHtml(FRESH).replace(
        /<dt>Updated<\/dt>\s*<dd>[^<]+<\/dd>/,
        "",
      ),
      comparisonHtml: comparisonHtml(FRESH),
      now: NOW,
      enforceFreshness: false,
    });
    expect(failures.some((f) => f.includes("missing an ISO date"))).toBe(true);
  });

  it("keeps a future date fatal", () => {
    const { failures } = evaluateProgressTracker({
      indexHtml: indexHtml("2099-01-01"),
      comparisonHtml: comparisonHtml(FRESH),
      now: NOW,
    });
    expect(failures.some((f) => f.includes("in the future"))).toBe(true);
  });

  it("keeps a missing structural phase fatal even with fresh dates", () => {
    const { failures } = evaluateProgressTracker({
      indexHtml: indexHtml(FRESH).replace("<h3>3. prepare</h3>", ""),
      comparisonHtml: comparisonHtml(FRESH),
      now: NOW,
    });
    expect(failures.some((f) => f.includes("phase 3 prepare"))).toBe(true);
  });
});
