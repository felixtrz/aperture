import path from "node:path";
import { stat } from "node:fs/promises";
import { writeApertureGeneratedActionTypes } from "@aperture-engine/vite-plugin";
import { ApertureCliError } from "../errors.js";

/**
 * Standalone `.aperture/generated` codegen (#76): the generated action and
 * signal type maps were previously only refreshed by a vite build, so a pure
 * headless workflow (`aperture headless`/`serve` + `tsc`) never regenerated
 * them. This command runs the same generator the vite plugin uses — which
 * evaluates the config through the module loader, so factory/shared configs
 * (#68) are seen — without touching the browser bundler.
 */
export async function runCodegenCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(codegenHelp());
    return 0;
  }

  const parsed = parseCodegenCommand(options.argv, options.cwd);
  await assertFileExists(parsed.configFile);

  const file = await writeApertureGeneratedActionTypes({
    root: parsed.root,
    configFile: parsed.configFile,
  });

  options.stdout(`Wrote generated Aperture types to ${file}\n`);
  return 0;
}

function parseCodegenCommand(
  argv: readonly string[],
  cwd: string,
): { readonly configFile: string; readonly root: string } {
  let configArg: string | undefined;
  let root: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--root") {
      index += 1;
      root = path.resolve(cwd, readOptionValue(argv, index, arg));
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.codegen.unknownOption",
        `Unknown codegen option '${arg}'. Run 'aperture codegen --help'.`,
      );
    }

    if (configArg !== undefined) {
      throw new ApertureCliError(
        "aperture.codegen.tooManyArguments",
        "The codegen command accepts one config path.",
      );
    }

    configArg = arg;
  }

  const resolvedRoot = root ?? cwd;
  const configFile = path.resolve(
    resolvedRoot,
    configArg ?? "aperture.config.ts",
  );

  return {
    configFile,
    root: root ?? (configArg === undefined ? cwd : path.dirname(configFile)),
  };
}

async function assertFileExists(configFile: string): Promise<void> {
  try {
    const fileStat = await stat(configFile);
    if (fileStat.isFile()) {
      return;
    }
  } catch {
    // Fall through to the structured error below.
  }

  throw new ApertureCliError(
    "aperture.codegen.configNotFound",
    `Codegen config file '${configFile}' was not found. Pass an aperture config path, e.g. 'aperture codegen aperture.config.ts'.`,
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

function codegenHelp(): string {
  return `Usage:
  aperture codegen [config] [--root <dir>]

Regenerate .aperture/generated/aperture-env.d.ts (typed this.actions.* and
this.signals.* maps) outside of a vite build, for the headless-first loop
(edit -> codegen -> tsc -> serve).

The config is EVALUATED through the module loader, so input actions and
signals declared via a factory/shared config (aperture.shared-config.ts) are
seen. A browser config that reads import.meta.env falls back to the sibling
aperture.headless.config.ts built from the same shared factory.

Arguments:
  config               Aperture config path (default: aperture.config.ts).

Options:
  --root <dir>         App root the generated directory is written under
                       (default: the config file's directory, or cwd).
  -h, --help           Show help.
`;
}
