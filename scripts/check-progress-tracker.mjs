import fs from "node:fs";

const MAX_AGE_DAYS = Number.parseInt(
  process.env.APERTURE_PROGRESS_TRACKER_MAX_AGE_DAYS ?? "7",
  10,
);
const PHASES = [
  ["1", "extract"],
  ["2", "collect"],
  ["3", "prepare"],
  ["4", "queue"],
  ["5", "sort"],
  ["6", "submit"],
];

const failures = [];
const indexHtml = read("docs/index.html");
const comparisonHtml = read("docs/render-pipeline-comparison.html");

checkRecentDate({
  label: "docs/index.html Updated field",
  match: indexHtml.match(/<dt>Updated<\/dt>\s*<dd>(\d{4}-\d{2}-\d{2})\b/),
});
checkRecentDate({
  label: "docs/render-pipeline-comparison.html status heading",
  match: comparisonHtml.match(/Updated\s+(\d{4}-\d{2}-\d{2})\b/),
});
checkIndexPhaseBoard(indexHtml);
checkComparisonPhaseStatus(comparisonHtml);

if (failures.length > 0) {
  console.error("Progress tracker check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Progress tracker check passed.");

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (error) {
    failures.push(`Cannot read ${path}: ${error.message}`);
    return "";
  }
}

function checkRecentDate({ label, match }) {
  if (match === null) {
    failures.push(`${label} is missing an ISO date.`);
    return;
  }

  const date = parseDateOnly(match[1]);
  const today = startOfUtcDay(new Date());
  const ageDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000);

  if (ageDays < 0) {
    failures.push(`${label} date ${match[1]} is in the future.`);
    return;
  }

  if (ageDays > MAX_AGE_DAYS) {
    failures.push(
      `${label} date ${match[1]} is ${ageDays} days old; expected ${MAX_AGE_DAYS} days or newer.`,
    );
  }
}

function checkIndexPhaseBoard(html) {
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

function checkComparisonPhaseStatus(html) {
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
