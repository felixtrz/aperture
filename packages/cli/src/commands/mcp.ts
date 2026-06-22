import { ApertureCliError } from "../errors.js";
import { runApertureMcpServer } from "../mcp.js";

export async function runMcpCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(mcpHelp());
    return 0;
  }

  const [subcommand] = options.argv;
  if (subcommand !== "stdio") {
    throw new ApertureCliError(
      "aperture.mcp.unknownSubcommand",
      "The mcp command currently supports 'stdio'. Run 'aperture mcp --help' for usage.",
    );
  }

  await runApertureMcpServer({ cwd: options.cwd });
  return 0;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function mcpHelp(): string {
  return `Usage:
  aperture mcp stdio

Exposes Aperture browser, ECS, input, render, camera, and reference tools over
MCP stdio for the active dev session.

Options:
  -h, --help          Show help.
`;
}
