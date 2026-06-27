import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { ApertureCliError } from "../errors.js";
import { loadApertureHeadlessApp } from "../headless/config-loader.js";
import { createNodeApertureAssetLoader } from "../headless/node-asset-loader.js";
import {
  applyApertureHeadlessInjectStep,
  parseApertureHeadlessInject,
  type ApertureHeadlessInjectStep,
} from "../headless/inject.js";
import {
  createApertureSnapshotBundle,
  type ApertureSnapshotBundle,
} from "../headless/bundle.js";

const DEFAULT_DELTA = 1 / 60;

interface ParsedHeadlessCommand {
  readonly configFile: string;
  readonly out: string;
  readonly frames: number;
  readonly delta: number;
  readonly inject?: string;
  readonly root?: string;
  readonly json: boolean;
}

export async function runHeadlessCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(headlessHelp());
    return 0;
  }

  const stderr = options.stderr ?? (() => undefined);
  const parsed = parseHeadlessCommand(options.argv, options.cwd);

  const loaded = await loadApertureHeadlessApp({
    configFile: parsed.configFile,
    ...(parsed.root === undefined ? {} : { root: parsed.root }),
  });

  for (const diagnostic of loaded.diagnostics) {
    stderr(`warning ${diagnostic.code}: ${diagnostic.message}\n`);
  }

  const injectSteps = await readInjectSteps(parsed.inject);

  const runner = await createApertureHeadlessRunner({
    config: loaded.config,
    systems: loaded.systems,
    assetLoader: createNodeApertureAssetLoader(),
  });

  await runner.app.preload;

  const placeholders =
    runner.app.lowLevel.assets.createManifestReport().placeholders;
  for (const id of placeholders.ids) {
    stderr(
      `warning aperture.headless.assetPlaceholder: asset '${id}' loaded as a Node placeholder; real pixels require 'aperture render'.\n`,
    );
  }

  let report = runner.extract(0);

  for (let frame = 0; frame < parsed.frames; frame += 1) {
    for (const step of injectSteps) {
      if ((step.atFrame ?? 0) === frame) {
        applyApertureHeadlessInjectStep(runner.app.context.input, step);
      }
    }

    report = runner.step(parsed.delta, frame * parsed.delta);
  }

  const bundle = createApertureSnapshotBundle({
    snapshot: report.snapshot,
    assets: runner.app.lowLevel.assets,
  });

  await writeBundle(parsed.out, bundle);

  if (parsed.json) {
    options.stdout(`${JSON.stringify(report.status, null, 2)}\n`);
  } else {
    options.stdout(summarize(parsed, report.status, bundle));
  }

  return 0;
}

async function readInjectSteps(
  injectFile: string | undefined,
): Promise<readonly ApertureHeadlessInjectStep[]> {
  if (injectFile === undefined) {
    return [];
  }

  let raw: string;

  try {
    raw = await readFile(injectFile, "utf8");
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.headless.injectNotFound",
      `Inject file '${injectFile}' could not be read. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return parseApertureHeadlessInject(raw);
}

async function writeBundle(
  out: string,
  bundle: ApertureSnapshotBundle,
): Promise<void> {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(bundle)}\n`, "utf8");
}

function summarize(
  parsed: ParsedHeadlessCommand,
  status: { readonly nextFrame: number },
  bundle: ApertureSnapshotBundle,
): string {
  return [
    `Stepped ${parsed.frames} frame(s) at dt=${parsed.delta.toFixed(6)}s.`,
    `Wrote snapshot bundle (frame ${bundle.frame}) to ${parsed.out}.`,
    `Next frame: ${status.nextFrame}.`,
    "",
  ].join("\n");
}

function parseHeadlessCommand(
  argv: readonly string[],
  cwd: string,
): ParsedHeadlessCommand {
  let configArg: string | undefined;
  let out: string | undefined;
  let frames = 1;
  let delta = DEFAULT_DELTA;
  let inject: string | undefined;
  let root: string | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--out") {
      index += 1;
      out = readOptionValue(argv, index, arg);
      continue;
    }

    if (arg === "--frames") {
      index += 1;
      frames = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg === "--delta") {
      index += 1;
      delta = parsePositiveNumber(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg === "--inject") {
      index += 1;
      inject = path.resolve(cwd, readOptionValue(argv, index, arg));
      continue;
    }

    if (arg === "--root") {
      index += 1;
      root = path.resolve(cwd, readOptionValue(argv, index, arg));
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.headless.unknownOption",
        `Unknown headless option '${arg}'. Run 'aperture headless --help' for supported options.`,
      );
    }

    if (configArg !== undefined) {
      throw new ApertureCliError(
        "aperture.headless.tooManyArguments",
        "The headless command accepts one config path.",
      );
    }

    configArg = arg;
  }

  if (configArg === undefined || configArg.length === 0) {
    throw new ApertureCliError(
      "aperture.headless.missingConfig",
      "The headless command requires a config path, for example 'aperture headless aperture.headless.config.ts --out snapshot.json'.",
    );
  }

  if (out === undefined || out.length === 0) {
    throw new ApertureCliError(
      "aperture.headless.missingOutput",
      "The headless command requires --out <path> to write the snapshot bundle.",
    );
  }

  return {
    configFile: path.resolve(cwd, configArg),
    out: path.resolve(cwd, out),
    frames,
    delta,
    ...(inject === undefined ? {} : { inject }),
    ...(root === undefined ? {} : { root }),
    json,
  };
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
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApertureCliError(
      "aperture.headless.invalidOption",
      `Option '${option}' must be a non-negative integer.`,
    );
  }

  return parsed;
}

function parsePositiveNumber(value: string, option: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApertureCliError(
      "aperture.headless.invalidOption",
      `Option '${option}' must be a positive number.`,
    );
  }

  return parsed;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function headlessHelp(): string {
  return `Usage:
  aperture headless <config> --out <path> [options]

Runs an Aperture app's ECS/simulation in pure Node (no browser): loads a
mode: "headless" config and its *.system.ts files, steps a fixed timestep,
and writes a render-snapshot bundle that 'aperture render' can turn into a PNG.

Arguments:
  <config>             Path to a mode: "headless" aperture config.

Options:
  --out <path>         Required. File to write the snapshot bundle JSON.
  --frames <n>         Fixed steps to advance before extracting (default 1).
  --delta <seconds>    Fixed timestep delta (default ${DEFAULT_DELTA.toFixed(6)}).
  --inject <file>      JSON file of timed input steps to apply while stepping.
  --root <dir>         App root the system globs resolve against (default: config dir).
  --json               Print the headless status report as JSON to stdout.
  -h, --help           Show help.

Config loading: the config and *.system.ts are loaded by native Node
TypeScript stripping, so they must be erasable TypeScript (no enums,
decorators, namespaces, or parameter properties) and resolve @aperture-engine/*.

Determinism: stepping replays bit-identically only if systems read
context.random and context.time instead of Math.random()/Date.now()/
performance.now().

Assets: external/texture assets load as Node placeholders (no image decoder in
Node); procedural meshes/materials are faithful. Render real pixels with
'aperture render <bundle> --out frame.png'.
`;
}
