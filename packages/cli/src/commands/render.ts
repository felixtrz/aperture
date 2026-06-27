import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApertureCliError } from "../errors.js";
import { isPngBlank } from "../tools/png-readback.js";
import { renderBundleToPng } from "../render/driver.js";
import {
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_SNAPSHOT_BUNDLE_VERSION,
} from "../headless/bundle.js";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

interface ParsedRenderCommand {
  readonly bundleFile: string;
  readonly out: string;
  readonly width: number;
  readonly height: number;
  readonly allowBlank: boolean;
}

export async function runRenderCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(renderHelp());
    return 0;
  }

  const parsed = parseRenderCommand(options.argv, options.cwd);
  const bundle = await readBundle(parsed.bundleFile);

  const { png, frame } = await renderBundleToPng({
    bundle,
    width: parsed.width,
    height: parsed.height,
  });

  if (!parsed.allowBlank && isPngBlank(png)) {
    throw new ApertureCliError(
      "aperture.render.blankFrame",
      "The rendered frame is blank/black. This usually means the snapshot's source assets did not resolve or WebGPU produced no output. Re-run with --allow-blank to write it anyway.",
    );
  }

  await mkdir(path.dirname(parsed.out), { recursive: true });
  await writeFile(parsed.out, png);

  options.stdout(
    `Rendered snapshot bundle (frame ${frame ?? "?"}) to ${parsed.out} (${png.byteLength} bytes).\n`,
  );

  return 0;
}

async function readBundle(bundleFile: string): Promise<unknown> {
  let raw: string;

  try {
    raw = await readFile(bundleFile, "utf8");
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.render.snapshotNotFound",
      `Snapshot bundle '${bundleFile}' could not be read. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let bundle: unknown;

  try {
    bundle = JSON.parse(raw) as unknown;
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.render.invalidBundle",
      `Snapshot bundle '${bundleFile}' is not valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (
    typeof bundle !== "object" ||
    bundle === null ||
    (bundle as { format?: unknown }).format !== APERTURE_SNAPSHOT_BUNDLE_FORMAT
  ) {
    throw new ApertureCliError(
      "aperture.render.invalidBundle",
      `Snapshot bundle '${bundleFile}' is not an Aperture render snapshot bundle (expected format "${APERTURE_SNAPSHOT_BUNDLE_FORMAT}"). Produce one with 'aperture headless ... --out <bundle>'.`,
    );
  }

  const version = (bundle as { version?: unknown }).version;

  if (version !== APERTURE_SNAPSHOT_BUNDLE_VERSION) {
    throw new ApertureCliError(
      "aperture.render.unsupportedBundleVersion",
      `Snapshot bundle '${bundleFile}' has version ${String(
        version,
      )}, but this CLI supports version ${APERTURE_SNAPSHOT_BUNDLE_VERSION}. Re-export it with a matching 'aperture headless'.`,
    );
  }

  return bundle;
}

function parseRenderCommand(
  argv: readonly string[],
  cwd: string,
): ParsedRenderCommand {
  let bundleArg: string | undefined;
  let out: string | undefined;
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
  let allowBlank = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--out") {
      index += 1;
      out = readOptionValue(argv, index, arg);
      continue;
    }

    if (arg === "--width") {
      index += 1;
      width = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg === "--height") {
      index += 1;
      height = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg === "--allow-blank") {
      allowBlank = true;
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.render.unknownOption",
        `Unknown render option '${arg}'. Run 'aperture render --help' for supported options.`,
      );
    }

    if (bundleArg !== undefined) {
      throw new ApertureCliError(
        "aperture.render.tooManyArguments",
        "The render command accepts one snapshot bundle path.",
      );
    }

    bundleArg = arg;
  }

  if (bundleArg === undefined || bundleArg.length === 0) {
    throw new ApertureCliError(
      "aperture.render.missingSnapshot",
      "The render command requires a snapshot bundle path, for example 'aperture render snapshot.json --out frame.png'.",
    );
  }

  if (out === undefined || out.length === 0) {
    throw new ApertureCliError(
      "aperture.render.missingOutput",
      "The render command requires --out <path.png> to write the rendered image.",
    );
  }

  return {
    bundleFile: path.resolve(cwd, bundleArg),
    out: path.resolve(cwd, out),
    width,
    height,
    allowBlank,
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

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApertureCliError(
      "aperture.render.invalidOption",
      `Option '${option}' must be a positive integer.`,
    );
  }

  return parsed;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function renderHelp(): string {
  return `Usage:
  aperture render <bundle> --out <path.png> [options]

Renders one image on demand from a snapshot bundle written by
'aperture headless'. Boots a headless-friendly browser, rehydrates the
bundle's source assets, applies the snapshot through the WebGPU renderer, and
screenshots the result — decoupled from any live simulation.

Arguments:
  <bundle>             Path to a snapshot bundle JSON from 'aperture headless'.

Options:
  --out <path.png>     Required. File to write the rendered PNG.
  --width <n>          Canvas width in pixels (default ${DEFAULT_WIDTH}).
  --height <n>         Canvas height in pixels (default ${DEFAULT_HEIGHT}).
  --allow-blank        Write the PNG even if the frame is blank/black.
  -h, --help           Show help.
`;
}
