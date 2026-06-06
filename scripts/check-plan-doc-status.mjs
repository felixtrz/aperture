#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const docsDir = path.join(process.cwd(), "docs");
const researchDir = path.join(docsDir, "research");
const allowedStatuses = new Set([
  "plan",
  "ready-for-execution",
  "implemented",
  "superseded",
]);
const statusPattern = /^\s*(?:\*\*)?Status(?:\*\*)?\s*:\s*(.+)$/imu;
const failures = [];

for (const file of readDir(docsDir)) {
  if (!/^(?!DOC_STATUS_CONVENTION).*?(?:PLAN|PROPOSAL)\.md$/iu.test(file)) {
    continue;
  }

  checkStatus({
    filePath: path.join(docsDir, file),
    expected: null,
  });
}

for (const file of readDir(researchDir)) {
  if (!/^(?:ACTIVE|SUPERSEDED)_.*(?:PLAN|PROPOSAL).*\.md$/iu.test(file)) {
    continue;
  }

  checkStatus({
    filePath: path.join(researchDir, file),
    expected: file.startsWith("SUPERSEDED_") ? "superseded" : "plan",
  });
}

if (failures.length > 0) {
  console.error("Plan document status check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Plan document status check passed.");

function readDir(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch (error) {
    failures.push(`Cannot read ${relative(dir)}: ${error.message}`);
    return [];
  }
}

function checkStatus({ filePath, expected }) {
  const text = read(filePath);
  if (text === null) {
    return;
  }

  const header = text.split(/\r?\n/u).slice(0, 12).join("\n");
  const match = header.match(statusPattern);
  if (match === null) {
    failures.push(
      `${relative(filePath)} is missing a Status line near the document header.`,
    );
    return;
  }

  const status = normalizeStatus(match[1]);
  if (!allowedStatuses.has(status)) {
    failures.push(
      `${relative(filePath)} has unsupported status '${match[1].trim()}'; expected one of ${[...allowedStatuses].join(", ")}.`,
    );
    return;
  }

  if (expected !== null && status !== expected) {
    failures.push(
      `${relative(filePath)} has status '${status}' but filename expects '${expected}'.`,
    );
  }
}

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    failures.push(`Cannot read ${relative(filePath)}: ${error.message}`);
    return null;
  }
}

function normalizeStatus(value) {
  const cleaned = value
    .trim()
    .replace(/^\*\*\s*/u, "")
    .replace(/\s*\*\*$/u, "")
    .trim()
    .toLowerCase();

  for (const status of allowedStatuses) {
    if (
      cleaned === status ||
      cleaned.startsWith(`${status} `) ||
      cleaned.startsWith(`${status}.`) ||
      cleaned.startsWith(`${status};`) ||
      cleaned.startsWith(`${status}:`)
    ) {
      return status;
    }
  }

  return cleaned;
}

function relative(filePath) {
  return path.relative(process.cwd(), filePath);
}
