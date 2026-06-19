import {
  openApertureDevSession,
  readApertureDevLogs,
  readApertureDevStatus,
  runApertureDevSessionDaemon,
  startApertureDevSession,
  stopApertureDevSession,
  type ApertureDevLogsReport,
  type ApertureDevUpReport,
} from "../dev-session.js";
import { ApertureCliError } from "../errors.js";
import { parseApertureGpuMode } from "../dev/gpu.js";
import type { ApertureGpuMode } from "../dev/types.js";
import type { ApertureDevSessionStatus } from "../session.js";

interface ParsedDevUpCommand {
  readonly host?: string;
  readonly port?: number;
  readonly open: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
  readonly gpu?: ApertureGpuMode;
}

interface ParsedDevLogsCommand {
  readonly lines?: number;
}

export async function runDevCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly entryPoint?: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(devHelp());
    return 0;
  }

  const [subcommand, ...subcommandRest] = options.argv;

  if (subcommand === "up") {
    const parsed = parseDevUpCommand(subcommandRest);
    const report = await startApertureDevSession({
      cwd: options.cwd,
      entryPoint: options.entryPoint ?? defaultEntryPoint(),
      open: parsed.open,
      ...(parsed.host === undefined ? {} : { host: parsed.host }),
      ...(parsed.port === undefined ? {} : { port: parsed.port }),
      ...(parsed.headless === undefined ? {} : { headless: parsed.headless }),
      ...(parsed.strictPort === undefined
        ? {}
        : { strictPort: parsed.strictPort }),
      ...(parsed.gpu === undefined ? {} : { gpu: parsed.gpu }),
    });

    options.stdout(devUpSuccessMessage(report));
    return 0;
  }

  if (subcommand === "status") {
    options.stdout(devStatusMessage(await readApertureDevStatus(options.cwd)));
    return 0;
  }

  if (subcommand === "logs") {
    const parsed = parseDevLogsCommand(subcommandRest);
    options.stdout(
      devLogsMessage(
        await readApertureDevLogs({
          cwd: options.cwd,
          ...(parsed.lines === undefined ? {} : { lines: parsed.lines }),
        }),
      ),
    );
    return 0;
  }

  if (subcommand === "open") {
    await openApertureDevSession(options.cwd);
    options.stdout("Opened Aperture dev session URL.\n");
    return 0;
  }

  if (subcommand === "down") {
    const report = await stopApertureDevSession({ cwd: options.cwd });
    options.stdout(
      report.hadSession
        ? "Stopped Aperture dev session.\n"
        : "No Aperture dev session was active.\n",
    );
    return 0;
  }

  if (subcommand === "daemon") {
    const parsed = parseDevUpCommand(subcommandRest);
    await runApertureDevSessionDaemon({
      cwd: options.cwd,
      open: parsed.open,
      ...(parsed.host === undefined ? {} : { host: parsed.host }),
      ...(parsed.port === undefined ? {} : { port: parsed.port }),
      ...(parsed.headless === undefined ? {} : { headless: parsed.headless }),
      ...(parsed.strictPort === undefined
        ? {}
        : { strictPort: parsed.strictPort }),
      ...(parsed.gpu === undefined ? {} : { gpu: parsed.gpu }),
    });
    return 0;
  }

  throw new ApertureCliError(
    "aperture.dev.unknownSubcommand",
    "The dev command supports up, down, status, open, and logs. Run 'aperture dev --help' for usage.",
  );
}

function parseDevUpCommand(argv: readonly string[]): ParsedDevUpCommand {
  let host: string | undefined;
  let port: number | undefined;
  let open = false;
  let headless: boolean | undefined;
  let strictPort: boolean | undefined;
  let gpu: ApertureGpuMode | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--open") {
      open = true;
      headless = false;
      continue;
    }

    if (arg === "--headless") {
      headless = true;
      continue;
    }

    if (arg === "--headed") {
      headless = false;
      continue;
    }

    if (arg === "--strict-port") {
      strictPort = true;
      continue;
    }

    if (arg === "--no-strict-port") {
      strictPort = false;
      continue;
    }

    if (arg === "--host") {
      index += 1;
      host = readOptionValue(argv, index, arg);
      continue;
    }

    if (arg === "--port") {
      index += 1;
      port = parsePort(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg === "--gpu") {
      index += 1;
      gpu = parseApertureGpuMode(readOptionValue(argv, index, arg), "flag");
      continue;
    }

    if (arg === "--software" || arg === "--swiftshader") {
      gpu = "software";
      continue;
    }

    if (arg === "--hardware") {
      gpu = "hardware";
      continue;
    }

    throw new ApertureCliError(
      "aperture.dev.unknownOption",
      `Unknown dev option '${arg ?? ""}'. Run 'aperture dev --help' for supported options.`,
    );
  }

  return {
    ...(host === undefined ? {} : { host }),
    ...(port === undefined ? {} : { port }),
    open,
    ...(headless === undefined ? {} : { headless }),
    ...(strictPort === undefined ? {} : { strictPort }),
    ...(gpu === undefined ? {} : { gpu }),
  };
}

function parseDevLogsCommand(argv: readonly string[]): ParsedDevLogsCommand {
  let lines: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--lines") {
      index += 1;
      lines = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    throw new ApertureCliError(
      "aperture.dev.unknownOption",
      `Unknown dev logs option '${arg ?? ""}'. Run 'aperture dev --help' for supported options.`,
    );
  }

  return lines === undefined ? {} : { lines };
}

function readOptionValue(
  argv: readonly string[],
  index: number,
  option: string,
): string {
  const value = argv[index];

  if (value === undefined || value.startsWith("-")) {
    throw new ApertureCliError(
      "aperture.cli.missingOptionValue",
      `Option '${option}' requires a value.`,
    );
  }

  return value;
}

function parsePort(value: string, option: string): number {
  const port = parsePositiveInteger(value, option);

  if (port > 65_535) {
    throw new ApertureCliError(
      "aperture.cli.invalidPort",
      `Option '${option}' requires a TCP port between 1 and 65535.`,
    );
  }

  return port;
}

function parsePositiveInteger(value: string, option: string): number {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new ApertureCliError(
      "aperture.cli.invalidNumber",
      `Option '${option}' requires a positive integer value.`,
    );
  }

  return number;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function devHelp(): string {
  return `Usage:
  aperture dev up [--open] [--host <host>] [--port <port>] [--gpu <mode>]
  aperture dev status
  aperture dev logs [--lines <count>]
  aperture dev open
  aperture dev down

Manages a Vite dev server plus a Playwright-controlled Aperture browser.

Options:
  --open              Launch the managed browser headed.
  --headless          Launch the managed browser headless.
  --headed            Launch the managed browser headed.
  --host <host>       Host for the Vite server. Defaults to 127.0.0.1.
  --port <port>       Port for the Vite server. Defaults to 5173.
  --gpu <mode>        WebGPU backend: auto (default), hardware, or software.
                      auto uses the GPU when present and falls back to
                      SwiftShader on GPU-less hosts (CI, dev containers).
                      Also set via the APERTURE_GPU environment variable.
  --software          Force SwiftShader CPU WebGPU (alias for --gpu software).
  --hardware          Force the hardware GPU (alias for --gpu hardware).
  --strict-port       Fail if the requested port is unavailable. Default.
  --no-strict-port    Allow Aperture to choose the next available port.
  --lines <count>     Log lines to print for dev logs. Defaults to 80.
  -h, --help          Show help.
`;
}

function devUpSuccessMessage(report: ApertureDevUpReport): string {
  const action = report.reused ? "Reusing" : "Started";

  return `${action} Aperture dev session.

URL: ${report.session.url}
Session: ${report.session.appRoot}/.aperture/runtime/session.json
Daemon PID: ${report.session.daemon.pid ?? "unknown"}
Server PID: ${report.session.server.pid ?? "unknown"}
Browser PID: ${report.session.browser.pid ?? "unknown"}
`;
}

function devStatusMessage(status: ApertureDevSessionStatus): string {
  if (status.session === null) {
    return `No Aperture dev session found.

Session: ${status.sessionFile}
`;
  }

  return `Aperture dev session

URL: ${status.session.url}
Session: ${status.sessionFile}
Daemon: ${status.session.daemon.state} (${status.daemonAlive ? "alive" : "not running"})
Server: ${status.session.server.state} (${status.serverAlive ? "alive" : "not running"})
Browser: ${status.session.browser.state} (${status.browserAlive ? "alive" : "not running"})
Bridge: ${status.session.bridge.url ?? "none"} (${status.serverAlive ? "available" : "not running"})
CDP: ${status.session.browser.cdpUrl ?? "none"}
`;
}

function devLogsMessage(report: ApertureDevLogsReport): string {
  if (report.session === null) {
    return "No Aperture dev session found.\n";
  }

  return `${report.logs
    .map(
      (log) => `== ${log.name}: ${log.file} ==
${log.text}`,
    )
    .join("\n\n")}
`;
}

function defaultEntryPoint(): string {
  const entryPoint = process.argv[1];

  if (entryPoint === undefined || entryPoint.length === 0) {
    throw new ApertureCliError(
      "aperture.cli.missingEntryPoint",
      "Unable to locate the Aperture CLI entry point for the dev session daemon.",
    );
  }

  return entryPoint;
}
