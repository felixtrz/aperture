import { ApertureCliError } from "./errors.js";

interface ParsedAdapterSyncCommand {
  readonly force: boolean;
}

interface SyncAdaptersOptions {
  readonly cwd: string;
  readonly force?: boolean;
}

interface SyncAdapterConflict {
  readonly path: string;
  readonly reason: string;
}

interface SyncAdaptersReport {
  readonly targetDir: string;
  readonly written: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly skipped: readonly string[];
  readonly conflicted: readonly SyncAdapterConflict[];
}

export async function runAdapterCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly syncAdapters: (
    options: SyncAdaptersOptions,
  ) => Promise<SyncAdaptersReport>;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(adapterHelp());
    return 0;
  }

  const [subcommand, ...subcommandRest] = options.argv;
  if (subcommand !== "sync") {
    throw new ApertureCliError(
      "aperture.adapter.unknownSubcommand",
      "The adapter command currently supports 'sync'. Run 'aperture adapter --help' for usage.",
    );
  }

  const parsed = parseAdapterSyncCommand(subcommandRest);
  const report = await options.syncAdapters({
    cwd: options.cwd,
    force: parsed.force,
  });

  options.stdout(adapterSyncSuccessMessage(report));
  return 0;
}

function parseAdapterSyncCommand(
  argv: readonly string[],
): ParsedAdapterSyncCommand {
  let force = false;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }

    throw new ApertureCliError(
      "aperture.adapter.unknownOption",
      `Unknown adapter sync option '${arg}'. Run 'aperture adapter --help' for supported options.`,
    );
  }

  return { force };
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function adapterHelp(): string {
  return `Usage:
  aperture adapter sync [--force]

Creates Aperture AI coding-tool adapter files in the current app.

Options:
  --force              Overwrite existing adapter files.
  -h, --help           Show help.
`;
}

function adapterSyncSuccessMessage(report: SyncAdaptersReport): string {
  return `Synced Aperture adapter files in ${report.targetDir}.

Written: ${report.written.length}
Changed: ${report.changed.length}
Unchanged: ${report.unchanged.length}
Skipped: ${report.skipped.length}
Conflicted: ${report.conflicted.length}
`;
}
