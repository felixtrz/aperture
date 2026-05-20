import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FINAL_RESULTS = new Set([
  "success",
  "failure",
  "blocked",
  "stop-condition",
]);

export function finalizeAgentStatus({
  statusPath = "agent/STATUS.json",
  result = "success",
  notes,
  commit,
  now = new Date(),
} = {}) {
  if (!FINAL_RESULTS.has(result)) {
    throw new Error(
      `Invalid final result "${result}". Expected one of: ${[
        ...FINAL_RESULTS,
      ].join(", ")}`,
    );
  }

  const resolvedStatusPath = path.resolve(statusPath);
  const status = JSON.parse(fs.readFileSync(resolvedStatusPath, "utf8"));
  const finishedAt = toIsoSeconds(now);
  const runStartedAt =
    typeof status.currentRunStartedAt === "string"
      ? status.currentRunStartedAt
      : (status.lastRunStartedAt ?? null);

  const finalizedStatus = {
    ...status,
    state: "idle",
    currentTaskId: null,
    currentRunStartedAt: null,
    lastRunStartedAt: runStartedAt,
    lastRunFinishedAt: finishedAt,
    lastResult: result,
    activePid: null,
    notes:
      notes ??
      status.notes ??
      `Agent run finalized with result ${result} at ${finishedAt}.`,
  };

  if (commit !== undefined) {
    finalizedStatus.lastCommit = commit;
  }

  fs.writeFileSync(
    resolvedStatusPath,
    `${JSON.stringify(finalizedStatus, null, 2)}\n`,
  );

  return finalizedStatus;
}

export function parseFinalizeArgs(argv) {
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
      case "--result":
        options.result = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--notes":
        options.notes = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--status-file":
        options.statusPath = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      case "--commit":
        options.commit = readOptionValue(argv, index, inlineValue, name);
        index += inlineValue === undefined ? 1 : 0;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
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
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid timestamp: ${String(value)}`);
  }

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function printHelp() {
  console.log(`Usage: pnpm run agent:finalize -- [options]

Finalizes agent/STATUS.json before scripts/codex-stop-hook.sh.

Options:
  --result <value>       success, failure, blocked, or stop-condition
  --notes <text>         Handoff-ready status note
  --status-file <path>   Status file to update (default: agent/STATUS.json)
  --commit <sha>         Optional lastCommit value
`);
}

function runCli() {
  const options = parseFinalizeArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const finalizedStatus = finalizeAgentStatus(options);
  const statusPath = options.statusPath ?? "agent/STATUS.json";

  console.log(
    `Finalized ${statusPath}: state=${finalizedStatus.state}; lastResult=${finalizedStatus.lastResult}; lastRunFinishedAt=${finalizedStatus.lastRunFinishedAt}`,
  );
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
