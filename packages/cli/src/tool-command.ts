import { callApertureTool } from "./devtools-client.js";
import { ApertureCliError } from "./errors.js";

interface ParsedToolCommand {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

export async function runToolCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(toolHelp());
    return 0;
  }

  const parsed = parseToolCommand(options.argv);
  const result = await callApertureTool({
    cwd: options.cwd,
    name: parsed.name,
    ...(parsed.arguments === undefined ? {} : { arguments: parsed.arguments }),
  });

  options.stdout(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function parseToolCommand(argv: readonly string[]): ParsedToolCommand {
  let name: string | undefined;
  let args: Record<string, unknown> | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json" || arg === "--args") {
      index += 1;
      args = parseToolJsonArgs(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.tool.unknownOption",
        `Unknown tool option '${arg}'. Run 'aperture tool --help' for supported options.`,
      );
    }

    if (name !== undefined) {
      throw new ApertureCliError(
        "aperture.tool.tooManyArguments",
        "The tool command accepts one tool name.",
      );
    }

    name = arg;
  }

  if (name === undefined || name.length === 0) {
    throw new ApertureCliError(
      "aperture.tool.missingName",
      "The tool command requires a tool name, for example 'aperture tool browser_status'.",
    );
  }

  return {
    name,
    ...(args === undefined ? {} : { arguments: args }),
  };
}

function parseToolJsonArgs(value: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.tool.invalidJson",
      `Tool arguments must be valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApertureCliError(
      "aperture.tool.invalidJson",
      "Tool arguments JSON must be an object.",
    );
  }

  return parsed as Record<string, unknown>;
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

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function toolHelp(): string {
  return `Usage:
  aperture tool <name> [--json <object>]

Calls the same Aperture browser, ECS, input, render, camera, and reference tools
that are exposed over MCP. Requires an active dev session for browser-backed
tools; reference tools can run without one.

Examples:
  aperture tool browser_status
  aperture tool render_get_diagnostics
  aperture tool input_key --json '{"key":"Enter","action":"press"}'

Options:
  --json <object>     JSON object passed as tool arguments.
  --args <object>     Alias for --json.
  -h, --help          Show help.
`;
}
