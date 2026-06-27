import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import type { ApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "@aperture-engine/app/headless-tools";
import { ApertureCliError } from "../errors.js";
import { loadApertureHeadlessApp } from "../headless/config-loader.js";
import { createNodeApertureAssetLoader } from "../headless/node-asset-loader.js";
import { applyApertureHeadlessInjectStep } from "../headless/inject.js";
import { createApertureSnapshotBundle } from "../headless/bundle.js";

const DEFAULT_DELTA = 1 / 60;

interface ServeRequest {
  readonly id?: unknown;
  readonly cmd?: unknown;
  readonly params?: unknown;
}

interface ToolResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
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

async function createServeSession(args: {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly seed: number;
}): Promise<{
  compactStatus(): unknown;
  handle(line: string): Promise<ServeResponse>;
}> {
  let runner: ApertureHeadlessRunner;
  let entityTools: GeneratedEntityToolBridge;
  let elapsed = 0;

  async function boot(seed: number): Promise<void> {
    runner = await createApertureHeadlessRunner({
      config: args.config,
      systems: args.systems,
      assetLoader: createNodeApertureAssetLoader(),
      random: seed,
    });
    await runner.app.preload;
    entityTools = createGeneratedEntityToolBridge(runner.app.lowLevel.world);
    elapsed = 0;
  }

  await boot(args.seed);

  function compactStatus(): unknown {
    const status = runner.getStatus();
    return {
      mode: status.mode,
      nextFrame: status.nextFrame,
      placeholders:
        runner.app.lowLevel.assets.createManifestReport().placeholders,
    };
  }

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
          const delta = numberParam(params["delta"], DEFAULT_DELTA);
          elapsed = numberParam(params["time"], elapsed + delta);
          const report = runner.step(delta, elapsed);
          return ok(id, {
            nextFrame: report.status.nextFrame,
            counts: report.status.lastSnapshot?.counts ?? null,
          });
        }
        case "extract": {
          const report = runner.extract(
            numberParam(params["frame"], runner.getStatus().nextFrame),
          );
          return ok(id, {
            frame: report.snapshot.frame,
            counts: report.status.lastSnapshot?.counts ?? null,
          });
        }
        case "inject": {
          applyApertureHeadlessInjectStep(runner.app.context.input, params);
          return ok(id, { injected: true });
        }
        case "get-status": {
          return ok(id, runner.getStatus());
        }
        case "bundle": {
          const out = stringParam(params["out"]);
          if (out === undefined) {
            return fail(id, "The bundle command requires params.out.");
          }
          const bundle = createApertureSnapshotBundle({
            snapshot: runner.extract().snapshot,
            assets: runner.app.lowLevel.assets,
          });
          await mkdir(path.dirname(out), { recursive: true });
          await writeFile(out, `${JSON.stringify(bundle)}\n`, "utf8");
          return ok(id, {
            path: out,
            frame: bundle.frame,
            assetProvenance: bundle.assetProvenance,
          });
        }
        case "tool": {
          const toolResult = callTool(params);
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
        case "reset": {
          await boot(numberParam(params["seed"], args.seed));
          return ok(id, { reset: true, status: compactStatus() });
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
        ...(error instanceof ApertureCliError ? { diagnostics: [error.code] } : {}),
      };
    }
  }

  function callTool(params: Record<string, unknown>): ToolResult {
    const name = stringParam(params["name"]);
    const toolArgs = params["arguments"];

    if (name === undefined) {
      return toolUnavailable("(missing)");
    }

    // v1 routes the ECS inspection/mutation tools through the in-process entity
    // bridge — the core of the warm inspect/diff loop. Input is driven by the
    // native `inject` command. Everything else (camera_/browser_/render_/
    // physics_/resource_…) needs a GPU/browser or is not wired yet.
    if (name.startsWith("ecs_")) {
      return entityTools.call(name, toolArgs);
    }

    return toolUnavailable(name);
  }

  return { compactStatus, handle };
}

function toolUnavailable(name: string): ToolResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: "aperture.headless.toolUnavailable",
        message: `Tool '${name}' is not available in a headless session (v1 routes ecs_* tools; use the inject command for input, and 'aperture render' for pixels).`,
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
): { configFile: string; root?: string; seed: number } {
  let configArg: string | undefined;
  let root: string | undefined;
  let seed = 0;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      index += 1;
      root = path.resolve(cwd, readOptionValue(argv, index, arg));
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
    seed,
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

function numberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
  aperture headless serve <config> [--root <dir>] [--seed <n>]

Boots a headless app once and reads newline-delimited JSON commands from stdin,
writing one JSON response line per request to stdout — a warm session for the
boot-once-then-step loop. Commands run strictly in order.

On start it emits: { "ready": true, "status": { ... } }

Each request is { "id": <any>, "cmd": <string>, "params"?: <object> }:
  step      { delta?, time? }      Advance one fixed step.
  extract   { frame? }             Extract the current render snapshot.
  inject    { pointer?, actions? } Apply input (see 'aperture headless --inject').
  get-status                       Full headless status report.
  bundle    { out }                Write a render-snapshot bundle to a file.
  tool      { name, arguments? }   Call an ecs_* tool (ecs_find_entities,
                                   ecs_snapshot, ecs_diff, ecs_get_entity,
                                   ecs_set_component_field, ...).
  reset     { seed? }              Rebuild a fresh deterministic world.
  shutdown                         Exit the session.

Options:
  --root <dir>   App root the system globs resolve against (default: config dir).
  --seed <n>     Deterministic RNG seed (default 0).
  -h, --help     Show help.
`;
}
