import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { ApertureCliError } from "../errors.js";
import { isPngBlank } from "../tools/png-readback.js";
import {
  createApertureRenderSession,
  type ApertureRenderSession,
} from "../render/driver.js";
import {
  getApertureSnapshotBundleRenderTarget,
  preflightApertureSnapshotBundle,
} from "../headless/bundle.js";
import { readApertureRenderBundleFile } from "./render.js";

interface ServeRequest {
  readonly id?: unknown;
  readonly cmd?: unknown;
  readonly params?: unknown;
}

interface ServeResponse {
  readonly id?: unknown;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
  readonly error?: string;
  readonly shutdown?: boolean;
}

/**
 * A warm, long-lived render slot (#61): boots the browser (+ Xvfb on GPU-less
 * Linux) once, then reads newline-delimited JSON render requests from stdin
 * and writes one response line per request — so rendering N frames costs one
 * boot plus N rasterizations instead of N boots. The one-shot
 * `aperture render` stays the default; this is the opt-in amortized loop.
 */
export async function runRenderServeCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
  readonly stdin?: Readable;
}): Promise<number> {
  if (options.argv.some(isHelpFlag)) {
    options.stdout(renderServeHelp());
    return 0;
  }

  for (const arg of options.argv) {
    if (arg.startsWith("-")) {
      throw new ApertureCliError(
        "aperture.render.unknownOption",
        `Unknown render serve option '${arg}'. Run 'aperture render serve --help'.`,
      );
    }
  }

  // Size the auto-provisioned virtual display generously up front — it cannot
  // grow later, and per-render canvases must fit inside it.
  const session = await createApertureRenderSession({
    displayWidth: 1920,
    displayHeight: 1080,
  });

  emit(options.stdout, { ready: true, browser: session.browser });

  try {
    await new Promise<void>((resolve) => {
      const reader = createInterface({ input: options.stdin ?? process.stdin });
      let chain = Promise.resolve();
      let shuttingDown = false;

      reader.on("line", (line: string) => {
        if (line.trim().length === 0) {
          return;
        }
        // Serialize handling: the warm harness renders one bundle at a time.
        chain = chain.then(async () => {
          if (shuttingDown) {
            return;
          }
          const response = await handle(session, line, options.cwd);
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
  } finally {
    await session.dispose();
  }

  return 0;
}

async function handle(
  session: ApertureRenderSession,
  line: string,
  cwd: string,
): Promise<ServeResponse> {
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
      case "render": {
        return { id, ...(await renderOne(session, params, cwd)) };
      }
      case "shutdown": {
        return { id, ok: true, result: { bye: true }, shutdown: true };
      }
      default: {
        return { id, ok: false, error: `Unknown command '${cmd}'.` };
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

async function renderOne(
  session: ApertureRenderSession,
  params: Record<string, unknown>,
  cwd: string,
): Promise<Omit<ServeResponse, "id">> {
  const bundlePath = stringParam(params["in"]) ?? stringParam(params["bundle"]);
  const out = stringParam(params["out"]);

  if (bundlePath === undefined) {
    return {
      ok: false,
      error: "The render command requires params.in (a render bundle path).",
    };
  }
  if (out === undefined) {
    return {
      ok: false,
      error: "The render command requires params.out (the PNG path to write).",
    };
  }

  const bundle = await readApertureRenderBundleFile(
    path.resolve(cwd, bundlePath),
  );
  const renderTarget = getApertureSnapshotBundleRenderTarget(bundle);
  const width = positiveIntegerParam(params["width"], renderTarget.width);
  const height = positiveIntegerParam(params["height"], renderTarget.height);
  const allowPlaceholders = params["allowPlaceholders"] === true;
  const preflight = preflightApertureSnapshotBundle(bundle, {
    allowPlaceholders,
  });

  if (!preflight.ok) {
    return {
      ok: false,
      error: `Snapshot bundle '${bundlePath}' is not render-complete: ${preflight.violations.join("; ")}.`,
      diagnostics: ["aperture.render.incompleteBundle"],
    };
  }

  const { png, frame, metadata } = await session.render({
    bundle,
    width,
    height,
  });

  if (params["allowBlank"] !== true && isPngBlank(png)) {
    return {
      ok: false,
      error:
        "The rendered frame is blank (a single flat color). Pass allowBlank: true to write it anyway.",
      diagnostics: ["aperture.render.blankFrame"],
    };
  }

  const outPath = path.resolve(cwd, out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, png);

  return {
    ok: true,
    result: {
      out: outPath,
      frame,
      pngBytes: png.byteLength,
      requestedDimensions: metadata.requestedDimensions,
      actualDimensions: metadata.actualDimensions,
      ...(preflight.closure.placeholders.length === 0
        ? {}
        : { placeholders: preflight.closure.placeholders }),
    },
  };
}

function emit(stdout: (text: string) => void, value: unknown): void {
  stdout(`${JSON.stringify(value)}\n`);
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveIntegerParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function renderServeHelp(): string {
  return `Usage:
  aperture render serve

Boots the render browser once (auto-provisioning an Xvfb virtual display on a
GPU-less Linux host) and reads newline-delimited JSON render requests from
stdin, writing one JSON response line per request — a warm render slot that
amortizes the multi-second browser boot across many renders (the step loop's
counterpart to 'aperture headless serve'). Each render runs in a fresh page,
so no state leaks between bundles.

On start it emits: { "ready": true, "browser": { ... } }

Each request is { "id": <any>, "cmd": <string>, "params"?: <object> }:
  render    { in, out, width?, height?, allowBlank?, allowPlaceholders? }
            Render the bundle at 'in' to the PNG at 'out'. width/height
            default to the bundle's render target.
  shutdown  Close the browser and exit.

Options:
  -h, --help           Show help.
`;
}
