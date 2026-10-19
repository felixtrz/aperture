import { randomUUID } from "node:crypto";
import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  decodeTypedArrayTree,
  inspectCoplanarMeshOverlaps,
  renderSnapshotFromJsonValue,
  type CoplanarOverlapOptions,
  type MeshAsset,
  type SourceMaterialAsset,
} from "@aperture-engine/render";
import {
  normalizeApertureSnapshotBundle,
  preflightApertureSnapshotBundle,
} from "../headless/bundle.js";
import { ApertureCliError } from "../errors.js";

/** Offline data inspection only: no app evaluation, mutation, GPU or browser. */
export async function runInspectCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.includes("--help") || options.argv.includes("-h")) {
    options.stdout(help());
    return 0;
  }
  const [command, ...args] = options.argv;
  if (command !== "coplanar")
    throw usage(
      "Use 'aperture inspect coplanar <job.json> [--out <report.json>]'.",
    );
  let input: string | undefined, output: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--out") {
      const value = args[++i];
      if (output || !value || value.startsWith("-"))
        throw usage("--out requires one report path.");
      output = path.resolve(options.cwd, value);
    } else if (arg.startsWith("-") || input)
      throw usage(`Unexpected argument '${arg}'.`);
    else input = path.resolve(options.cwd, arg);
  }
  if (!input) throw usage("Provide an inspection job JSON path.");
  const job = await readJson(input);
  if (!record(job) || typeof job.bundle !== "string" || job.bundle.length === 0)
    throw usage("Job requires a bundle path and explicit scope.");
  for (const key of Object.keys(job))
    if (!["bundle", "scope", "tolerances", "limits", "viewId"].includes(key))
      throw usage(`Unknown job field '${key}'.`);
  const bundlePath = path.resolve(path.dirname(input), job.bundle);
  const bundle = await readJson(bundlePath);
  const normalized = normalizeApertureSnapshotBundle(bundle);
  if (!normalized.valid)
    throw new ApertureCliError(
      "aperture.inspect.invalidBundle",
      normalized.violations.join(" "),
    );
  const preflight = preflightApertureSnapshotBundle(bundle);
  const snapshot = renderSnapshotFromJsonValue(normalized.snapshot);
  const decoded = decodeTypedArrayTree(normalized.sourceAssets);
  if (!record(decoded) || !Array.isArray(decoded.entries))
    throw usage("Bundle must embed source asset entries.");
  const assets = new Map<string, unknown>();
  for (const entry of decoded.entries) {
    if (
      record(entry) &&
      entry.status === "ready" &&
      record(entry.handle) &&
      typeof entry.handle.kind === "string" &&
      typeof entry.handle.id === "string"
    )
      assets.set(`${entry.handle.kind}:${entry.handle.id}`, entry.asset);
  }
  const inspectionOptions = {
    scope: job.scope,
    ...(job.tolerances === undefined ? {} : { tolerances: job.tolerances }),
    ...(job.limits === undefined ? {} : { limits: job.limits }),
    ...(job.viewId === undefined ? {} : { viewId: job.viewId }),
  } as CoplanarOverlapOptions;
  // The public helper validates the options and each selected asset/range.
  const inspection = inspectCoplanarMeshOverlaps({
    ...inspectionOptions,
    snapshot,
    resolveMesh: (handle) =>
      assets.get(`mesh:${handle.id}`) as MeshAsset | undefined,
    resolveMaterial: (handle) =>
      assets.get(`material:${handle.id}`) as SourceMaterialAsset | undefined,
  });
  const report = {
    ...inspection,
    coverage: preflight.ok ? inspection.coverage : "partial",
    diagnostics: [
      ...inspection.diagnostics,
      ...preflight.violations.map((message) => ({
        code: "bundle-preflight",
        message,
      })),
    ],
    source: { bundle: bundlePath, frame: normalized.frame },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output !== undefined) {
    // Resolve parent aliases before atomically replacing the output entry.
    output = path.join(
      await realpath(path.dirname(output)),
      path.basename(output),
    );
    for (const source of [input, bundlePath]) {
      const sourceEntry = path.join(
        await realpath(path.dirname(source)),
        path.basename(source),
      );
      if (output === sourceEntry || output === (await realpath(source)))
        throw usage(
          "Report path must differ from both input job and bundle, including filesystem aliases.",
        );
    }
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, serialized, { flag: "wx" });
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  options.stdout(serialized);
  return 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function usage(message: string): ApertureCliError {
  return new ApertureCliError("aperture.inspect.usage", message);
}
async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.inspect.readFailed",
      `Cannot read JSON '${file}': ${String(error)}`,
    );
  }
}
function help(): string {
  return `Usage:
  aperture inspect coplanar <job.json> [--out <report.json>]

Inspect selected static triangle draws from a portable bundle on the CPU.
Findings are potential positive-area coplanar overlaps, not visible-defect
verdicts. Shared edges are excluded. No scene, renderer or GPU is started.

Job (bundle path is relative to the job):
{"bundle":"scene.bundle.json","scope":{"meshIds":["base.mesh","panel.mesh"]}}

scope: exact meshIds and/or entities [{index,generation}], or explicit all:true.
viewId optionally filters by camera layers only; visibility stays unknown.
tolerances: distance (world units, 1e-6), relativeDistance (1e-7),
            angleRadians (1e-5), minArea (world units squared, 0).
limits: maxDraws (64), maxTriangles (50000), maxTrianglePairs (1000000),
        maxFindings (200). Exhaustion/unsupported data reports partial coverage.
JSON goes to stdout; --out also writes a separate report atomically.
Exit 0 means a report was produced, even with overlaps or partial coverage.
Exit 1 means invalid input or I/O failure. Read coverage and diagnostics.
See docs/COPLANAR_OVERLAP_INSPECTION.md for geometry and visibility limits.
`;
}
