import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_STOP_GATE_MINUTE = 50;

export function evaluateStopGate({
  now = new Date(),
  backlogPath = "agent/BACKLOG.md",
  stopMinute = DEFAULT_STOP_GATE_MINUTE,
} = {}) {
  const date = now instanceof Date ? now : new Date(now);

  if (!Number.isFinite(date.getTime())) {
    return {
      status: "skipped",
      reason: `invalid current time: ${String(now)}`,
    };
  }

  if (!Number.isInteger(stopMinute) || stopMinute < 0 || stopMinute > 59) {
    return {
      status: "skipped",
      reason: `invalid stop minute: ${String(stopMinute)}`,
    };
  }

  const currentMinute = date.getMinutes();
  const readyTaskCount = countReadyTasks(backlogPath);
  const status =
    currentMinute < stopMinute && readyTaskCount > 0 ? "blocked" : "ok";

  return {
    status,
    currentMinute,
    stopMinute,
    readyTaskCount,
  };
}

export function countReadyTasks(backlogPath) {
  const backlog = fs.readFileSync(backlogPath, "utf8");
  const lines = backlog.split(/\r?\n/);
  let inReadySection = false;
  let count = 0;

  for (const line of lines) {
    if (inReadySection && /^##\s+/.test(line)) {
      break;
    }

    if (!inReadySection && /^##\s+Ready Tasks\b/.test(line)) {
      inReadySection = true;
      continue;
    }

    if (inReadySection && /^###\s+task-\d+\b/.test(line)) {
      count += 1;
    }
  }

  return count;
}

function runCli() {
  const gate = evaluateStopGate();

  console.log(JSON.stringify(gate));

  if (gate.status === "blocked") {
    process.exitCode = 2;
  } else if (gate.status !== "ok") {
    process.exitCode = 1;
  }
}

const modulePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  runCli();
}
