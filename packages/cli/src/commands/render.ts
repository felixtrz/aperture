import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApertureCliError } from "../errors.js";
import { isPngBlank } from "../tools/png-readback.js";
import {
  renderBundleToPng,
  type RenderBundleMetadata,
} from "../render/driver.js";
import {
  APERTURE_LEGACY_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION,
  APERTURE_RENDER_BUNDLE_FORMAT,
  APERTURE_RENDER_BUNDLE_VERSION,
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  getApertureSnapshotBundleRenderTarget,
  preflightApertureSnapshotBundle,
  type ApertureSnapshotBundle,
  type ApertureSnapshotBundleClosure,
} from "../headless/bundle.js";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

interface ParsedRenderCommand {
  readonly bundleFile: string;
  readonly out: string;
  readonly width?: number;
  readonly height?: number;
  readonly allowBlank: boolean;
  readonly allowPlaceholders: boolean;
  readonly json: boolean;
}

export async function runRenderCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(renderHelp());
    return 0;
  }

  const stderr = options.stderr ?? (() => undefined);
  const parsed = parseRenderCommand(options.argv, options.cwd);
  const bundle = await readBundle(parsed.bundleFile);
  const renderTarget = getApertureSnapshotBundleRenderTarget(bundle);
  const width = parsed.width ?? renderTarget.width;
  const height = parsed.height ?? renderTarget.height;
  const preflight = preflightApertureSnapshotBundle(bundle, {
    allowPlaceholders: parsed.allowPlaceholders,
  });

  if (!preflight.ok) {
    throw new ApertureCliError(
      "aperture.render.incompleteBundle",
      `Snapshot bundle '${parsed.bundleFile}' is not render-complete: ${preflight.violations.join(
        "; ",
      )}. Re-export it with 'aperture headless' after assets are ready, or pass --allow-placeholders only when stubbed pixels are acceptable.`,
    );
  }

  warnOnPlaceholderAssets(preflight.closure, stderr);

  const { png, frame, metadata } = await renderBundleToPng({
    bundle,
    width,
    height,
  });

  if (!parsed.allowBlank && isPngBlank(png)) {
    throw new ApertureCliError(
      "aperture.render.blankFrame",
      "The rendered frame is blank (a single flat color). This usually means the snapshot's source assets did not resolve, WebGPU produced no output, or the browser ran headless (which does not composite the WebGPU canvas into the screenshot). Re-run with --allow-blank to write it anyway.",
    );
  }

  await mkdir(path.dirname(parsed.out), { recursive: true });
  await writeFile(parsed.out, png);

  if (parsed.json) {
    options.stdout(
      `${JSON.stringify(
        createRenderCommandJsonReport({
          bundleFile: parsed.bundleFile,
          out: parsed.out,
          frame,
          pngBytes: png.byteLength,
          metadata,
        }),
        null,
        2,
      )}\n`,
    );
  } else {
    options.stdout(
      `Rendered render bundle (frame ${frame ?? "?"}) to ${parsed.out} (${png.byteLength} bytes).\n`,
    );
  }

  return 0;
}

function createRenderCommandJsonReport(input: {
  readonly bundleFile: string;
  readonly out: string;
  readonly frame: number | null;
  readonly pngBytes: number;
  readonly metadata: RenderBundleMetadata;
}): unknown {
  return {
    ok: true,
    bundleFile: input.bundleFile,
    out: input.out,
    frame: input.frame,
    pngBytes: input.pngBytes,
    diagnostics: {
      renderer: input.metadata,
    },
  };
}

function warnOnPlaceholderAssets(
  closure: ApertureSnapshotBundleClosure,
  stderr: (text: string) => void,
): void {
  if (closure.placeholders.length > 0) {
    const ids = closure.placeholders.join(", ");
    stderr(
      `warning aperture.render.placeholderAssets: rendering ${closure.placeholders.length} placeholder asset(s) [${ids}] — these pixels are stubbed, not real.\n`,
    );
  }
}

export async function readApertureRenderBundleFile(
  bundleFile: string,
): Promise<ApertureSnapshotBundle> {
  return readBundle(bundleFile);
}

async function readBundle(bundleFile: string): Promise<ApertureSnapshotBundle> {
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
    !isSupportedBundleFormat((bundle as { format?: unknown }).format)
  ) {
    throw new ApertureCliError(
      "aperture.render.invalidBundle",
      `Snapshot bundle '${bundleFile}' is not an Aperture render bundle (expected format "${APERTURE_SNAPSHOT_BUNDLE_FORMAT}"). Produce one with 'aperture headless ... --out <bundle>'.`,
    );
  }

  const version = (bundle as { version?: unknown }).version;
  const expectedVersion =
    (bundle as { format?: unknown }).format === APERTURE_RENDER_BUNDLE_FORMAT
      ? APERTURE_RENDER_BUNDLE_VERSION
      : APERTURE_LEGACY_SNAPSHOT_BUNDLE_VERSION;

  if (version !== expectedVersion) {
    throw new ApertureCliError(
      "aperture.render.unsupportedBundleVersion",
      `Snapshot bundle '${bundleFile}' has version ${String(
        version,
      )}, but this CLI supports version ${expectedVersion}. Re-export it with a matching 'aperture headless'.`,
    );
  }

  return bundle as ApertureSnapshotBundle;
}

function parseRenderCommand(
  argv: readonly string[],
  cwd: string,
): ParsedRenderCommand {
  let bundleArg: string | undefined;
  let out: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let allowBlank = false;
  let allowPlaceholders = false;
  let json = false;

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

    if (arg === "--allow-placeholders") {
      allowPlaceholders = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
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
        "The render command accepts one render bundle path.",
      );
    }

    bundleArg = arg;
  }

  if (bundleArg === undefined || bundleArg.length === 0) {
    throw new ApertureCliError(
      "aperture.render.missingSnapshot",
      "The render command requires a render bundle path, for example 'aperture render snapshot.json --out frame.png'.",
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
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    allowBlank,
    allowPlaceholders,
    json,
  };
}

function isSupportedBundleFormat(value: unknown): boolean {
  return (
    value === APERTURE_RENDER_BUNDLE_FORMAT ||
    value === APERTURE_LEGACY_SNAPSHOT_BUNDLE_FORMAT
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

Renders one image on demand from a render bundle written by
'aperture headless'. Boots a headed Chrome (auto-provisioning an Xvfb virtual
display on a GPU-less Linux host), rehydrates the bundle's source assets,
applies the snapshot through the WebGPU renderer, and screenshots the result —
decoupled from any live simulation.

Rendering many frames? 'aperture render serve' keeps one warm browser and
renders bundles from stdin, paying the multi-second boot only once.

Arguments:
  <bundle>             Path to a render bundle JSON from 'aperture headless'.

Options:
  --out <path.png>     Required. File to write the rendered PNG.
  --width <n>          Override bundle canvas width in pixels (default bundle target or ${DEFAULT_WIDTH}).
  --height <n>         Override bundle canvas height in pixels (default bundle target or ${DEFAULT_HEIGHT}).
  --allow-blank        Write the PNG even if the frame is blank/black.
  --allow-placeholders Render bundles with placeholder source assets.
  --json               Print a machine-readable report with renderer diagnostics.
  -h, --help           Show help.
`;
}
