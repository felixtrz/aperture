import { ApertureCliError } from "../errors.js";
import {
  buildApertureReferenceIndex,
  readApertureReferenceStatus,
  searchApertureReferences,
  warmApertureReferences,
  type ApertureReferenceSearchReport,
  type ApertureReferenceStatusReport,
  type BuildApertureReferenceIndexReport,
  type WarmApertureReferenceReport,
} from "../reference.js";

interface ParsedReferenceSearchCommand {
  readonly query: string;
  readonly limit?: number;
}

export async function runReferenceCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(referenceHelp());
    return 0;
  }

  const [subcommand, ...subcommandRest] = options.argv;

  if (subcommand === "warmup") {
    const parsed = parseReferenceWarmupCommand(subcommandRest);
    options.stdout(
      referenceWarmupMessage(
        await warmApertureReferences({
          cwd: options.cwd,
          ...(parsed.from === undefined ? {} : { from: parsed.from }),
        }),
      ),
    );
    return 0;
  }

  if (subcommand === "status") {
    options.stdout(
      referenceStatusMessage(await readApertureReferenceStatus(options.cwd)),
    );
    return 0;
  }

  if (subcommand === "build") {
    options.stdout(
      referenceBuildMessage(
        await buildApertureReferenceIndex({ cwd: options.cwd }),
      ),
    );
    return 0;
  }

  if (subcommand === "search") {
    const parsed = parseReferenceSearchCommand(subcommandRest);
    options.stdout(
      referenceSearchMessage(
        await searchApertureReferences({
          cwd: options.cwd,
          query: parsed.query,
          ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
        }),
      ),
    );
    return 0;
  }

  throw new ApertureCliError(
    "aperture.reference.unknownSubcommand",
    "The reference command supports warmup, status, build, and search. Run 'aperture reference --help' for usage.",
  );
}

function parseReferenceSearchCommand(
  argv: readonly string[],
): ParsedReferenceSearchCommand {
  let limit: number | undefined;
  const queryParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--limit") {
      index += 1;
      limit = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.reference.unknownOption",
        `Unknown reference search option '${arg}'. Run 'aperture reference --help' for supported options.`,
      );
    }

    if (arg !== undefined) {
      queryParts.push(arg);
    }
  }

  const query = queryParts.join(" ").trim();
  if (query.length === 0) {
    throw new ApertureCliError(
      "aperture.reference.missingQuery",
      "The reference search command requires a query.",
    );
  }

  return {
    query,
    ...(limit === undefined ? {} : { limit }),
  };
}

function parseReferenceWarmupCommand(argv: readonly string[]): {
  readonly from?: string;
} {
  let from: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--from") {
      index += 1;
      from = readOptionValue(argv, index, arg);
      continue;
    }

    throw new ApertureCliError(
      "aperture.reference.unknownOption",
      `Unknown reference warmup option '${arg ?? ""}'. Run 'aperture reference --help' for supported options.`,
    );
  }

  return from === undefined ? {} : { from };
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

function referenceHelp(): string {
  return `Usage:
  aperture reference warmup [--from <path-or-url>]
  aperture reference status
  aperture reference build
  aperture reference search <query> [--limit <count>]

Warms, validates, and searches the Aperture RAG reference corpus.
The build subcommand is a local producer alias retained for development.

Options:
  --from <path-or-url> Use a local or hosted reference asset payload.
  --limit <count>     Maximum search results. Defaults to 10.
  -h, --help          Show help.
`;
}

function referenceBuildMessage(
  report: BuildApertureReferenceIndexReport,
): string {
  return `Built Aperture reference corpus.

Root: ${report.root}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
Entries: ${report.entries}
Chunks: ${report.chunks}
Sources: ${report.sources}
`;
}

function referenceWarmupMessage(report: WarmApertureReferenceReport): string {
  return `Warmed Aperture reference corpus.

Root: ${report.root}
Source: ${report.source}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
State: ${report.stateFile}
Entries: ${report.entries}
Chunks: ${report.chunks}
Sources: ${report.sources}
`;
}

function referenceStatusMessage(report: ApertureReferenceStatusReport): string {
  const diagnostics =
    report.diagnostics.length === 0
      ? "Diagnostics: none"
      : `Diagnostics:\n${report.diagnostics
          .map(
            (diagnostic) =>
              `- ${diagnostic.code}: ${diagnostic.message} Suggested fix: ${diagnostic.suggestedFix}`,
          )
          .join("\n")}`;

  return `Aperture reference corpus

Status: ${report.status}
Ready: ${report.ok ? "yes" : "no"}
Root: ${report.root}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
State: ${report.stateFile}
Chunks: ${report.chunks}
Sources: ${report.sources}
Model: ${report.model.provider}/${report.model.model}@${report.model.revision}
${diagnostics}
`;
}

function referenceSearchMessage(report: ApertureReferenceSearchReport): string {
  if (report.results.length === 0) {
    return `No Aperture reference results for '${report.query}'.

Index: ${report.indexFile}
`;
  }

  return `${report.results
    .map(
      (result) => `${result.file} (${result.kind}, score ${result.score})
${result.symbol} lines ${result.startLine}-${result.endLine}
${result.snippet}`,
    )
    .join("\n\n")}
`;
}
