#!/usr/bin/env node
// AI-75: distinguish "environment cannot test this" from "feature broke".
// Reads Playwright JSON report(s) and fails when any skipped test's reason
// does not match a documented environment-capability pattern below. A skip
// with no reason, or a new reason nobody allowlisted, is treated as a
// potential silent feature regression and fails CI naming the spec.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// The ONLY allowlist of skip reasons. Every entry documents an environment
// capability the CI runner may genuinely lack (SwiftShader/headed-Chrome).
// Add entries deliberately; never widen a pattern to silence a new skip
// without understanding why the test started skipping.
export const ALLOWED_SKIP_REASON_PATTERNS = [
  // WebGPU itself (secure-context / browser support).
  /WebGPU( adapter)? is not available/i,
  // GPU→CPU readback support (canvas/current-texture readback probes).
  /requires readback/i,
  /readback unavailable/i,
  /readback returned transparent samples/i,
  // Timestamp-query feature support.
  /GPU timestamp queries are unavailable/i,
  // Harness installation hooks the browser may refuse.
  /did not allow .* to be overridden/i,
  // Headless screenshot sampled the CSS background instead of the swapchain.
  /CSS background/i,
];

export function collectSkippedTests(report) {
  const skipped = [];

  const visitSuite = (suite, titlePath) => {
    for (const childSuite of suite.suites ?? []) {
      visitSuite(childSuite, [...titlePath, childSuite.title ?? ""]);
    }

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const lastResult = results[results.length - 1];

        if (lastResult?.status !== "skipped") {
          continue;
        }

        const annotation = (test.annotations ?? []).find(
          (entry) => entry.type === "skip",
        );

        skipped.push({
          title: [...titlePath, spec.title ?? ""].filter(Boolean).join(" › "),
          file: spec.file ?? suite.file ?? "unknown",
          reason: annotation?.description ?? "",
        });
      }
    }
  };

  for (const suite of report.suites ?? []) {
    visitSuite(suite, [suite.title ?? ""]);
  }

  return skipped;
}

export function evaluateSkips(report, patterns = ALLOWED_SKIP_REASON_PATTERNS) {
  const skipped = collectSkippedTests(report);
  const allowed = [];
  const violations = [];

  for (const entry of skipped) {
    if (
      entry.reason.length > 0 &&
      patterns.some((pattern) => pattern.test(entry.reason))
    ) {
      allowed.push(entry);
    } else {
      violations.push(entry);
    }
  }

  return { skipped, allowed, violations };
}

async function main() {
  const reportPaths = process.argv.slice(2);

  if (reportPaths.length === 0) {
    console.error(
      "Usage: check-e2e-skips.mjs <playwright-json-report> [more reports...]",
    );
    process.exitCode = 1;
    return;
  }

  let totalAllowed = 0;
  let failed = false;

  for (const reportPath of reportPaths) {
    let report;

    try {
      report = JSON.parse(await readFile(reportPath, "utf8"));
    } catch (error) {
      console.error(`Could not read Playwright report '${reportPath}':`, error);
      failed = true;
      continue;
    }

    const { allowed, violations } = evaluateSkips(report);
    totalAllowed += allowed.length;

    for (const entry of allowed) {
      console.log(
        `allowed skip: ${entry.file} › ${entry.title} (${entry.reason})`,
      );
    }

    for (const entry of violations) {
      console.error(
        `UNEXPECTED SKIP: ${entry.file} › ${entry.title} — reason ${
          entry.reason.length > 0 ? `'${entry.reason}'` : "missing"
        } does not match any documented environment-capability pattern in scripts/check-e2e-skips.mjs.`,
      );
      failed = true;
    }
  }

  if (failed) {
    console.error(
      "E2E skip check failed. If the runner genuinely cannot test this, add a documented pattern; otherwise the feature regressed into a skip.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `E2E skip check passed (${totalAllowed} environment-capability skips).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
