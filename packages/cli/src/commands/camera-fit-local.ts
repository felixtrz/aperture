import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CameraLocalInspectionReport } from "@aperture-engine/app/systems";
import { ApertureCliError } from "../errors.js";
import { fitCameraLandmarks } from "../camera/landmarks.js";
import {
  createLocalFitJob,
  parseCameraFitLocalPlan,
} from "../camera/fit-local-plan.js";
import {
  inspectLocalCamera,
  resolveCameraReportOutput,
  writeCameraReport,
} from "./camera-inspect-local.js";

export async function runCameraFitLocalCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  if (options.argv.some((arg) => arg === "--help" || arg === "-h")) {
    options.stdout(cameraFitLocalHelp());
    return 0;
  }
  const parsed = parseOptions(options.argv, options.cwd);
  let source: string;
  try {
    source = await readFile(parsed.fitPlan, "utf8");
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.readFailed",
      `Cannot read fit-plan '${parsed.fitPlan}': ${String(error)}`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ApertureCliError(
      "aperture.camera.invalidJson",
      `Fit-plan '${parsed.fitPlan}' is not valid JSON.`,
    );
  }
  const plan = parseCameraFitLocalPlan(value);
  const out = await resolveCameraReportOutput(parsed.out, [
    parsed.configFile,
    parsed.fitPlan,
  ]);
  const inspection = await inspectLocalCamera(
    {
      configFile: parsed.configFile,
      requestResource: parsed.requestResource,
      seed: parsed.seed,
      publicDir: "public",
      assetMode: "strict",
      allowHttpAssets: false,
    },
    undefined,
    options.stderr ?? (() => undefined),
  );
  // This tool result is produced by the shared, validating camera dispatcher.
  // Full export (including nonselected points) has already been checked.
  const current = inspection.ok
    ? (inspection.result as CameraLocalInspectionReport)
    : null;
  const seed = current?.cameraJob;
  const job = seed ? createLocalFitJob(seed, plan) : null;
  // Preserve typed invalid-job/initial-conditioning errors. They do not publish
  // a completed fit, and an old output is never read as a fallback input.
  const result = job === null ? null : fitCameraLandmarks(job);
  const ok = result?.fit.accepted ?? false;
  const report = {
    schema: "aperture.camera.fit-local.v1",
    ok,
    stage: !inspection.ok ? "inspection" : seed == null ? "export" : "fit",
    inputs: {
      config: parsed.configFile,
      requestResource: parsed.requestResource,
      fitPlan: parsed.fitPlan,
      seed: parsed.seed,
    },
    plan,
    inspection,
    inspectionCamera: "current-authored-camera",
    job,
    result,
    cameraApplied: false,
    diagnostics: !inspection.ok
      ? inspection.diagnostics
      : seed == null
        ? current!.cameraJobDiagnostics.length > 0
          ? current!.cameraJobDiagnostics
          : [
              {
                code: "aperture.camera.local.unsupportedJobExport",
                severity: "error",
                message:
                  "The source-owned request must explicitly request cameraJob with referenceDistance before fitting.",
              },
            ]
        : [],
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (out !== undefined) await writeCameraReport(out, serialized);
  options.stdout(serialized);
  return ok ? 0 : 2;
}

function parseOptions(argv: readonly string[], cwd: string) {
  const values = new Map<string, string>();
  const flags = ["--request-resource", "--fit-plan", "--seed", "--out"];
  let configFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (flags.includes(arg) && !values.has(arg)) {
      const value = argv[++i];
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
      configFile !== undefined ||
      arg.trim() === ""
    ) {
      throw usage(`Unexpected or repeated argument '${arg}'.`);
    } else configFile = path.resolve(cwd, arg);
  }
  const requestResource = values.get("--request-resource");
  const fitPlan = values.get("--fit-plan");
  const seedText = values.get("--seed");
  if (
    configFile === undefined ||
    requestResource === undefined ||
    fitPlan === undefined ||
    seedText === undefined
  )
    throw usage(
      "Provide a headless config, --request-resource, --fit-plan and explicit --seed.",
    );
  const seed = Number(seedText);
  if (!Number.isInteger(seed)) throw usage("--seed must be an integer.");
  const out = values.get("--out");
  return {
    configFile,
    requestResource,
    fitPlan: path.resolve(cwd, fitPlan),
    seed,
    out: out === undefined ? undefined : path.resolve(cwd, out),
  };
}

function usage(message: string): ApertureCliError {
  return new ApertureCliError(
    "aperture.camera.usage",
    `${message} Run 'aperture camera fit-local --help'.`,
  );
}

export function cameraFitLocalHelp(): string {
  return `Usage:
  aperture camera fit-local <headless-config> --request-resource <id> --fit-plan <file> --seed <integer> [--out <report.json>]

Freshly initialize one CPU app, inspect its complete source-owned request, then
fit selected landmarks with the existing camera solver. No extra simulation
step, render, GPU, authored camera/geometry edits or automatic application.
Uses strict local assets, public directory 'public', and no HTTP asset fetching.

Fit-plan JSON: { selection: [{subject,point},...], fit: {parameters, tolerancePixels, maxIterations?} }
Selection, seed and positive pixel tolerance are explicit. The source resource's
values.request owns camera, viewport, local features, targets, optional weights
and cameraJob.referenceDistance. No target overlays, saved reports, inferred
correspondences or JSON-encoded selection names. Full job export must succeed
before selection; nonselected points cannot bypass its representation checks.

One versioned report retains the plan, full current-camera inspection, selected
job and complete fitted candidate. Nonselected inspection features describe the
current authored camera, not the proposed candidate. cameraApplied is false.
Apply the complete accepted result.spawnCamera explicitly, preserving scene
presentation settings; then inspect again after camera or geometry edits.
This does not identify visible/occluded landmarks or recover correct geometry.

Exit 0: accepted fit. Exit 2: retained inspection/export failure or completed
unaccepted fit. Invalid plans/jobs, initial ill-conditioning, bootstrap, disposal
and I/O failures follow the existing error path (CLI exit 1), with no new report.
Disposal precedes publication. --out writes atomically and must differ from the
config and fit-plan inputs, including aliases. Old outputs are never reused.
See docs/CAMERA_COMPOSITION_WORKFLOW.md for assumptions and fit diagnostics.
`;
}
