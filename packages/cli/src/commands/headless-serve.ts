import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import type { ApertureSessionSnapshot } from "@aperture-engine/app/headless";
import type { ApertureDeterminismDiagnosticsMode } from "@aperture-engine/app/systems";
import type { ApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import { ApertureCliError } from "../errors.js";
import { loadApertureHeadlessApp } from "../headless/config-loader.js";
import type { NodeAssetLoaderMode } from "../headless/node-asset-loader.js";
import {
  createHeadlessSessionController,
  DEFAULT_HEADLESS_RENDER_HEIGHT,
  DEFAULT_HEADLESS_RENDER_WIDTH,
} from "../headless/session-controller.js";

const DEFAULT_RENDER_WIDTH = DEFAULT_HEADLESS_RENDER_WIDTH;
const DEFAULT_RENDER_HEIGHT = DEFAULT_HEADLESS_RENDER_HEIGHT;

interface ServeRequest {
  readonly id?: unknown;
  readonly cmd?: unknown;
  readonly params?: unknown;
}

/**
 * A warm, long-lived headless session. Boots the runner once, then reads
 * newline-delimited JSON commands from stdin and writes one response line per
 * request to stdout — giving shell agents the library's boot-once-then-step
 * loop without rebooting per call. Commands are processed strictly in order so
 * a step never interleaves with a mutation.
 */
export async function runHeadlessServeCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
  readonly stdin?: Readable;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(serveHelp());
    return 0;
  }

  const stderr = options.stderr ?? (() => undefined);
  const parsed = parseServeCommand(options.argv, options.cwd);
  const loaded = await loadApertureHeadlessApp({
    configFile: parsed.configFile,
    ...(parsed.root === undefined ? {} : { root: parsed.root }),
  });

  for (const diagnostic of loaded.diagnostics) {
    stderr(`warning ${diagnostic.code}: ${diagnostic.message}\n`);
  }

  const session = await createServeSession({
    config: loaded.config,
    systems: loaded.systems,
    seed: parsed.seed,
    assetMode: parsed.assetMode,
    root: parsed.root ?? path.dirname(parsed.configFile),
    publicDir: parsed.publicDir,
    allowHttpAssets: parsed.allowHttpAssets,
    ...(parsed.decoderAssetsDir === undefined
      ? {}
      : { decoderAssetsDir: parsed.decoderAssetsDir }),
    determinism: parsed.determinism,
  });

  emit(options.stdout, { ready: true, status: session.compactStatus() });

  await new Promise<void>((resolve) => {
    const reader = createInterface({
      input: options.stdin ?? process.stdin,
    });
    let chain = Promise.resolve();
    let shuttingDown = false;

    reader.on("line", (line: string) => {
      if (line.trim().length === 0) {
        return;
      }
      // Serialize handling so commands never interleave on the single world.
      chain = chain.then(async () => {
        if (shuttingDown) {
          return;
        }
        const response = await session.handle(line);
        emit(options.stdout, response);
        if (response.shutdown === true) {
          shuttingDown = true;
          reader.close();
        }
      });
    });

    reader.on("close", () => {
      void chain.then(() => resolve());
    });
  });

  return 0;
}

interface ServeResponse {
  readonly id?: unknown;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
  readonly error?: string;
  readonly shutdown?: boolean;
}

interface ToolResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}

async function createServeSession(args: {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly seed: number;
  readonly assetMode: NodeAssetLoaderMode;
  readonly root: string;
  readonly publicDir: string;
  readonly decoderAssetsDir?: string;
  readonly allowHttpAssets: boolean;
  readonly determinism: ApertureDeterminismDiagnosticsMode;
}): Promise<{
  compactStatus(): unknown;
  handle(line: string): Promise<ServeResponse>;
}> {
  const controller = await createHeadlessSessionController(args);

  async function handle(line: string): Promise<ServeResponse> {
    let request: ServeRequest;
    try {
      request = JSON.parse(line) as ServeRequest;
    } catch (error: unknown) {
      return {
        ok: false,
        error: `Invalid JSON command: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const id = request.id;
    const cmd = typeof request.cmd === "string" ? request.cmd : "";
    const params = isRecord(request.params) ? request.params : {};

    try {
      switch (cmd) {
        case "step": {
          return ok(id, controller.step(params));
        }
        case "extract": {
          return ok(id, controller.extract(params).result);
        }
        case "inject": {
          const result = controller.inject(params);
          return {
            id,
            ok: result.ok,
            ...(result.result === undefined ? {} : { result: result.result }),
            ...(result.diagnostics === undefined
              ? {}
              : { diagnostics: result.diagnostics }),
          };
        }
        case "get-status": {
          return ok(id, controller.status(params));
        }
        case "bundle": {
          const out = stringParam(params["out"]);
          if (out === undefined) {
            return fail(id, "The bundle command requires params.out.");
          }
          return ok(
            id,
            await controller.createBundle({
              out,
              width: positiveIntegerParam(
                params["width"],
                DEFAULT_RENDER_WIDTH,
              ),
              height: positiveIntegerParam(
                params["height"],
                DEFAULT_RENDER_HEIGHT,
              ),
              digest: params["digest"] === true,
              createdBy: "aperture serve",
            }),
          );
        }
        case "tool": {
          const name = stringParam(params["name"]);
          const toolResult: ToolResult =
            name === undefined
              ? toolUnavailable("(missing)")
              : controller.callTool({
                  name,
                  arguments: params["arguments"],
                });
          return {
            id,
            ok: toolResult.ok,
            ...(toolResult.result === undefined
              ? {}
              : { result: toolResult.result }),
            ...(toolResult.diagnostics === undefined
              ? {}
              : { diagnostics: toolResult.diagnostics }),
          };
        }
        case "command": {
          const channel = stringParam(params["channel"]);
          if (channel === undefined) {
            return fail(id, "The command command requires params.channel.");
          }
          return ok(
            id,
            controller.dispatchCommand({
              channel,
              payload: params["payload"],
            }),
          );
        }
        case "snapshot": {
          const out = stringParam(params["out"]);
          if (out === undefined) {
            return fail(id, "The snapshot command requires params.out.");
          }
          return ok(
            id,
            await controller.saveSessionSnapshot({
              out: path.resolve(args.root, out),
            }),
          );
        }
        case "restore": {
          const inline = isRecord(params["snapshot"])
            ? (params["snapshot"] as unknown as ApertureSessionSnapshot)
            : undefined;
          const inPath =
            stringParam(params["in"]) ?? stringParam(params["path"]);
          if (inline === undefined && inPath === undefined) {
            return fail(
              id,
              "The restore command requires params.in (a snapshot file path) or params.snapshot (an inline snapshot).",
            );
          }
          const snapshot =
            inline ??
            (JSON.parse(
              await readFile(path.resolve(args.root, inPath as string), "utf8"),
            ) as ApertureSessionSnapshot);
          const restored = await controller.restoreSessionSnapshot({
            snapshot,
          });
          // Surface a partial/failed restore at the envelope level instead of
          // hiding `result.ok === false` under a top-level ok:true (#64).
          const restoredOk = !(isRecord(restored) && restored["ok"] === false);
          return { id, ok: restoredOk, result: restored };
        }
        case "determinism": {
          return ok(id, controller.determinismReport());
        }
        case "reset": {
          return ok(
            id,
            await controller.reset({ seed: params["seed"] as number }),
          );
        }
        case "shutdown": {
          return { id, ok: true, result: { bye: true }, shutdown: true };
        }
        default: {
          return fail(id, `Unknown command '${cmd}'.`);
        }
      }
    } catch (error: unknown) {
      return {
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof ApertureCliError
          ? { diagnostics: [error.code] }
          : {}),
      };
    }
  }

  return { compactStatus: controller.compactStatus, handle };
}

function toolUnavailable(name: string): {
  readonly ok: boolean;
  readonly diagnostics: readonly unknown[];
} {
  return {
    ok: false,
    diagnostics: [
      {
        code: "aperture.headless.toolUnavailable",
        message: `Tool '${name}' is not available in a headless session.`,
      },
    ],
  };
}

function ok(id: unknown, result: unknown): ServeResponse {
  return { id, ok: true, result };
}

function fail(id: unknown, message: string): ServeResponse {
  return { id, ok: false, error: message };
}

function emit(stdout: (text: string) => void, value: unknown): void {
  stdout(`${JSON.stringify(value)}\n`);
}

function parseServeCommand(
  argv: readonly string[],
  cwd: string,
): {
  configFile: string;
  root?: string;
  publicDir: string;
  decoderAssetsDir?: string;
  allowHttpAssets: boolean;
  assetMode: NodeAssetLoaderMode;
  determinism: ApertureDeterminismDiagnosticsMode;
  seed: number;
} {
  let configArg: string | undefined;
  let root: string | undefined;
  let publicDir = "public";
  let decoderAssetsDir: string | undefined;
  let allowHttpAssets = false;
  // Hybrid by default, matching the one-shot headless command (#66).
  let assetMode: NodeAssetLoaderMode = "hybrid";
  let determinism: ApertureDeterminismDiagnosticsMode = "off";
  let seed = 0;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
    if (arg === "--seed") {
      index += 1;
      seed = Number(readOptionValue(argv, index, arg));
      if (!Number.isFinite(seed)) {
        throw new ApertureCliError(
          "aperture.headless.invalidOption",
          "Option '--seed' must be a finite number.",
        );
      }
      continue;
    }
    if (arg === "--determinism") {
      index += 1;
      determinism = parseDeterminismMode(readOptionValue(argv, index, arg));
      continue;
    }
    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.headless.unknownOption",
        `Unknown serve option '${arg}'. Run 'aperture headless serve --help'.`,
      );
    }
    if (configArg !== undefined) {
      throw new ApertureCliError(
        "aperture.headless.tooManyArguments",
        "The serve command accepts one config path.",
      );
    }
    configArg = arg;
  }

  if (configArg === undefined || configArg.length === 0) {
    throw new ApertureCliError(
      "aperture.headless.missingConfig",
      "The serve command requires a config path: 'aperture headless serve aperture.headless.config.ts'.",
    );
  }

  return {
    configFile: path.resolve(cwd, configArg),
    ...(root === undefined ? {} : { root }),
    publicDir,
    ...(decoderAssetsDir === undefined ? {} : { decoderAssetsDir }),
    allowHttpAssets,
    assetMode,
    determinism,
    seed,
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

function positiveIntegerParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function serveHelp(): string {
  return `Usage:
  aperture headless serve <config> [--root <dir>] [--seed <n>] [--asset-mode <mode>]

Boots a headless app once and reads newline-delimited JSON commands from stdin,
writing one JSON response line per request to stdout — a warm session for the
boot-once-then-step loop. Commands run strictly in order.

On start it emits: { "ready": true, "status": { ... } }

Each request is { "id": <any>, "cmd": <string>, "params"?: <object> }:
  step      { delta?, time?, frames?, extract? } Advance fixed step(s). Pass
                                   extract:false to skip per-frame render
                                   extraction (much faster at scale).
  extract   { frame? }             Extract the current render snapshot.
  inject    { pointer?, actions? } Apply input (see 'aperture headless --inject').
  command   { channel, payload? }  Post an app command onto the command bus for
                                   systems to drain on the next step.
  get-status                       Full headless status report (includes seed).
  bundle    { out, width?, height? } Write a render bundle to a file.
  snapshot  { out }                Save a SessionSnapshot (checkpoint) to a file.
  restore   { in | snapshot }      Restore a SessionSnapshot from a file or inline.
  determinism                      Determinism report (violations + digests).
  tool      { name, arguments? }   Call ECS, camera, asset, resource, or input
                                   tools against the warm headless session.
  reset     { seed? }              Rebuild a fresh deterministic world.
  shutdown                         Exit the session.

Determinism: with --determinism error, a step that uses a nondeterministic
global (Math.random/Date.now/performance.now) fails; every step result also
echoes any determinism violations under result.determinism.

Options:
  --root <dir>         App root the system globs resolve against (default: config dir).
  --public-dir <dir>   Vite public directory for root-relative assets (default public).
  --decoder-assets-dir <dir>
                       Local decoder assets root for Draco, meshopt, and Basis/KTX2.
  --allow-http-assets  Allow HTTP(S) asset reads in Node asset loading (off by default).
  --asset-mode <mode>  Asset loading mode: placeholder, hybrid, strict (default hybrid).
  --determinism <mode> Nondeterministic global diagnostics: off, warn, error (default off).
  --seed <n>           Deterministic RNG seed (default 0).
  -h, --help           Show help.
`;
}
