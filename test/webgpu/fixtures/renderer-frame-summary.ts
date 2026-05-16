import {
  createFrameExecutionReport,
  createRendererFrameSummaryFromExecutionReport,
  rendererFrameSummaryReportToJsonValue,
  type FrameExecutionReport,
  type RendererFrameSummaryReport,
  type RendererFrameSummaryReportJsonValue,
  type RenderPassAssemblySmokeReport,
  type RendererAssemblySmokeReport,
} from "@aperture-engine/webgpu";
import {
  createFrameExecutionSmokeFixture,
  type FrameExecutionFailurePoint,
} from "./frame-execution.js";

export type RendererFrameSummaryFailurePoint =
  | "renderer"
  | "renderPass"
  | FrameExecutionFailurePoint;

export interface RendererFrameSummaryFixtureOptions {
  readonly failAt?: RendererFrameSummaryFailurePoint;
}

export interface RendererFrameSummaryFixture {
  readonly renderer: RendererAssemblySmokeReport;
  readonly renderPass: RenderPassAssemblySmokeReport;
  readonly execution: FrameExecutionReport;
  readonly summary: RendererFrameSummaryReport;
  readonly json: RendererFrameSummaryReportJsonValue;
  readonly events: readonly string[];
}

export function createRendererFrameSummaryFixture(
  options: RendererFrameSummaryFixtureOptions = {},
): RendererFrameSummaryFixture {
  const failAt = frameExecutionFailure(options.failAt);
  const executionFixture = createFrameExecutionSmokeFixture(
    failAt === undefined ? {} : { failAt },
  );
  const renderer = rendererReport(options.failAt !== "renderer");
  const renderPass = renderPassReport(options.failAt !== "renderPass");
  const execution = createFrameExecutionReport(executionFixture.assembly);
  const summary = createRendererFrameSummaryFromExecutionReport({
    renderer,
    renderPass,
    execution,
  });

  return {
    renderer,
    renderPass,
    execution,
    summary,
    json: rendererFrameSummaryReportToJsonValue(summary),
    events: executionFixture.events,
  };
}

function frameExecutionFailure(
  failAt: RendererFrameSummaryFailurePoint | undefined,
): FrameExecutionFailurePoint | undefined {
  return failAt === "renderer" || failAt === "renderPass" ? undefined : failAt;
}

function rendererReport(ready: boolean): RendererAssemblySmokeReport {
  return {
    ready,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "rendererAssembly.frameNotReady",
            message: "Frame report is not ready.",
            severity: "warning",
            section: "frame",
          },
        ],
    summary: {
      snapshot: null,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: 1,
        ready,
        draws: 3,
        batches: 1,
        diagnostics: {
          total: ready ? 0 : 1,
          bySeverity: { info: 0, warning: ready ? 0 : 1, error: 0 },
          byCode: ready ? {} : { "rendererAssembly.frameNotReady": 1 },
        },
      },
    },
  };
}

function renderPassReport(ready: boolean): RenderPassAssemblySmokeReport {
  return {
    ready,
    sections: {} as RenderPassAssemblySmokeReport["sections"],
    diagnostics: ready
      ? []
      : [
          {
            code: "renderPassAssembly.commandPlanNotReady",
            message: "Command plan is not ready.",
            severity: "warning",
            section: "commands",
          },
        ],
    summary: {
      drawList: { valid: ready, draws: [] },
      resources: { valid: ready, draws: [] },
      commands: {
        valid: ready,
        drawCount: 3,
        commandCount: 3,
        indexedDrawCount: 0,
        nonIndexedDrawCount: 3,
      },
      execution: {
        valid: ready,
        commandCount: 3,
        executedCommands: ready ? 3 : 2,
        skippedCommands: ready ? 0 : 1,
        drawCalls: ready ? 3 : 2,
      },
    },
  };
}
