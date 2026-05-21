import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function startAgentStatus({
  statusPath = "agent/STATUS.json",
  taskId = "auto",
  notes,
  pid = null,
  now = new Date(),
  staleRunningMinutes = 120,
  isPidAlive = defaultIsPidAlive,
} = {}) {
  const resolvedStatusPath = path.resolve(statusPath);
  const existing = readExistingStatus(resolvedStatusPath);
  const activePid = normalizePid(existing.activePid);
  const nowDate = normalizeDate(now);

  if (existing.state === "running") {
    if (isPidAlive(activePid)) {
      throw new Error(
        `${statusPath} already records a running agent with live PID ${activePid}.`,
      );
    }

    if (isRecentRunningStatus(existing, nowDate, staleRunningMinutes)) {
      throw new Error(
        `${statusPath} already records a running agent started at ${existing.currentRunStartedAt}.`,
      );
    }
  }

  const startedAt = toIsoSeconds(nowDate);
  const nextPid = normalizePid(pid);
  const startedStatus = {
    ...existing,
    state: "running",
    currentTaskId: taskId,
    currentRunStartedAt: startedAt,
    lastRunStartedAt: startedAt,
    lastRunFinishedAt: null,
    lastResult: "in_progress",
    lastCommit: existing.lastCommit ?? null,
    activePid: nextPid,
    notes: notes ?? `Autonomous Codex run started at ${startedAt}.`,
  };

  writeJsonAtomic(resolvedStatusPath, startedStatus);

  return startedStatus;
}

export function parseStartArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    const { name, inlineValue } = splitOption(arg);

    switch (name) {
      case "--status-file":
        options.statusPath = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--task-id":
        options.taskId = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--notes":
        options.notes = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--pid":
        options.pid = parsePid(readOptionValue(argv, index, inlineValue, name));
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--now":
        options.now = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--stale-running-minutes":
        options.staleRunningMinutes = parsePositiveNumber(
          readOptionValue(argv, index, inlineValue, name),
          name,
        );
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readExistingStatus(statusPath) {
  if (!fs.existsSync(statusPath)) {
    return {
      state: "idle",
      currentTaskId: null,
      currentRunStartedAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastResult: null,
      lastCommit: null,
      activePid: null,
      notes: null,
    };
  }

  return JSON.parse(fs.readFileSync(statusPath, "utf8"));
}

function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function defaultIsPidAlive(pid) {
  if (pid === null) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function normalizePid(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }

  return null;
}

function parsePositiveNumber(value, name) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Invalid value for ${name}: ${value}`);
  }

  return number;
}

function parsePid(value) {
  const pid = normalizePid(value);

  if (pid === null) {
    throw new Error(`Invalid PID: ${value}`);
  }

  return pid;
}

function splitOption(arg) {
  const equalsIndex = arg.indexOf("=");

  if (equalsIndex === -1) {
    return { name: arg, inlineValue: undefined };
  }

  return {
    name: arg.slice(0, equalsIndex),
    inlineValue: arg.slice(equalsIndex + 1),
  };
}

function readOptionValue(argv, index, inlineValue, name) {
  if (inlineValue !== undefined) {
    return inlineValue;
  }

  const value = argv[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function toIsoSeconds(value) {
  const date = normalizeDate(value);

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid timestamp: ${String(value)}`);
  }

  return date;
}

function isRecentRunningStatus(status, now, staleRunningMinutes) {
  const startedMs = Date.parse(status.currentRunStartedAt ?? "");

  if (!Number.isFinite(startedMs)) {
    return false;
  }

  const ageMinutes = (now.getTime() - startedMs) / 60000;

  return ageMinutes >= -1 && ageMinutes <= staleRunningMinutes;
}

function printHelp() {
  console.log(`Usage: pnpm run agent:start -- [options]

Initializes agent/STATUS.json once at the start of an automation run.

Options:
  --status-file <path>   Status file to update (default: agent/STATUS.json)
  --task-id <value>      Current task id to record (default: auto)
  --notes <text>         Handoff-ready start note
  --pid <number>         Optional live run-owner PID
  --now <timestamp>      Optional timestamp override for tests
  --stale-running-minutes <number>
                       Refuse to replace newer running status without live PID
                       (default: 120)
  --quiet                Do not print startup confirmation
`);
}

function runCli() {
  const options = parseStartArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const startedStatus = startAgentStatus(options);
  const statusPath = options.statusPath ?? "agent/STATUS.json";

  if (!options.quiet) {
    console.log(
      `Started ${statusPath}: state=${startedStatus.state}; currentRunStartedAt=${startedStatus.currentRunStartedAt}`,
    );
  }
}

const modulePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
