#!/usr/bin/env node
// Convergent local runner for the WebGPU e2e suite on macOS.
//
// Playwright + Chrome/Chromium on this platform intermittently deadlocks at
// browser teardown (the close handshake never resolves, the runner idles until
// the global timeout, and every queued test reports "did not run"). The stall
// is stochastic per invocation, not per spec — the same spec passes in ~1s on
// the next attempt. This wrapper makes local runs reliable anyway:
//
//   1. kill leftover playwright worker / bundled-chromium processes that
//      poison subsequent launches,
//   2. run the requested specs once with a JSON reporter,
//   3. record a verdict (passed / failed / skipped) for every test that
//      produced one, drop fully-resolved spec files from the queue,
//   4. re-run the remainder until every test has a verdict or a no-progress
//      round occurs (max attempts reached → those tests count as failed).
//
// Failures are NEVER retried into passes: a test that produced a real failing
// verdict stays failed. Only tests with no verdict (wedged runner) re-run.
//
// Usage:
//   node scripts/webgpu-e2e-local.mjs [--config=playwright.macos.config.ts]
//     [--attempts=4] [spec files or -g style filters...]
//   node scripts/webgpu-e2e-local.mjs            # whole test/e2e suite
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const args = process.argv.slice(2);
const configArg =
  args.find((a) => a.startsWith("--config=")) ??
  "--config=playwright.macos.config.ts";
const attemptsArg = args.find((a) => a.startsWith("--attempts="));
const maxAttempts = attemptsArg ? Number(attemptsArg.split("=")[1]) : 4;
const specArgs = args.filter(
  (a) => !a.startsWith("--config=") && !a.startsWith("--attempts="),
);

function listSpecFiles() {
  return readdirSync(path.join(repoRoot, "test/e2e"))
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => path.join("test/e2e", f));
}

let queue = specArgs.length > 0 ? [...specArgs] : listSpecFiles();
// verdicts: testId -> { title, file, status }
const verdicts = new Map();

function preClean() {
  // Narrow patterns only: playwright's worker entry and the bundled test
  // chromium. NEVER match the user's own browsers.
  for (const pattern of [
    "workerProcessEntry",
    "ms-playwright/chromium",
    "playwright_chromiumdev_profile",
  ]) {
    spawnSync("pkill", ["-9", "-f", pattern], { stdio: "ignore" });
  }
}

function collect(suite, file, out) {
  for (const child of suite.suites ?? [])
    collect(child, child.file ?? file, out);
  for (const spec of suite.specs ?? []) {
    const specFile = spec.file ?? file;
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const last = results[results.length - 1];
      if (!last) continue;
      // "interrupted"/"didNotRun" => no verdict; everything else is final.
      if (last.status === "interrupted" || last.status === "didNotRun")
        continue;
      const status =
        test.status === "expected" || last.status === "passed"
          ? "passed"
          : last.status === "skipped"
            ? "skipped"
            : "failed";
      out.push({
        id: `${specFile} :: ${spec.title}`,
        file: specFile,
        title: spec.title,
        status,
      });
    }
  }
}

function runAttempt(files, attempt) {
  const jsonDir = mkdtempSync(path.join(tmpdir(), "aperture-e2e-"));
  const jsonPath = path.join(jsonDir, "results.json");
  const perFileBudgetMs = 90_000;
  const globalTimeout = Math.min(
    1_800_000,
    240_000 + files.length * perFileBudgetMs,
  );
  console.log(
    `\n[attempt ${attempt}/${maxAttempts}] ${files.length} spec file(s), global timeout ${Math.round(globalTimeout / 1000)}s`,
  );
  preClean();
  spawnSync(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      ...files,
      configArg,
      `--global-timeout=${globalTimeout}`,
      "--reporter=json",
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "inherit"],
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
        // Workers on this platform intermittently hang on exit (event loop
        // pinned after stop); playwright's default grace is 5 MINUTES per
        // worker. Cap it so a hang costs seconds and the run still finalizes
        // its report (passed verdicts survive the force-kill).
        PWTEST_CHILD_PROCESS_TIMEOUT:
          process.env.PWTEST_CHILD_PROCESS_TIMEOUT ?? "10000",
      },
      timeout: globalTimeout + 60_000,
      killSignal: "SIGKILL",
    },
  );
  preClean();
  let report = null;
  try {
    report = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch {
    console.log(
      "[attempt] no JSON report produced (runner wedged before reporting)",
    );
  }
  rmSync(jsonDir, { recursive: true, force: true });
  const found = [];
  if (report) {
    for (const suite of report.suites ?? [])
      collect(suite, suite.file ?? "", found);
  }
  return found;
}

// Batched attempts amortize startup, but a single launch wedge starves the
// whole batch. Once a batch makes no progress, fall back to one spec file per
// invocation — solo runs are empirically far more reliable here.
let splitMode = false;

for (
  let attempt = 1;
  attempt <= maxAttempts && queue.length > 0;
  attempt += 1
) {
  const batch = splitMode ? [queue[0]] : queue;
  const results = runAttempt(batch, attempt);
  let newVerdicts = 0;
  for (const r of results) {
    if (!verdicts.has(r.id)) {
      verdicts.set(r.id, r);
      newVerdicts += 1;
    }
  }
  // A spec file is resolved when this attempt produced verdicts for it and no
  // test in it is verdict-less (the JSON report covers all collected tests of
  // a file once the file actually ran to completion).
  const resolvedFiles = new Set(results.map((r) => r.file));
  const before = queue.length;
  queue = queue.filter((f) => {
    const base = path.basename(String(f));
    for (const file of resolvedFiles) {
      if (path.basename(file) === base) return false;
    }
    return true;
  });
  console.log(
    `[attempt ${attempt}] ${newVerdicts} new verdict(s); ${before - queue.length} spec file(s) resolved; ${queue.length} remaining`,
  );
  if (newVerdicts === 0 && queue.length === before) {
    if (!splitMode) {
      splitMode = true;
      console.log(
        "[runner] no progress — switching to one-file-per-invocation mode",
      );
    } else if (attempt > 2) {
      console.log("[runner] no progress in split mode — stopping early");
      break;
    }
  }
}

const passed = [...verdicts.values()].filter((v) => v.status === "passed");
const skipped = [...verdicts.values()].filter((v) => v.status === "skipped");
const failed = [...verdicts.values()].filter((v) => v.status === "failed");

console.log(`\n=== webgpu-e2e-local summary ===`);
console.log(
  `passed: ${passed.length}  skipped: ${skipped.length}  failed: ${failed.length}  unresolved spec files: ${queue.length}`,
);
for (const f of failed) console.log(`  ✘ ${f.id}`);
for (const f of queue) console.log(`  ? never produced a verdict: ${f}`);
process.exit(failed.length === 0 && queue.length === 0 ? 0 : 1);
