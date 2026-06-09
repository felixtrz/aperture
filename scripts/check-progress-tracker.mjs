import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PHASES = [
  ["1", "extract"],
  ["2", "collect"],
  ["3", "prepare"],
  ["4", "queue"],
  ["5", "sort"],
  ["6", "submit"],
];

/**
 * Evaluate the progress-tracker docs for structural correctness and freshness.
 *
 * Structural problems (missing phase board, missing/future dates) are always
 * fatal `failures`. Date *staleness* is reported as a non-fatal `warning` by
 * default so long-lived branches and external contributors don't get spurious
 * red CI; pass `enforceFreshness: true` (CLI: `APERTURE_PROGRESS_TRACKER_ENFORCE_FRESHNESS=1`)
 * to promote staleness back to a `failure` for an opt-in scheduled freshness job.
 *
 * @returns {{ failures: string[], warnings: string[] }}
 */
export function evaluateProgressTracker({
  indexHtml,
  comparisonHtml,
  now = new Date(),
  maxAgeDays = 7,
  enforceFreshness = false,
}) {
  const failures = [];
  const warnings = [];
  const today = startOfUtcDay(now);

  checkRecentDate({
    label: "docs/index.html Updated field",
    match: indexHtml.match(/<dt>Updated<\/dt>\s*<dd>(\d{4}-\d{2}-\d{2})\b/),
    failures,
    warnings,
    today,
    maxAgeDays,
    enforceFreshness,
  });
  checkRecentDate({
    label: "docs/render-pipeline-comparison.html status heading",
    match: comparisonHtml.match(/Updated\s+(\d{4}-\d{2}-\d{2})\b/),
    failures,
    warnings,
    today,
    maxAgeDays,
    enforceFreshness,
  });
  checkIndexPhaseBoard(indexHtml, failures);
  checkComparisonPhaseStatus(comparisonHtml, failures);

  return { failures, warnings };
}

function checkRecentDate({
  label,
  match,
  failures,
  warnings,
  today,
  maxAgeDays,
  enforceFreshness,
}) {
  if (match === null) {
    failures.push(`${label} is missing an ISO date.`);
    return;
  }

  const date = parseDateOnly(match[1]);
  const ageDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000);

  if (ageDays < 0) {
    failures.push(`${label} date ${match[1]} is in the future.`);
    return;
  }

  if (ageDays > maxAgeDays) {
    const message = `${label} date ${match[1]} is ${ageDays} days old; expected ${maxAgeDays} days or newer.`;

    if (enforceFreshness) {
      failures.push(message);
    } else {
      warnings.push(
        `${message} (non-fatal; set APERTURE_PROGRESS_TRACKER_ENFORCE_FRESHNESS=1 to enforce)`,
      );
    }
  }
}

function checkIndexPhaseBoard(html, failures) {
  for (const [number, name] of PHASES) {
    const heading = new RegExp(`<h3>${number}\\. ${name}</h3>`);

    if (!heading.test(html)) {
      failures.push(`docs/index.html is missing phase ${number} ${name}.`);
    }
  }

  const percentCount = countMatches(
    html,
    /<span class="percent">\d+%<\/span>/g,
  );

  if (percentCount < PHASES.length) {
    failures.push(
      `docs/index.html has ${percentCount} phase percentage entries; expected at least ${PHASES.length}.`,
    );
  }
}

function checkComparisonPhaseStatus(html, failures) {
  for (const [number, name] of PHASES) {
    const phase = new RegExp(
      `<b>${number}\\s+[^<]+\\s+${name}</b><span class="pct">\\d+%</span>`,
    );

    if (!phase.test(html)) {
      failures.push(
        `docs/render-pipeline-comparison.html is missing phase ${number} ${name} status.`,
      );
    }
  }
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00Z`);
}

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function countMatches(value, regex) {
  return [...value.matchAll(regex)].length;
}

function runCli() {
  const maxAgeDays = Number.parseInt(
    process.env.APERTURE_PROGRESS_TRACKER_MAX_AGE_DAYS ?? "7",
    10,
  );
  const enforceFreshness =
    process.env.APERTURE_PROGRESS_TRACKER_ENFORCE_FRESHNESS === "1";

  const readFailures = [];
  const indexHtml = read("docs/index.html", readFailures);
  const comparisonHtml = read(
    "docs/render-pipeline-comparison.html",
    readFailures,
  );

  const { failures, warnings } = evaluateProgressTracker({
    indexHtml,
    comparisonHtml,
    maxAgeDays,
    enforceFreshness,
  });
  const allFailures = [...readFailures, ...failures];

  for (const warning of warnings) {
    console.warn(`Progress tracker warning: ${warning}`);
  }

  if (allFailures.length > 0) {
    console.error("Progress tracker check failed:");
    for (const failure of allFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Progress tracker check passed.");
}

function read(path, failures) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
    failures.push(`Cannot read ${path}: ${error.message}`);
    return "";
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])
) {
  runCli();
}
