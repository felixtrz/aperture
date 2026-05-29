import { runAdapterCommand } from "./commands/adapter.js";
import { syncApertureAdapters } from "./adapter-sync.js";
import { runCreateCommand } from "./commands/create.js";
import { createApertureProject } from "./create-project.js";
import { runDevCommand } from "./commands/dev.js";
import { ApertureDevSessionError } from "./dev-session.js";
import { ApertureCliError } from "./errors.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runReferenceCommand } from "./commands/reference.js";
import { runToolCommand } from "./commands/tool.js";
import { APERTURE_CLI_VERSION } from "./version.js";

export {
  syncApertureAdapters,
  type SyncApertureAdapterConflict,
  type SyncApertureAdaptersOptions,
  type SyncApertureAdaptersReport,
} from "./adapter-sync.js";
export {
  createApertureProject,
  type ApertureCreateTemplate,
  type CreateApertureProjectOptions,
  type CreateApertureProjectReport,
} from "./create-project.js";
export { ApertureCliError } from "./errors.js";

export interface ApertureCliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface RunApertureCliOptions extends Partial<ApertureCliIo> {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly entryPoint?: string;
}

export async function runApertureCli(
  options: RunApertureCliOptions,
): Promise<number> {
  const io = resolveIo(options);
  const [command, ...rest] = options.argv;

  try {
    if (command === undefined || isHelpFlag(command)) {
      io.stdout(mainHelp());
      return 0;
    }

    if (command === "--version" || command === "-v") {
      io.stdout(`${APERTURE_CLI_VERSION}\n`);
      return 0;
    }

    if (command === "create") {
      return await runCreateCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
        createProject: createApertureProject,
      });
    }

    if (command === "adapter") {
      return await runAdapterCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
        syncAdapters: syncApertureAdapters,
      });
    }

    if (command === "dev") {
      return await runDevCommand({
        argv: rest,
        cwd: options.cwd,
        ...(options.entryPoint === undefined
          ? {}
          : { entryPoint: options.entryPoint }),
        stdout: io.stdout,
      });
    }

    if (command === "mcp") {
      return await runMcpCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (command === "tool") {
      return await runToolCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (command === "reference") {
      return await runReferenceCommand({
        argv: rest,
        cwd: options.cwd,
        stdout: io.stdout,
      });
    }

    if (isPlannedCommand(command)) {
      if (rest.some(isHelpFlag)) {
        io.stdout(plannedCommandHelp(command));
        return 0;
      }

      throw new ApertureCliError(
        "aperture.cli.notImplemented",
        `The '${command}' command is planned for Aperture AI tooling but is not implemented yet.`,
      );
    }

    throw new ApertureCliError(
      "aperture.cli.unknownCommand",
      `Unknown Aperture command '${command}'. Run 'aperture --help' for available commands.`,
    );
  } catch (error: unknown) {
    if (
      error instanceof ApertureCliError ||
      error instanceof ApertureDevSessionError
    ) {
      io.stderr(`${error.code}: ${error.message}\n`);
      return error.exitCode;
    }

    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`aperture.cli.failed: ${message}\n`);
    return 1;
  }
}

function resolveIo(options: RunApertureCliOptions): ApertureCliIo {
  return {
    stdout: options.stdout ?? (() => undefined),
    stderr: options.stderr ?? (() => undefined),
  };
}

function mainHelp(): string {
  return `Aperture CLI ${APERTURE_CLI_VERSION}

Usage:
  aperture <command> [options]

Commands:
  aperture create <path>        Scaffold an Aperture app with AI tooling files.
  aperture dev <subcommand>     Manage an AI-enabled dev browser session.
  aperture tool <name>          Call one Aperture browser/ECS/render tool.
  aperture mcp stdio            Expose Aperture tools over MCP stdio.
  aperture adapter sync         Sync AI coding-tool adapter files.
  aperture reference <command>  Warm and query the Aperture RAG corpus.

Options:
  -h, --help           Show help.
  -v, --version        Show the CLI version.
`;
}

function plannedCommandHelp(command: string): string {
  return `The '${command}' command is part of the Aperture AI tooling plan but is not implemented yet.

Run 'aperture --help' to see the current command surface.
`;
}

function isPlannedCommand(_command: string): boolean {
  return false;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}
