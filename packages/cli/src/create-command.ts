import path from "node:path";
import { ApertureCliError } from "./errors.js";

type ApertureCreateTemplate = "minimal" | "glb-viewer" | "game";

interface ParsedCreateCommand {
  readonly name: string;
  readonly force: boolean;
  readonly template: ApertureCreateTemplate;
}

interface CreateProjectOptions {
  readonly cwd: string;
  readonly name: string;
  readonly force?: boolean;
  readonly template?: ApertureCreateTemplate;
}

interface CreateProjectReport {
  readonly targetDir: string;
  readonly packageName: string;
  readonly template: ApertureCreateTemplate;
  readonly files: readonly string[];
}

export async function runCreateCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly createProject: (
    options: CreateProjectOptions,
  ) => Promise<CreateProjectReport>;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(createHelp());
    return 0;
  }

  const parsed = parseCreateCommand(options.argv);
  const report = await options.createProject({
    cwd: options.cwd,
    name: parsed.name,
    force: parsed.force,
    template: parsed.template,
  });

  options.stdout(createSuccessMessage(report, options.cwd));
  return 0;
}

function parseCreateCommand(argv: readonly string[]): ParsedCreateCommand {
  let name: string | null = null;
  let force = false;
  let template: ApertureCreateTemplate = "minimal";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--template") {
      index += 1;
      template = parseCreateTemplate(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new ApertureCliError(
        "aperture.create.unknownOption",
        `Unknown create option '${arg}'. Run 'aperture create --help' for supported options.`,
      );
    }

    if (name !== null) {
      throw new ApertureCliError(
        "aperture.create.tooManyArguments",
        "The create command accepts one project path.",
      );
    }

    name = arg;
  }

  if (name === null || name.trim().length === 0) {
    throw new ApertureCliError(
      "aperture.create.missingName",
      "The create command requires a project path, for example 'aperture create my-app'.",
    );
  }

  return { name, force, template };
}

function parseCreateTemplate(value: string): ApertureCreateTemplate {
  if (value === "minimal" || value === "glb-viewer" || value === "game") {
    return value;
  }

  throw new ApertureCliError(
    "aperture.create.invalidTemplate",
    `Unknown create template '${value}'. Use minimal, glb-viewer, or game.`,
  );
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

function createHelp(): string {
  return `Usage:
  aperture create <path> [--force] [--template <minimal|glb-viewer|game>]

Scaffolds a Vite-based Aperture app with starter ECS systems, Aperture config,
and AI adapter files.

Options:
  --force              Write starter files into a non-empty directory.
  --template <name>    Template to scaffold. Defaults to minimal.
  -h, --help           Show help.
`;
}

function createSuccessMessage(
  report: CreateProjectReport,
  cwd: string,
): string {
  const relativeTarget = path.relative(cwd, report.targetDir);
  const displayTarget =
    relativeTarget.length === 0 || relativeTarget.startsWith("..")
      ? report.targetDir
      : relativeTarget;

  return `Created Aperture app '${report.packageName}' in ${displayTarget}.

Next steps:
  cd ${displayTarget}
  pnpm install
  pnpm run dev
`;
}
