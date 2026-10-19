import { randomUUID } from "node:crypto";
import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import {
  callCameraTool,
  type GeneratedDevtoolsToolResult,
} from "@aperture-engine/app/headless-tools";
import { ApertureCliError } from "../errors.js";
import { loadApertureHeadlessApp } from "../headless/config-loader.js";
import {
  disposeHeadlessRunner,
  headlessDisposeFailureMessage,
} from "../headless/dispose-runner.js";
import {
  createNodeApertureAssetLoader,
  type NodeAssetLoaderMode,
} from "../headless/node-asset-loader.js";

interface InspectionOptions {
  readonly configFile: string;
  readonly request?: string;
  readonly requestResource?: string;
  readonly out?: string;
  readonly root?: string;
  readonly publicDir: string;
  readonly decoderAssetsDir?: string;
  readonly assetMode: NodeAssetLoaderMode;
  readonly allowHttpAssets: boolean;
  readonly seed: number;
}

export async function runCameraInspectLocalCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  if (options.argv.some((arg) => arg === "--help" || arg === "-h")) {
    options.stdout(cameraInspectLocalHelp());
    return 0;
  }
  const parsed = parseOptions(options.argv, options.cwd);
  const stderr = options.stderr ?? (() => undefined);
  const explicitRequest =
    parsed.request === undefined
      ? undefined
      : await readRequest(parsed.request);
  const out = await resolveOutput(parsed);
  const loaded = await loadApertureHeadlessApp({
    configFile: parsed.configFile,
    ...(parsed.root === undefined ? {} : { root: parsed.root }),
  });
  for (const diagnostic of loaded.diagnostics)
    stderr(`warning ${diagnostic.code}: ${diagnostic.message}\n`);

  // Runner construction awaits blocking assets and app initialization. Its
  // preload field is a report, not a promise; background assets may be pending.
  // The session controller would synchronize authored autoAspect camera fields.
  const runner = await createApertureHeadlessRunner({
    config: loaded.config,
    systems: loaded.systems,
    random: parsed.seed,
    assetLoader: createNodeApertureAssetLoader({
      mode: parsed.assetMode,
      root: loaded.root,
      publicDir: parsed.publicDir,
      allowHttp: parsed.allowHttpAssets,
      ...(parsed.decoderAssetsDir === undefined
        ? {}
        : { decoderAssetsDir: parsed.decoderAssetsDir }),
    }),
  });
  let failed = false;
  let primaryError: unknown;
  let cleanupErrors: readonly unknown[];
  let response: GeneratedDevtoolsToolResult | undefined;
  try {
    let request = explicitRequest;
    if (parsed.requestResource !== undefined) {
      const entry = runner.app.context.resources
        .summary()
        .entries.find((item) => item.id === parsed.requestResource);
      if (entry === undefined) {
        response = {
          ok: false,
          diagnostics: [
            {
              code: "aperture.camera.local.requestResourceNotFound",
              severity: "error",
              message: `Request resource '${parsed.requestResource}' is not initialized.`,
              suggestedFix:
                "Initialize the resource during app setup and store the camera_inspect_local arguments in values.request, or use --request <args.json>.",
            },
          ],
        };
      } else request = entry.values["request"];
    }
    for (const id of runner.app.lowLevel.assets.createManifestReport()
      .placeholders.ids)
      stderr(
        `warning aperture.headless.assetPlaceholder: asset '${id}' loaded as a Node placeholder; use --asset-mode strict for measurements of supported source assets. Placeholder bounds do not prove the original geometry.\n`,
      );
    response ??=
      validateArguments(request) ??
      callCameraTool(
        runner.app,
        createApertureDevtoolsRequest({
          requestId: "camera-inspect-local",
          tool: "camera_inspect_local",
          payload: request,
        }),
        new Map(),
      );
  } catch (error: unknown) {
    failed = true;
    primaryError = error;
  } finally {
    try {
      cleanupErrors = await disposeHeadlessRunner(runner);
    } catch (error: unknown) {
      cleanupErrors = [error];
    }
  }
  if (failed) {
    for (const error of cleanupErrors) {
      try {
        stderr(
          `warning aperture.headless.runnerDisposeFailed: ${headlessDisposeFailureMessage(error)}\n`,
        );
      } catch {
        // A diagnostic sink must not replace the original command error.
      }
    }
    throw primaryError;
  }
  if (cleanupErrors.length > 0)
    throw new AggregateError(
      cleanupErrors,
      `Failed to dispose the camera inspection runner: ${cleanupErrors.map(headlessDisposeFailureMessage).join("; ")}${response?.ok === false ? `; inspection diagnostics: ${JSON.stringify(response.diagnostics)}` : ""}`,
    );
  const serialized = `${JSON.stringify(response, null, 2)}\n`;
  if (out !== undefined) await writeReport(out, serialized);
  options.stdout(serialized);
  return response!.ok ? 0 : 2;
}

function validateArguments(
  request: unknown,
): GeneratedDevtoolsToolResult | null {
  // The shared camera tool validates every nested field. Its dispatcher selects
  // known top-level arguments, so reject extra fields before that selection.
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Object.keys(request).some(
      (key) => !["camera", "viewport", "subjects", "cameraJob"].includes(key),
    )
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.local.invalidInspection",
          severity: "error",
          message:
            "The inspection request must be an object containing only camera, viewport, subjects, and optional cameraJob.",
          suggestedFix:
            "Pass the exact camera_inspect_local arguments in the request JSON or resource values.request; saved inspection results and target routing fields are not requests.",
        },
      ],
    };
  }
  return null;
}

function parseOptions(argv: readonly string[], cwd: string): InspectionOptions {
  const values = new Map<string, string>();
  let config: string | undefined;
  let allowHttpAssets = false;
  const valueOptions = [
    "--request",
    "--request-resource",
    "--out",
    "--seed",
    "--root",
    "--public-dir",
    "--decoder-assets-dir",
    "--asset-mode",
  ];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--allow-http-assets" && !allowHttpAssets) {
      allowHttpAssets = true;
    } else if (valueOptions.includes(arg) && !values.has(arg)) {
      const value = argv[++index];
      if (
        value === undefined ||
        value.trim() === "" ||
        (value.startsWith("-") &&
          !(arg === "--seed" && Number.isInteger(Number(value))))
      )
        throw usage(`${arg} requires one value.`);
      values.set(arg, value);
    } else if (
      arg.startsWith("-") ||
      config !== undefined ||
      arg.trim() === ""
    ) {
      throw usage(`Unexpected or repeated argument '${arg}'.`);
    } else config = path.resolve(cwd, arg);
  }
  if (config === undefined)
    throw usage("Provide a mode: 'headless' config path.");
  if (values.has("--request") === values.has("--request-resource"))
    throw usage(
      "Provide exactly one of --request <args.json> or --request-resource <resource-id>.",
    );
  const seedText = values.get("--seed") ?? "0";
  const seed = Number(seedText);
  if (!Number.isInteger(seed))
    throw usage("--seed must be an integer, as for aperture headless.");
  const assetMode = values.get("--asset-mode") ?? "strict";
  if (
    assetMode !== "strict" &&
    assetMode !== "hybrid" &&
    assetMode !== "placeholder"
  )
    throw usage("--asset-mode must be strict, hybrid, or placeholder.");
  const optionalPath = (flag: string) => {
    const value = values.get(flag);
    return value === undefined ? undefined : path.resolve(cwd, value);
  };
  return {
    configFile: config,
    ...(values.has("--request") ? { request: optionalPath("--request")! } : {}),
    ...(values.has("--request-resource")
      ? { requestResource: values.get("--request-resource")! }
      : {}),
    ...(values.has("--out") ? { out: optionalPath("--out")! } : {}),
    ...(values.has("--root") ? { root: optionalPath("--root")! } : {}),
    ...(values.has("--decoder-assets-dir")
      ? { decoderAssetsDir: optionalPath("--decoder-assets-dir")! }
      : {}),
    publicDir: values.get("--public-dir") ?? "public",
    assetMode,
    allowHttpAssets,
    seed,
  };
}

function usage(message: string): ApertureCliError {
  return new ApertureCliError(
    "aperture.camera.usage",
    `${message} Run 'aperture camera inspect-local --help'.`,
  );
}

async function readRequest(file: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.readFailed",
      `Cannot read request '${file}': ${String(error)}`,
    );
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new ApertureCliError(
      "aperture.camera.invalidJson",
      `Inspection request '${file}' is not valid JSON.`,
    );
  }
}

async function resolveOutput(
  parsed: InspectionOptions,
): Promise<string | undefined> {
  if (parsed.out === undefined) return undefined;
  let output: string;
  try {
    // Rename replaces the leaf directory entry. Resolve only the output parent
    // and use that same path for writing, guarding directory aliases as well.
    output = path.join(
      await realpath(path.dirname(parsed.out)),
      path.basename(parsed.out),
    );
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.writeFailed",
      `Cannot resolve report parent '${parsed.out}': ${String(error)}`,
    );
  }
  for (const input of [
    parsed.configFile,
    ...(parsed.request === undefined ? [] : [parsed.request]),
  ]) {
    let target: string, entry: string;
    try {
      target = await realpath(input);
      entry = path.join(
        await realpath(path.dirname(input)),
        path.basename(input),
      );
    } catch (error) {
      throw new ApertureCliError(
        "aperture.camera.readFailed",
        `Cannot resolve input '${input}': ${String(error)}`,
      );
    }
    if (output === target || output === entry)
      throw usage(
        "The output report must differ from the config and request inputs, including filesystem aliases.",
      );
  }
  return output;
}

async function writeReport(output: string, serialized: string): Promise<void> {
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, serialized, { flag: "wx" });
    await rename(temporary, output);
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.writeFailed",
      `Cannot write report '${output}': ${String(error)}`,
    );
  } finally {
    // Preserve an I/O failure even when removing its temporary file also fails.
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export function cameraInspectLocalHelp(): string {
  return `Usage:
  aperture camera inspect-local <headless-config> --request-resource <resource-id> [options]
  aperture camera inspect-local <headless-config> --request <args.json> [options]

Boot a CPU app and freshly inspect its authored camera/local geometry once.
Exactly one request source is required. The JSON file or initialized resource's
values.request must contain the exact camera_inspect_local arguments:
  { camera: { key } OR { index, generation }, viewport: { width, height },
    subjects: [...], cameraJob?: { referenceDistance } }
Saved inspection results are never reused. Blocking assets and app setup finish
before inspection; background/manual assets may leave bounds incomplete.
No simulation step, extraction, camera fitting/application, or aspect mutation.
No browser, renderer or GPU. Request viewport controls inspection autoAspect.

Options:
  --out <report.json>         Also write the full tool envelope atomically.
  --seed <integer>            App RNG seed (default 0; match the capture seed).
  --root <path>               System discovery/asset root (default config directory).
  --public-dir <path>         Public assets (default public, relative to root).
  --asset-mode <mode>         strict (default), hybrid, or placeholder.
  --decoder-assets-dir <dir>  Existing Node loader decoder assets.
  --allow-http-assets         Opt into HTTP(S) asset fetching.

The output must differ from the config/request inputs, including aliases.
JSON stdout and --out preserve {ok,result,diagnostics}; put app logs on stderr.
Exit 0: ok:true (inspect completeness/export diagnostics separately).
Exit 2: handled request/resource/tool failure with ok:false and diagnostics.
Exit 1: usage, malformed JSON, I/O, bootstrap or disposal exception. Disposal
finishes before publishing a report; cleanup failure preserves any prior report.
Full source-owned request example: docs/CAMERA_LOCAL_INSPECTION.md
`;
}
