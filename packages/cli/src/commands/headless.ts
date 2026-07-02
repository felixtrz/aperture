import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import type { RenderSnapshot } from "@aperture-engine/render";
import type {
  ApertureDeterminismDiagnosticsMode,
  ApertureSystemDiagnostic,
} from "@aperture-engine/app/systems";
import { ApertureCliError } from "../errors.js";
import { syncAutoAspectCameras } from "../headless/auto-aspect.js";
import { loadApertureHeadlessApp } from "../headless/config-loader.js";
import {
  createNodeApertureAssetLoader,
  type NodeAssetLoaderMode,
} from "../headless/node-asset-loader.js";
import {
  assertInjectActionsDriveButtons,
  createApertureHeadlessInjectEvents,
  parseApertureHeadlessInject,
  type ApertureHeadlessInjectStep,
} from "../headless/inject.js";
import {
  createApertureSnapshotBundle,
  renderBundleTargetFromRenderDefaults,
  type ApertureSnapshotBundle,
} from "../headless/bundle.js";

const DEFAULT_DELTA = 1 / 60;
const DEFAULT_RENDER_WIDTH = 960;
const DEFAULT_RENDER_HEIGHT = 640;

interface ParsedHeadlessCommand {
  readonly configFile: string;
  readonly out: string;
  readonly frames: number;
  readonly delta: number;
  readonly inject?: string;
  readonly root?: string;
  readonly publicDir: string;
  readonly decoderAssetsDir?: string;
  readonly allowHttpAssets: boolean;
  readonly assetMode: NodeAssetLoaderMode;
  readonly determinism: ApertureDeterminismDiagnosticsMode;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly seed: number;
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
    // Seed the deterministic RNG (context.random). Passing the seed as `random`
    // matches how `serve` seeds its runner, so a one-shot run reproduces a
    // `serve --seed N` layout for the same schedule (finding F8).
    random: parsed.seed,
    assetLoader: createNodeApertureAssetLoader({
      mode: parsed.assetMode,
      root: parsed.root ?? path.dirname(parsed.configFile),
      publicDir: parsed.publicDir,
      allowHttp: parsed.allowHttpAssets,
      ...(parsed.decoderAssetsDir === undefined
        ? {}
        : { decoderAssetsDir: parsed.decoderAssetsDir }),
    }),
    determinism: { globals: parsed.determinism },
  });

  await runner.app.preload;

  // Fail loudly on a non-button --inject action instead of silently leaving
  // the driven value at 0 (#69) — same diagnostic as the interactive path.
  for (const step of injectSteps) {
    if (step.actions !== undefined) {
      assertInjectActionsDriveButtons(runner.app.context.input, step.actions);
    }
  }

  const placeholders =
    runner.app.lowLevel.assets.createManifestReport().placeholders;
  for (const id of placeholders.ids) {
    stderr(
      `warning aperture.headless.assetPlaceholder: asset '${id}' loaded as a Node placeholder; use --asset-mode strict for supported local assets or pass --allow-placeholders to 'aperture render' for stubbed pixels.\n`,
    );
  }

  // Keep autoAspect cameras matched to the requested render target so the
  // recorded projection fits the output pixels (finding F4).
  syncAutoAspectCameras(
    runner.app.lowLevel.world,
    parsed.renderWidth,
    parsed.renderHeight,
  );
  let report = runner.extract(0);

  for (let frame = 0; frame < parsed.frames; frame += 1) {
    for (const step of injectSteps) {
      if ((step.atFrame ?? 0) === frame) {
        runner.enqueueInputBatch(
          createApertureHeadlessInjectEvents(step),
          frame,
        );
      }
    }

    syncAutoAspectCameras(
      runner.app.lowLevel.world,
      parsed.renderWidth,
      parsed.renderHeight,
    );
    report = runner.step(parsed.delta, frame * parsed.delta);
  }

  const bundle = createApertureSnapshotBundle({
    snapshot: report.snapshot,
    assets: runner.app.lowLevel.assets,
    options: {
      createdBy: "aperture headless",
      renderTarget: {
        // Carry the app's render/post config (tonemap/exposure/bloom/msaa)
        // so `aperture render` reproduces the final look (#73).
        ...renderBundleTargetFromRenderDefaults(loaded.config.render),
        width: parsed.renderWidth,
        height: parsed.renderHeight,
      },
      allowPlaceholders: parsed.assetMode !== "strict",
    },
  });

  // Name the likely cause of an un-renderable bundle up front instead of
  // leaving it to `aperture render`'s generic emptySnapshot failure (#66).
  if (!snapshotHasRenderableDraws(report.snapshot)) {
    stderr(
      `warning aperture.headless.emptyBundle: the extracted snapshot has no renderable draws (mesh, sprite, sky, glyph, UI, or particle)${
        placeholders.ids.length > 0
          ? " (placeholder assets carry no geometry — use --asset-mode hybrid or strict so Node loads the real assets)"
          : ""
      }; 'aperture render' will reject this bundle as an empty snapshot.\n`,
    );
  }

  emitDeterminismDiagnostics(report.status.diagnostics, stderr);
  assertDeterminismPolicy(parsed.determinism, report.status.diagnostics);

  await writeBundle(parsed.out, bundle);

  if (parsed.json) {
    options.stdout(
      `${JSON.stringify({ ...report.status, seed: parsed.seed }, null, 2)}\n`,
    );
  } else {
    options.stdout(summarize(parsed, report.status, bundle));
  }

  return 0;
}

// Mirrors the renderer's own renderable-family check (webgpu frame-loop): a
// snapshot renders when ANY draw family is present — sprite/sky/glyph/UI/
// particle-only scenes are valid without a single mesh draw.
function snapshotHasRenderableDraws(snapshot: RenderSnapshot): boolean {
  return (
    snapshot.meshDraws.length > 0 ||
    (snapshot.spriteDraws ?? []).length > 0 ||
    (snapshot.skyboxes ?? []).length > 0 ||
    (snapshot.proceduralSkies ?? []).length > 0 ||
    (snapshot.quadBatches ?? []).some((batch) => batch.kind === "glyph") ||
    (snapshot.uiNodes ?? []).length > 0 ||
    (snapshot.particleEmitters ?? []).length > 0
  );
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
    `Seed: ${parsed.seed}.`,
    `Asset mode: ${parsed.assetMode}.`,
    `Render target: ${parsed.renderWidth}x${parsed.renderHeight}.`,
    `Wrote render bundle (frame ${bundle.frame}) to ${parsed.out}.`,
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
  let publicDir = "public";
  let decoderAssetsDir: string | undefined;
  let allowHttpAssets = false;
  // Hybrid by default (#66): the placeholder default left GLB-only scenes
  // with zero mesh draws, which `aperture render` rejects as an empty
  // snapshot; the scaffold docs already recommend hybrid.
  let assetMode: NodeAssetLoaderMode = "hybrid";
  let determinism: ApertureDeterminismDiagnosticsMode = "off";
  let renderWidth = DEFAULT_RENDER_WIDTH;
  let renderHeight = DEFAULT_RENDER_HEIGHT;
  let seed = 0;
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

    if (arg === "--public-dir") {
      index += 1;
      publicDir = readOptionValue(argv, index, arg);
      continue;
    }

    if (arg === "--decoder-assets-dir") {
      index += 1;
      decoderAssetsDir = path.resolve(cwd, readOptionValue(argv, index, arg));
      continue;
    }

    if (arg === "--allow-http-assets") {
      allowHttpAssets = true;
      continue;
    }

    if (arg === "--asset-mode") {
      index += 1;
      assetMode = parseNodeAssetLoaderMode(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg === "--determinism") {
      index += 1;
      determinism = parseDeterminismMode(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg === "--render-width") {
      index += 1;
      renderWidth = parsePositiveInteger(
        readOptionValue(argv, index, arg),
        arg,
      );
      continue;
    }

    if (arg === "--render-height") {
      index += 1;
      renderHeight = parsePositiveInteger(
        readOptionValue(argv, index, arg),
        arg,
      );
      continue;
    }

    if (arg === "--seed") {
      index += 1;
      seed = parseInteger(readOptionValue(argv, index, arg), arg);
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
      "The headless command requires --out <path> to write the render bundle.",
    );
  }

  return {
    configFile: path.resolve(cwd, configArg),
    out: path.resolve(cwd, out),
    frames,
    delta,
    ...(inject === undefined ? {} : { inject }),
    ...(root === undefined ? {} : { root }),
    publicDir,
    ...(decoderAssetsDir === undefined ? {} : { decoderAssetsDir }),
    allowHttpAssets,
    assetMode,
    determinism,
    renderWidth,
    renderHeight,
    seed,
    json,
  };
}

function parseNodeAssetLoaderMode(value: string): NodeAssetLoaderMode {
  if (value === "placeholder" || value === "hybrid" || value === "strict") {
    return value;
  }

  throw new ApertureCliError(
    "aperture.headless.invalidOption",
    "Option '--asset-mode' must be one of: placeholder, hybrid, strict.",
  );
}

function parseDeterminismMode(
  value: string,
): ApertureDeterminismDiagnosticsMode {
  if (value === "off" || value === "warn" || value === "error") {
    return value;
  }

  throw new ApertureCliError(
    "aperture.headless.invalidOption",
    "Option '--determinism' must be one of: off, warn, error.",
  );
}

function emitDeterminismDiagnostics(
  diagnostics: readonly ApertureSystemDiagnostic[],
  stderr: (text: string) => void,
): void {
  for (const diagnostic of determinismDiagnostics(diagnostics)) {
    const level = diagnostic.severity === "error" ? "error" : "warning";
    stderr(
      `${level} ${diagnostic.code}: ${formatDeterminismDiagnostic(
        diagnostic,
      )}\n`,
    );
  }
}

function assertDeterminismPolicy(
  mode: ApertureDeterminismDiagnosticsMode,
  diagnostics: readonly ApertureSystemDiagnostic[],
): void {
  if (mode !== "error") {
    return;
  }

  const failures = determinismDiagnostics(diagnostics);
  if (failures.length === 0) {
    return;
  }

  throw new ApertureCliError(
    "aperture.headless.determinismViolation",
    `Headless determinism policy failed with ${failures.length} nondeterministic global use(s).`,
  );
}

function determinismDiagnostics(
  diagnostics: readonly ApertureSystemDiagnostic[],
): readonly ApertureSystemDiagnostic[] {
  return diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "aperture.determinism.nondeterministicGlobal",
  );
}

function formatDeterminismDiagnostic(
  diagnostic: ApertureSystemDiagnostic,
): string {
  const data = diagnostic.data;
  const system =
    typeof data?.["system"] === "string" ? data["system"] : "unknown system";
  const phase =
    typeof data?.["phase"] === "string" ? data["phase"] : "unknown phase";
  const api = typeof data?.["api"] === "string" ? data["api"] : "unknown API";
  const suggestedApi =
    typeof data?.["suggestedApi"] === "string"
      ? data["suggestedApi"]
      : "context.random/context.time";

  return `${system} called ${api} during ${phase}; use ${suggestedApi} for deterministic replay.`;
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

function parseInteger(value: string, option: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new ApertureCliError(
      "aperture.headless.invalidOption",
      `Option '${option}' must be an integer.`,
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
and writes an aperture.render-bundle that 'aperture render' can turn into a PNG.

Arguments:
  <config>             Path to a mode: "headless" aperture config.

Options:
  --out <path>         Required. File to write the render bundle JSON.
  --frames <n>         Fixed steps to advance before extracting (default 1).
  --delta <seconds>    Fixed timestep delta (default ${DEFAULT_DELTA.toFixed(6)}).
  --seed <n>           Deterministic RNG seed for context.random (default 0).
  --inject <file>      JSON file of timed input steps to apply while stepping.
  --root <dir>         App root the system globs resolve against (default: config dir).
  --public-dir <dir>   Vite public directory for root-relative assets (default public).
  --decoder-assets-dir <dir>
                       Local decoder assets root for Draco, meshopt, and Basis/KTX2.
  --allow-http-assets  Allow HTTP(S) asset reads in Node asset loading (off by default).
  --asset-mode <mode>  Asset loading mode: placeholder, hybrid, strict (default hybrid).
  --determinism <mode> Nondeterministic global diagnostics: off, warn, error (default off).
  --render-width <n>   Bundle render target width (default ${DEFAULT_RENDER_WIDTH}).
  --render-height <n>  Bundle render target height (default ${DEFAULT_RENDER_HEIGHT}).
  --json               Print the headless status report as JSON to stdout.
  -h, --help           Show help.

Config loading: the config and *.system.ts are loaded by native Node
TypeScript stripping, so they must be erasable TypeScript (no enums,
decorators, namespaces, or parameter properties) and resolve @aperture-engine/*.
This strips types but does NOT type-check: a misplaced or misspelled option
(e.g. a top-level 'parent' that belongs in transform: { parent }) is silently
ignored. Run 'tsc --noEmit' (or the scaffold's 'pnpm typecheck') alongside
headless runs to catch these; spawn.mesh also warns on unrecognized options.

Determinism: stepping replays bit-identically only if systems read
context.random and context.time instead of Math.random()/Date.now()/
performance.now().

Assets: default mode is placeholder for a fast structural loop. Use
--asset-mode strict to require supported local assets (GLB/glTF, WGSL, audio,
PNG/JPEG textures, RGBE HDR environment maps, and decoder-backed
Draco/meshopt/Basis-KTX2 GLB/glTF assets) to load with real bytes, or
--asset-mode hybrid to load what Node supports and record placeholders for the
rest. Pass --decoder-assets-dir when compressed GLB/glTF assets need local
decoder files. HTTP(S) assets are disabled unless --allow-http-assets is passed.
`;
}
