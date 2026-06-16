import type { RenderSnapshot } from "@aperture-engine/render";
import {
  ApertureAppError,
  createApertureApp,
  type ApertureApp,
  type CreateApertureAppOptions,
} from "./advanced.js";
import { defineApertureConfig, type ApertureConfig } from "./config.js";
import {
  createApertureEntityLookup,
  createApertureEntityLookupSnapshot,
  type ApertureEntityLookup,
  type ApertureEntityLookupSnapshot,
} from "./entity-lookup.js";
import { createSignalSummary, type SignalSummary } from "./systems.js";
import {
  createApertureGeneratedFailureStatus,
  type ApertureGeneratedDiagnosticsStatus,
} from "./diagnostics.js";
import { createInputSummary, type ApertureInputSummary } from "./input.js";

export interface CreateApertureHeadlessRunnerOptions extends Omit<
  CreateApertureAppOptions,
  "config"
> {
  readonly config: ApertureConfig;
}

export interface ApertureHeadlessSnapshotCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly lights: number;
  readonly bounds: number;
  readonly diagnostics: number;
}

export interface ApertureHeadlessStatus {
  readonly mode: "headless";
  readonly nextFrame: number;
  readonly preload: ApertureApp["preload"];
  readonly assets: ReturnType<
    ApertureApp["lowLevel"]["assets"]["createManifestReport"]
  >;
  readonly input: ApertureInputSummary;
  readonly signals: SignalSummary;
  readonly resources: ReturnType<ApertureApp["context"]["resources"]["summary"]>;
  readonly startOptions: ReturnType<
    ApertureApp["context"]["startOptions"]["summary"]
  >;
  readonly diagnostics: ReturnType<
    ApertureApp["context"]["diagnostics"]["list"]
  >;
  readonly entities: ApertureEntityLookupSnapshot;
  readonly lastSnapshot: {
    readonly frame: number;
    readonly counts: ApertureHeadlessSnapshotCounts;
  } | null;
}

export interface ApertureHeadlessStepReport {
  readonly snapshot: RenderSnapshot;
  readonly status: ApertureHeadlessStatus;
}

export interface ApertureHeadlessFailureStatus extends ApertureGeneratedDiagnosticsStatus {
  readonly mode: "headless";
}

export interface ApertureHeadlessRunner {
  readonly app: ApertureApp;
  readonly entities: ApertureEntityLookup;
  getStatus(): ApertureHeadlessStatus;
  step(delta?: number, time?: number): ApertureHeadlessStepReport;
  extract(frame?: number): ApertureHeadlessStepReport;
}

export async function createApertureHeadlessRunner(
  options: CreateApertureHeadlessRunnerOptions,
): Promise<ApertureHeadlessRunner> {
  const config = defineApertureConfig(options.config);

  if (config.mode !== "headless") {
    throw new ApertureAppError({
      code: "aperture.headless.invalidMode",
      message: "Aperture headless runner requires mode: 'headless'.",
      suggestedFix:
        "Use a headless aperture config or run browser configs through the generated Vite browser bootstrap.",
      detail: { mode: config.mode },
    });
  }

  const app = await createApertureApp({
    ...options,
    config,
  });
  let nextFrame = 0;
  let lastSnapshot: RenderSnapshot | null = null;
  const entities = createApertureEntityLookup(app.lowLevel.world);

  return {
    app,
    entities,
    getStatus() {
      return createHeadlessStatus(app, nextFrame, lastSnapshot);
    },
    step(delta = 0, time = 0) {
      const frame = nextFrame;
      nextFrame += 1;
      lastSnapshot = app.stepAndExtract(delta, time, frame);

      return {
        snapshot: lastSnapshot,
        status: createHeadlessStatus(app, nextFrame, lastSnapshot),
      };
    },
    extract(frame = nextFrame) {
      lastSnapshot = app.extract(frame);

      return {
        snapshot: lastSnapshot,
        status: createHeadlessStatus(app, nextFrame, lastSnapshot),
      };
    },
  };
}

export function createApertureHeadlessFailureStatus(
  error: unknown,
): ApertureHeadlessFailureStatus {
  return {
    mode: "headless",
    ...createApertureGeneratedFailureStatus({
      error,
      fallback: {
        code: "aperture.headless.failed",
        severity: "error",
        message: "Aperture headless app failed.",
        suggestedFix:
          "Inspect aperture.config.ts, system modules, and asset URLs before rerunning headless mode.",
      },
    }),
  };
}

function createHeadlessStatus(
  app: ApertureApp,
  nextFrame: number,
  lastSnapshot: RenderSnapshot | null,
): ApertureHeadlessStatus {
  return {
    mode: "headless",
    nextFrame,
    preload: app.preload,
    assets: app.lowLevel.assets.createManifestReport(),
    input: createInputSummary(app.context.input),
    signals: createSignalSummary(app.context.signals),
    resources: app.context.resources.summary(),
    startOptions: app.context.startOptions.summary(),
    diagnostics: app.context.diagnostics.list(),
    entities: createApertureEntityLookupSnapshot(app.lowLevel.world, {
      label: "headless",
    }),
    lastSnapshot:
      lastSnapshot === null
        ? null
        : {
            frame: lastSnapshot.frame,
            counts: snapshotCounts(lastSnapshot),
          },
  };
}

function snapshotCounts(
  snapshot: RenderSnapshot,
): ApertureHeadlessSnapshotCounts {
  return {
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    bounds: snapshot.bounds.length,
    diagnostics: snapshot.diagnostics.length,
  };
}
